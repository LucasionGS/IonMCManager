import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { existsSync, mkdirSync } from "node:fs";
import process from "node:process";
import MinecraftApi from "../services/MinecraftApi.ts";
import type MinecraftServer from "../database/models/MinecraftServer.ts";
import { Buffer } from "node:buffer";

export interface ServerSetupConfig {
  serverInstance: MinecraftServer;
  basePath?: string;
}

export interface ServerSetupResult {
  success: boolean;
  serverPath: string;
  jarFile: string;
  error?: string;
}

export default class ServerSetupService {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || process.env.SERVERS_PATH || '/app/minecraft_servers';
    
    // Ensure base directory exists
    if (!existsSync(this.basePath)) {
      mkdirSync(this.basePath, { recursive: true });
    }
  }

  /**
   * Set up a new Minecraft server by downloading jar and creating directory structure
   */
  async setupServer(config: ServerSetupConfig): Promise<ServerSetupResult> {
    const { serverInstance } = config;
    
    try {
      // Create server directory structure
      const serverPath = await this.createServerDirectory(serverInstance);
      
      // Download server jar based on type
      const jarFile = await this.downloadServerJar(serverInstance, serverPath);
      
      // Create basic server configuration files
      await this.createServerConfig(serverInstance, serverPath);
      
      // Update server instance with paths
      await serverInstance.update({
        serverPath,
        jarFile,
        status: 'stopped'
      });

      return {
        success: true,
        serverPath,
        jarFile
      };
    } catch (error) {
      console.error('Server setup failed:', error);
      
      // Update server status to error
      await serverInstance.updateStatus('error');
      
      return {
        success: false,
        serverPath: '',
        jarFile: '',
        error: error instanceof Error ? error.message : 'Unknown error during setup'
      };
    }
  }

  /**
   * Create server directory structure
   */
  private async createServerDirectory(serverInstance: MinecraftServer): Promise<string> {
    const serverDirName = `${serverInstance.id}-${serverInstance.name.replace(/[^a-zA-Z0-9-_]/g, '_')}`;
    const serverPath = join(this.basePath, serverDirName);
    
    // Create main server directory
    if (!existsSync(serverPath)) {
      mkdirSync(serverPath, { recursive: true });
    }
    
    // Create subdirectories
    const subdirs = ['world', 'plugins', 'mods', 'logs', 'backups'];
    for (const subdir of subdirs) {
      const subdirPath = join(serverPath, subdir);
      if (!existsSync(subdirPath)) {
        mkdirSync(subdirPath, { recursive: true });
      }
    }
    
    return serverPath;
  }

  /**
   * Download the appropriate server jar file
   */
  private async downloadServerJar(serverInstance: MinecraftServer, serverPath: string): Promise<string> {
    const { minecraftVersion, serverType } = serverInstance;
    
    let downloadUrl: string;
    let jarFileName: string;
    
    if (serverType === 'vanilla') {
      // Download vanilla Minecraft server
      const versionData = await MinecraftApi.getServerData(minecraftVersion);
      downloadUrl = versionData.downloads.server.url;
      jarFileName = `minecraft-server-${minecraftVersion}.jar`;
    } else if (serverType === 'forge') {
      // Download Forge server (for now, we'll use a placeholder)
      // In a real implementation, you'd download the Forge installer and run it
      throw new Error('Forge server setup not yet implemented. Please use vanilla servers for now.');
    } else if (serverType === 'paper') {
      // Download Paper server
      downloadUrl = `https://api.papermc.io/v2/projects/paper/versions/${minecraftVersion}/builds/latest/downloads/paper-${minecraftVersion}-latest.jar`;
      jarFileName = `paper-${minecraftVersion}.jar`;
    } else if (serverType === 'spigot') {
      // Spigot requires building from source, so we'll use a placeholder
      throw new Error('Spigot server setup requires building from source. Please use Paper or vanilla servers.');
    } else {
      throw new Error(`Unsupported server type: ${serverType}`);
    }
    
    const jarPath = join(serverPath, jarFileName);
    
    // Download the jar file
    console.log(`Downloading ${serverType} server jar from: ${downloadUrl}`);
    await this.downloadFile(downloadUrl, jarPath);
    
    console.log(`Successfully downloaded server jar to: ${jarPath}`);
    return jarFileName;
  }

  /**
   * Download a file from URL to local path
   */
  private async downloadFile(url: string, outputPath: string): Promise<void> {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Ensure directory exists
    const dir = dirname(outputPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    await fs.writeFile(outputPath, buffer);
  }

  /**
   * Create basic server configuration files
   */
  private async createServerConfig(serverInstance: MinecraftServer, serverPath: string): Promise<void> {
    // Create server.properties
    const serverProperties = this.generateServerProperties(serverInstance);
    await fs.writeFile(join(serverPath, 'server.properties'), serverProperties);
    
    // Create eula.txt (accept EULA by default)
    const eulaContent = `# Minecraft EULA\n# https://account.mojang.com/documents/minecraft_eula\neula=true\n`;
    await fs.writeFile(join(serverPath, 'eula.txt'), eulaContent);
    
    // Create ops.json (empty initially)
    await fs.writeFile(join(serverPath, 'ops.json'), '[]');
    
    // Create whitelist.json (empty initially)
    await fs.writeFile(join(serverPath, 'whitelist.json'), '[]');
    
    // Create banned-players.json (empty initially)
    await fs.writeFile(join(serverPath, 'banned-players.json'), '[]');
    
    // Create banned-ips.json (empty initially)
    await fs.writeFile(join(serverPath, 'banned-ips.json'), '[]');
  }

  /**
   * Generate server.properties content
   */
  private generateServerProperties(serverInstance: MinecraftServer): string {
    const properties = [
      `# Minecraft server properties`,
      `# Generated by IonMC Manager`,
      `server-name=${serverInstance.name}`,
      `server-port=${serverInstance.port || 25565}`,
      `gamemode=${serverInstance.gamemode}`,
      `difficulty=${serverInstance.difficulty}`,
      `max-players=${serverInstance.maxPlayers}`,
      `motd=${serverInstance.motd || 'A Minecraft Server'}`,
      `level-type=${serverInstance.worldType}`,
      `level-seed=${serverInstance.worldSeed || ''}`,
      `allow-nether=${serverInstance.allowNether}`,
      `pvp=${serverInstance.enablePvp}`,
      `enable-command-block=${serverInstance.enableCommandBlock}`,
      `online-mode=${serverInstance.onlineMode}`,
      `white-list=${serverInstance.enableWhitelist}`,
      `spawn-protection=16`,
      `view-distance=10`,
      `simulation-distance=10`,
      `player-idle-timeout=0`,
      `force-gamemode=false`,
      `rate-limit=0`,
      `hardcore=false`,
      `enable-status=true`,
      `enable-query=false`,
      `generator-settings={}`,
      `level-name=world`,
      `spawn-animals=true`,
      `spawn-monsters=true`,
      `spawn-npcs=true`,
      `generate-structures=true`,
      `sync-chunk-writes=true`,
      `op-permission-level=4`,
      `prevent-proxy-connections=false`,
      `resource-pack=`,
      `resource-pack-sha1=`,
      `max-world-size=29999984`,
      `function-permission-level=2`,
      `max-tick-time=60000`,
      `max-chained-neighbor-updates=1000000`,
      `network-compression-threshold=256`,
      `require-resource-pack=false`,
      `use-native-transport=true`,
      `enable-jmx-monitoring=false`,
      `enforce-whitelist=false`,
      `entity-broadcast-range-percentage=100`,
      `enforce-secure-profile=true`
    ];
    
    return properties.join('\n') + '\n';
  }

  /**
   * Clean up server files (for deletion)
   */
  async cleanupServer(serverInstance: MinecraftServer): Promise<void> {
    if (!serverInstance.serverPath) {
      return;
    }
    
    try {
      // Remove server directory recursively
      await fs.rm(serverInstance.serverPath, { recursive: true, force: true });
      console.log(`Cleaned up server directory: ${serverInstance.serverPath}`);
    } catch (error) {
      console.error('Failed to cleanup server files:', error);
      // Don't throw - deletion from database should still proceed
    }
  }
}