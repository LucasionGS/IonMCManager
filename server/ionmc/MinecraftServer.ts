import pty, { IPty } from "node-pty";
import { EventEmitter } from "node:events";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

export interface MinecraftServerConfig {
  id: string;
  name: string;
  serverPath: string;
  jarFile: string;
  minMemory: string;
  maxMemory: string;
  javaArgs?: string[];
  serverArgs?: string[];
  autoRestart: boolean;
  port: number;
}

export interface ServerStatus {
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'crashed';
  players: number;
  maxPlayers: number;
  version: string;
  uptime: number;
  memoryUsage: number;
  tps: number;
}

export default class MinecraftServer extends EventEmitter {
  private id: string;
  private name: string;
  private config: MinecraftServerConfig;
  private status: ServerStatus['status'] = 'stopped';
  private ptyProcess: IPty | null = null;
  private startTime: number | null = null;
  private players: Set<string> = new Set();
  private maxPlayers: number = 20;
  private version: string = 'Unknown';
  private lastTps: number = 20.0;
  private outputBuffer: string[] = [];
  private maxOutputBuffer: number = 1000;
  private autoRestart: boolean;
  private restartAttempts: number = 0;
  private maxRestartAttempts: number = 3;

  constructor(config: MinecraftServerConfig) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.config = config;
    this.autoRestart = config.autoRestart;
    
