import MinecraftServerProcess from "../ionmc/MinecraftServer.ts";
import type MinecraftServer from "../database/models/MinecraftServer.ts";
import type { MinecraftServerConfig } from "../ionmc/MinecraftServer.ts";
import { io } from "../server.ts";

export interface ServerControlResult {
  success: boolean;
  message: string;
  error?: string;
}

export default class ServerControlService {
  private runningServers: Map<number, MinecraftServerProcess> = new Map();

  /**
   * Start a Minecraft server
   */
  async startServer(serverInstance: MinecraftServer): Promise<ServerControlResult> {
    try {
      // Check if server is already running
      if (this.runningServers.has(serverInstance.id)) {
        return {
          success: false,
          message: 'Server is already running'
        };
      }

      // Validate server files exist
      if (!serverInstance.serverPath || !serverInstance.jarFile) {
        return {
          success: false,
          message: 'Server is not properly set up. Missing server path or jar file.'
        };
      }

      // Create MinecraftServer process configuration
      const config: MinecraftServerConfig = {
        id: serverInstance.id.toString(),
        name: serverInstance.name,
        serverPath: serverInstance.serverPath,
        jarFile: serverInstance.jarFile,
        minMemory: `${Math.floor(serverInstance.memory * 0.5)}M`, // Use 50% of allocated memory as minimum
        maxMemory: `${serverInstance.memory}M`,
        javaArgs: [
          '-XX:+UseG1GC',
          '-XX:+UnlockExperimentalVMOptions',
          '-XX:MaxGCPauseMillis=100',
          '-XX:+DisableExplicitGC',
          '-XX:TargetSurvivorRatio=90',
          '-XX:G1NewSizePercent=50',
          '-XX:G1MaxNewSizePercent=80',
          '-XX:InitiatingHeapOccupancyPercent=10',
          '-XX:G1MixedGCLiveThresholdPercent=50'
        ],
        serverArgs: [],
        autoRestart: false,
        port: serverInstance.port || 25565
      };

      // Create and start the server process
      const minecraftServer = new MinecraftServerProcess(config);
      
      // Set up event listeners
      this.setupServerEventListeners(minecraftServer, serverInstance);
      
      // Store reference
      this.runningServers.set(serverInstance.id, minecraftServer);
      
      // Start the server
      const started = await minecraftServer.start();
      
      if (!started) {
        this.runningServers.delete(serverInstance.id);
        return {
          success: false,
          message: 'Failed to start server process'
        };
      }

      // Update database status
      await serverInstance.updateStatus('starting');

      return {
        success: true,
        message: 'Server start initiated'
      };
    } catch (error) {
      console.error('Failed to start server:', error);
      
      // Clean up if server was added to map
      this.runningServers.delete(serverInstance.id);
      
      // Update status to error
      await serverInstance.updateStatus('error');
      
      return {
        success: false,
        message: 'Failed to start server',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Stop a Minecraft server
   */
  async stopServer(serverInstance: MinecraftServer): Promise<ServerControlResult> {
    try {
      const minecraftServer = this.runningServers.get(serverInstance.id);
      
      if (!minecraftServer) {
        return {
          success: false,
          message: 'Server is not running'
        };
      }

      // Stop the server
      await minecraftServer.stop();
      
      // Update database status
      await serverInstance.updateStatus('stopping');

      return {
        success: true,
        message: 'Server stop initiated'
      };
    } catch (error) {
      console.error('Failed to stop server:', error);
      
      await serverInstance.updateStatus('error');
      
      return {
        success: false,
        message: 'Failed to stop server',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Restart a Minecraft server
   */
  async restartServer(serverInstance: MinecraftServer): Promise<ServerControlResult> {
    try {
      const stopResult = await this.stopServer(serverInstance);
      if (!stopResult.success) {
        return stopResult;
      }

      // Wait a moment for the server to fully stop
      await new Promise(resolve => setTimeout(resolve, 2000));

      const startResult = await this.startServer(serverInstance);
      return startResult;
    } catch (error) {
      console.error('Failed to restart server:', error);
      
      await serverInstance.updateStatus('error');
      
      return {
        success: false,
        message: 'Failed to restart server',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Send command to a running server
   */
  async sendCommand(serverInstance: MinecraftServer, command: string): Promise<ServerControlResult> {
    try {
      const minecraftServer = this.runningServers.get(serverInstance.id);
      
      if (!minecraftServer) {
        return {
          success: false,
          message: 'Server is not running'
        };
      }

      minecraftServer.executeCommand(command);

      return {
        success: true,
        message: 'Command sent successfully'
      };
    } catch (error) {
      console.error('Failed to send command:', error);
      
      return {
        success: false,
        message: 'Failed to send command',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get server console output
   */
  getServerOutput(serverInstance: MinecraftServer): string[] {
    const minecraftServer = this.runningServers.get(serverInstance.id);
    
    if (!minecraftServer) {
      return [];
    }

    return minecraftServer.getRecentOutput();
  }

  /**
   * Set up event listeners for server events
   */
  private setupServerEventListeners(minecraftServer: MinecraftServerProcess, serverInstance: MinecraftServer): void {
    minecraftServer.on('started', async () => {
      console.log(`Server ${serverInstance.name} started successfully`);
      await serverInstance.updateStatus('running');
      
      // Emit socket event for real-time UI updates
      io.emit('serverStatusUpdate', {
        serverId: serverInstance.id,
        status: 'running',
        timestamp: new Date().toISOString()
      });
    });

    minecraftServer.on('stopped', async () => {
      console.log(`Server ${serverInstance.name} stopped`);
      await serverInstance.updateStatus('stopped');
      this.runningServers.delete(serverInstance.id);
      
      // Emit socket event for real-time UI updates
      io.emit('serverStatusUpdate', {
        serverId: serverInstance.id,
        status: 'stopped',
        timestamp: new Date().toISOString()
      });
    });

    minecraftServer.on('crashed', async ({ exitCode }) => {
      console.error(`Server ${serverInstance.name} crashed with exit code:`, exitCode);
      await serverInstance.updateStatus('crashed');
      this.runningServers.delete(serverInstance.id);
      
      // Emit socket event for real-time UI updates
      io.emit('serverStatusUpdate', {
        serverId: serverInstance.id,
        status: 'crashed',
        timestamp: new Date().toISOString(),
        exitCode
      });
    });

    minecraftServer.on('error', async ({ error }) => {
      console.error(`Server ${serverInstance.name} error:`, error);
      await serverInstance.updateStatus('error');
      
      // Emit socket event for real-time UI updates
      io.emit('serverStatusUpdate', {
        serverId: serverInstance.id,
        status: 'error',
        timestamp: new Date().toISOString(),
        error
      });
    });

    minecraftServer.on('starting', async () => {
      console.log(`Server ${serverInstance.name} is starting...`);
      await serverInstance.updateStatus('starting');
      
      // Emit socket event for real-time UI updates
      io.emit('serverStatusUpdate', {
        serverId: serverInstance.id,
        status: 'starting',
        timestamp: new Date().toISOString()
      });
    });

    minecraftServer.on('stopping', async () => {
      console.log(`Server ${serverInstance.name} is stopping...`);
      await serverInstance.updateStatus('stopping');
      
      // Emit socket event for real-time UI updates
      io.emit('serverStatusUpdate', {
        serverId: serverInstance.id,
        status: 'stopping',
        timestamp: new Date().toISOString()
      });
    });

    minecraftServer.on('playerJoin', ({ playerName }) => {
      console.log(`Player ${playerName} joined server ${serverInstance.name}`);
      
      // Emit socket event for player activity
      io.emit('playerActivity', {
        serverId: serverInstance.id,
        action: 'join',
        playerName,
        timestamp: new Date().toISOString()
      });
    });

    minecraftServer.on('playerLeave', ({ playerName }) => {
      console.log(`Player ${playerName} left server ${serverInstance.name}`);
      
      // Emit socket event for player activity
      io.emit('playerActivity', {
        serverId: serverInstance.id,
        action: 'leave',
        playerName,
        timestamp: new Date().toISOString()
      });
    });

    minecraftServer.on('output', ({ output }) => {
      // Emit console output to frontend via socket
      io.emit('serverConsoleOutput', {
        serverId: serverInstance.id,
        output,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Get running server instance
   */
  getRunningServer(serverId: number): MinecraftServerProcess | undefined {
    return this.runningServers.get(serverId);
  }

  /**
   * Check if server is running
   */
  isServerRunning(serverId: number): boolean {
    return this.runningServers.has(serverId);
  }

  /**
   * Stop all running servers (for graceful shutdown)
   */
  async stopAllServers(): Promise<void> {
    const stopPromises = Array.from(this.runningServers.values()).map(server => 
      server.stop().catch(console.error)
    );
    
    await Promise.all(stopPromises);
    this.runningServers.clear();
  }

  /**
   * Update NeoForge server memory configuration by updating user_jvm_args.txt
   */
  async updateNeoForgeMemory(serverInstance: MinecraftServer): Promise<ServerControlResult> {
    try {
      if (serverInstance.serverType !== 'neoforge') {
        return {
          success: false,
          message: 'This method is only for NeoForge servers'
        };
      }

      if (!serverInstance.serverPath) {
        return {
          success: false,
          message: 'Server path not found'
        };
      }

      // Import ServerSetupService to update JVM args
      const { default: ServerSetupService } = await import('./ServerSetupService.ts');
      const setupService = new ServerSetupService();
      
      await setupService.updateNeoForgeJvmArgs(serverInstance);

      return {
        success: true,
        message: 'NeoForge memory configuration updated successfully'
      };
    } catch (error) {
      console.error('Failed to update NeoForge memory configuration:', error);
      return {
        success: false,
        message: 'Failed to update memory configuration',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}