    // Ensure server directory exists
    if (!existsSync(config.serverPath)) {
      mkdirSync(config.serverPath, { recursive: true });
    }
  }

  public start(): Promise<boolean> {
    if (this.status !== 'stopped') {
      throw new Error(`Server ${this.id} is not stopped (current status: ${this.status})`);
    }

    const jarPath = join(this.config.serverPath, this.config.jarFile);
    if (!existsSync(jarPath)) {
      throw new Error(`Server jar file not found: ${jarPath}`);
    }

    this.setStatus('starting');
    this.startTime = Date.now();
    this.restartAttempts = 0;

    try {
      const javaArgs = [
        `-Xms${this.config.minMemory}`,
        `-Xmx${this.config.maxMemory}`,
        ...(this.config.javaArgs || []),
        '-jar',
        this.config.jarFile,
        '--nogui',
        ...(this.config.serverArgs || [])
      ];

      this.ptyProcess = pty.spawn('java', javaArgs, {
        cwd: this.config.serverPath,
        env: { ...process.env, TERM: 'xterm-256color' },
        cols: 120,
        rows: 30
      });

      this.setupProcessHandlers();
      this.emit('starting', { serverId: this.id });
      
      return Promise.resolve(true);
    } catch (error) {
      this.setStatus('crashed');
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit('error', { serverId: this.id, error: errorMessage });
      return Promise.resolve(false);
    }
  }

  public stop(force: boolean = false): Promise<boolean> {
    if (this.status === 'stopped') {
      return Promise.resolve(true);
    }

    this.setStatus('stopping');
    this.emit('stopping', { serverId: this.id });

    if (!this.ptyProcess) {
      this.setStatus('stopped');
      return Promise.resolve(true);
    }

    if (force) {
      this.ptyProcess.kill('SIGKILL');
    } else {
      // Graceful shutdown
      this.executeCommand('stop');
      
      // Wait up to 30 seconds for graceful shutdown
      const timeout = setTimeout(() => {
        if (this.ptyProcess) {
          this.ptyProcess.kill('SIGTERM');
        }
      }, 30000);

      // Clear timeout when process exits
      this.ptyProcess.onExit((data) => {
        clearTimeout(timeout);
        this.handleProcessExit(data.exitCode);
      });
    }

    return Promise.resolve(true);
  }

  public async restart(): Promise<boolean> {
    if (this.status === 'stopped') {
      return this.start();
    }

    await this.stop();
    
    // Wait for complete shutdown
    return new Promise((resolve) => {
      const checkStatus = () => {
        if (this.status === 'stopped') {
          this.start().then(resolve);
        } else {
          setTimeout(checkStatus, 500);
        }
      };
      checkStatus();
    });
  }

  public executeCommand(command: string): boolean {
    if (!this.ptyProcess || this.status !== 'running') {
      return false;
    }

    this.ptyProcess.write(`${command}\r`);
    this.emit('command', { serverId: this.id, command });
    return true;
  }

  public getStatus(): ServerStatus {
    return {
      status: this.status,
      players: this.players.size,
      maxPlayers: this.maxPlayers,
      version: this.version,
      uptime: this.startTime ? Date.now() - this.startTime : 0,
      memoryUsage: this.getMemoryUsage(),
      tps: this.lastTps
    };
  }

  public getRecentOutput(lines: number = 50): string[] {
    return this.outputBuffer.slice(-lines);
  }

  public getPlayerList(): string[] {
    return Array.from(this.players);
  }

  public kickPlayer(playerName: string, reason: string = 'Kicked by admin'): boolean {
    return this.executeCommand(`kick ${playerName} ${reason}`);
  }

  public banPlayer(playerName: string, reason: string = 'Banned by admin'): boolean {
    return this.executeCommand(`ban ${playerName} ${reason}`);
  }

  public broadcastMessage(message: string): boolean {
    return this.executeCommand(`say ${message}`);
  }

  public setGameMode(playerName: string, gameMode: 'survival' | 'creative' | 'adventure' | 'spectator'): boolean {
    return this.executeCommand(`gamemode ${gameMode} ${playerName}`);
  }

  public teleportPlayer(playerName: string, x: number, y: number, z: number): boolean {
    return this.executeCommand(`tp ${playerName} ${x} ${y} ${z}`);
  }

  public giveItem(playerName: string, item: string, count: number = 1): boolean {
    return this.executeCommand(`give ${playerName} ${item} ${count}`);
  }

  public setTime(time: 'day' | 'night' | number): boolean {
    return this.executeCommand(`time set ${time}`);
  }

  public setWeather(weather: 'clear' | 'rain' | 'thunder'): boolean {
    return this.executeCommand(`weather ${weather}`);
  }

  public saveWorld(): boolean {
    return this.executeCommand('save-all');
  }

  private setupProcessHandlers(): void {
    if (!this.ptyProcess) return;

    this.ptyProcess.onData((data: string) => {
      this.handleOutput(data);
    });

    this.ptyProcess.onExit((data) => {
      this.handleProcessExit(data.exitCode);
    });
  }

  private handleOutput(data: string): void {
    const lines = data.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      this.addToOutputBuffer(line);
      this.parseLogLine(line);
      this.emit('output', { serverId: this.id, output: line, timestamp: new Date().toISOString() });
    }
  }

  private parseLogLine(line: string): void {
    // Remove ANSI color codes using unicode escape
    const cleanLine = line.replace(/\u001B\[[0-9;]*m/g, '');
    
    // Server started
    if (cleanLine.includes('Done (') && cleanLine.includes('s)! For help, type "help"')) {
      this.setStatus('running');
      this.emit('started', { serverId: this.id });
    }
    
    // Player join
    const joinMatch = cleanLine.match(/(\w+) joined the game/);
    if (joinMatch) {
      const playerName = joinMatch[1];
      this.players.add(playerName);
      this.emit('playerJoin', { serverId: this.id, playerName });
    }
    
    // Player leave
    const leaveMatch = cleanLine.match(/(\w+) left the game/);
    if (leaveMatch) {
      const playerName = leaveMatch[1];
      this.players.delete(playerName);
      this.emit('playerLeave', { serverId: this.id, playerName });
    }
    
    // Player list response
    const playerListMatch = cleanLine.match(/There are (\d+) of a max of (\d+) players online: (.+)/);
    if (playerListMatch) {
      this.maxPlayers = parseInt(playerListMatch[2]);
      const playerNames = playerListMatch[3].split(', ').filter(name => name.trim());
      this.players = new Set(playerNames);
    }
    
    // TPS monitoring
    const tpsMatch = cleanLine.match(/TPS: ([\d.]+)/);
    if (tpsMatch) {
      this.lastTps = parseFloat(tpsMatch[1]);
    }
    
    // Server version
    const versionMatch = cleanLine.match(/Starting minecraft server version ([\w.-]+)/);
    if (versionMatch) {
      this.version = versionMatch[1];
    }
    
    // Error detection
    if (cleanLine.includes('ERROR') || cleanLine.includes('FATAL') || cleanLine.includes('Exception')) {
      this.emit('error', { serverId: this.id, error: cleanLine });
    }
  }

  private handleProcessExit(exitCode: number): void {
    this.ptyProcess = null;
    this.startTime = null;
    this.players.clear();
    
    if (exitCode === 0) {
      this.setStatus('stopped');
      this.emit('stopped', { serverId: this.id, exitCode });
    } else {
      this.setStatus('crashed');
      this.emit('crashed', { serverId: this.id, exitCode });
      
      if (this.autoRestart && this.restartAttempts < this.maxRestartAttempts) {
        this.restartAttempts++;
        setTimeout(() => {
          this.start();
        }, 5000);
      }
    }
  }

  private setStatus(newStatus: ServerStatus['status']): void {
    if (this.status !== newStatus) {
      const oldStatus = this.status;
      this.status = newStatus;
      this.emit('statusChange', { serverId: this.id, oldStatus, newStatus });
    }
  }

  private addToOutputBuffer(line: string): void {
    this.outputBuffer.push(line);
    if (this.outputBuffer.length > this.maxOutputBuffer) {
      this.outputBuffer = this.outputBuffer.slice(-this.maxOutputBuffer);
    }
  }

  private getMemoryUsage(): number {
    // This would need to be implemented with actual memory monitoring
    // For now, return a placeholder
    return 0;
  }

  public destroy(): void {
    if (this.ptyProcess) {
      this.ptyProcess.kill('SIGKILL');
    }
    this.removeAllListeners();
  }
}