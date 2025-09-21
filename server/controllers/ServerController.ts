import { Router, Request, Response } from "express";
import MinecraftApi from "../services/MinecraftApi.ts";
import MinecraftServer, { MinecraftServerCreationAttributes } from "../database/models/MinecraftServer.ts";
import User from "../database/models/User.ts";
import AuthController from "./AuthController.ts";
import ServerSetupService from "../services/ServerSetupService.ts";
import ServerControlService from "../services/ServerControlService.ts";

interface AuthenticatedRequest extends Request {
  user?: User;
}

namespace ServerController {
  export const router = Router();
  
  // Initialize services
  const serverSetupService = new ServerSetupService();
  const serverControlService = new ServerControlService();

  // Get available Minecraft versions
  router.get('/versions', async (_req: Request, res: Response) => {
    try {
      const manifest = await MinecraftApi.getServerVersions();
      
      res.json({
        success: true,
        data: {
          latest: manifest.latest,
          versions: manifest.versions.map(v => ({
            id: v.id,
            type: v.type,
            releaseTime: v.releaseTime,
            time: v.time
          }))
        }
      });
    } catch (error) {
      console.error('Error fetching versions:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch versions'
      });
    }
  });

  // Get versions by type (release, snapshot, etc.)
  router.get('/versions/type/:type', async (req: Request, res: Response) => {
    try {
      const { type } = req.params;
      const versions = await MinecraftApi.getVersionsByType(type);
      
      res.json({
        success: true,
        data: {
          type,
          count: versions.length,
          versions: versions.map(v => ({
            id: v.id,
            type: v.type,
            releaseTime: v.releaseTime,
            time: v.time
          }))
        }
      });
    } catch (error) {
      console.error('Error fetching versions by type:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch versions'
      });
    }
  });

  // Get detailed version data
  router.get('/versions/:versionId', async (req: Request, res: Response) => {
    try {
      const { versionId } = req.params;
      
      // Validate version exists first
      const isValid = await MinecraftApi.validateVersion(versionId);
      if (!isValid) {
        res.status(404).json({
          success: false,
          message: `Version "${versionId}" not found`
        });
        return;
      }

      const versionData = await MinecraftApi.getServerData(versionId);
      
      res.json({
        success: true,
        data: {
          id: versionData.id,
          type: versionData.type,
          releaseTime: versionData.releaseTime,
          time: versionData.time,
          downloads: versionData.downloads,
          javaVersion: versionData.javaVersion
        }
      });
    } catch (error) {
      console.error('Error fetching version data:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch version data'
      });
    }
  });

  // Get available server types
  router.get('/types', (_req: Request, res: Response) => {
    try {
      const serverTypes = MinecraftApi.getAvailableServerTypes();
      
      res.json({
        success: true,
        data: {
          count: serverTypes.length,
          serverTypes
        }
      });
    } catch (error) {
      console.error('Error fetching server types:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch server types'
      });
    }
  });

  // Get Forge versions for a Minecraft version
  router.get('/forge-versions/:minecraftVersion', async (req: Request, res: Response) => {
    try {
      const { minecraftVersion } = req.params;
      
      // Validate Minecraft version first
      const isValid = await MinecraftApi.validateVersion(minecraftVersion);
      if (!isValid && minecraftVersion !== 'latest') {
        res.status(404).json({
          success: false,
          message: `Minecraft version "${minecraftVersion}" not found`
        });
        return;
      }

      const forgeVersions = await MinecraftApi.getForgeVersions(minecraftVersion);
      
      res.json({
        success: true,
        data: {
          minecraftVersion,
          count: forgeVersions.length,
          forgeVersions: forgeVersions.map(version => ({
            version,
            downloadUrl: `https://maven.minecraftforge.net/net/minecraftforge/forge/${minecraftVersion}-${version}/forge-${minecraftVersion}-${version}-installer.jar`
          }))
        }
      });
    } catch (error) {
      console.error('Error fetching Forge versions:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch Forge versions'
      });
    }
  });

  // Get latest versions (release and snapshot)
  router.get('/latest', async (_req: Request, res: Response) => {
    try {
      const latest = await MinecraftApi.getLatestVersions();
      
      res.json({
        success: true,
        data: latest
      });
    } catch (error) {
      console.error('Error fetching latest versions:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch latest versions'
      });
    }
  });

  // Validate a version ID
  router.get('/validate/:versionId', async (req: Request, res: Response) => {
    try {
      const { versionId } = req.params;
      const isValid = await MinecraftApi.validateVersion(versionId);
      const versionInfo = isValid ? await MinecraftApi.getVersionInfo(versionId) : null;
      
      res.json({
        success: true,
        data: {
          versionId,
          isValid,
          versionInfo
        }
      });
    } catch (error) {
      console.error('Error validating version:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to validate version'
      });
    }
  });

  // Create a new server
  router.post('/create', AuthController.authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { 
        name, 
        version, 
        serverType, 
        memory, 
        description, 
        maxPlayers, 
        motd, 
        difficulty, 
        gamemode, 
        worldSeed, 
        worldType,
        forgeVersion 
      } = req.body;
      const userId = req.user?.id;

      // Authentication check
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      // Validation
      if (!name || !version || !serverType) {
        res.status(400).json({
          success: false,
          message: 'Name, version, and serverType are required'
        });
        return;
      }

      // Check if Forge version is provided for Forge servers
      if (serverType === 'forge' && !forgeVersion) {
        res.status(400).json({
          success: false,
          message: 'Forge version is required for Forge servers'
        });
        return;
      }

      // Check if server name already exists for this user
      const existingServer = await MinecraftServer.findByUserAndName(userId, name);
      if (existingServer) {
        res.status(400).json({
          success: false,
          message: `Server with name "${name}" already exists`
        });
        return;
      }

      // Check server limit
      const user = await User.findByPk(userId);
      if (!user) {
        res.status(401).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      const userServerCount = await MinecraftServer.count({
        where: { userId }
      });

      if (userServerCount >= user.serverLimit) {
        res.status(403).json({
          success: false,
          message: `Server limit exceeded. You can create up to ${user.serverLimit} server${user.serverLimit !== 1 ? 's' : ''}.`
        });
        return;
      }

      // Validate version exists
      const isValidVersion = await MinecraftApi.validateVersion(version);
      if (!isValidVersion) {
        res.status(400).json({
          success: false,
          message: `Invalid Minecraft version: ${version}`
        });
        return;
      }

      // Validate server type
      const availableTypes = MinecraftApi.getAvailableServerTypes();
      const selectedType = availableTypes.find(type => type.id === serverType);
      if (!selectedType) {
        res.status(400).json({
          success: false,
          message: `Invalid server type: ${serverType}`
        });
        return;
      }

      // Validate Forge version if provided
      if (serverType === 'forge' && forgeVersion) {
        try {
          const availableForgeVersions = await MinecraftApi.getForgeVersions(version);
          if (!availableForgeVersions.includes(forgeVersion)) {
            res.status(400).json({
              success: false,
              message: `Invalid Forge version "${forgeVersion}" for Minecraft ${version}`
            });
            return;
          }
        } catch (error) {
          res.status(400).json({
            success: false,
            message: `Failed to validate Forge version: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
          return;
        }
      }

      // Create server in database
      const serverData: Omit<MinecraftServerCreationAttributes, "status"> = {
        userId,
        name,
        description: description || '',
        minecraftVersion: version,
        serverType,
        forgeVersion: serverType === 'forge' ? forgeVersion : undefined,
        memory: memory || 1024,
        maxPlayers: maxPlayers || 20,
        motd: motd || 'A Minecraft Server',
        difficulty: difficulty || 'normal',
        gamemode: gamemode || 'survival',
        worldSeed: worldSeed || undefined,
        worldType: worldType || 'default',
        allowNether: true,
        enablePvp: true,
        enableCommandBlock: false,
        onlineMode: true,
        enableWhitelist: false
      };

      const newServer = await MinecraftServer.createServer(serverData);

      // Set up the actual server (download jar, create directory structure)
      const setupResult = await serverSetupService.setupServer({ 
        serverInstance: newServer 
      });

      if (!setupResult.success) {
        // If setup failed, clean up the database entry
        await newServer.destroy();
        res.status(500).json({
          success: false,
          message: `Server creation failed: ${setupResult.error}`
        });
        return;
      }

      res.json({
        success: true,
        message: 'Server created and set up successfully',
        data: newServer.getDisplayInfo()
      });
    } catch (error) {
      console.error('Error creating server:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create server'
      });
    }
  });

  // Get all servers for the authenticated user
  router.get('/', AuthController.authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const [servers, user] = await Promise.all([
        MinecraftServer.findByUser(userId),
        User.findByPk(userId)
      ]);

      if (!user) {
        res.status(401).json({
          success: false,
          message: 'User not found'
        });
        return;
      }
      
      res.json({
        success: true,
        data: {
          count: servers.length,
          serverLimit: user.serverLimit,
          canCreateMore: servers.length < user.serverLimit,
          servers: servers.map(server => server.getDisplayInfo())
        }
      });
    } catch (error) {
      console.error('Error fetching servers:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch servers'
      });
    }
  });

  // Get a specific server by ID
  router.get('/:serverId', AuthController.authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { serverId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const server = await MinecraftServer.findOne({
        where: { id: serverId, userId }
      });

      if (!server) {
        res.status(404).json({
          success: false,
          message: 'Server not found'
        });
        return;
      }

      res.json({
        success: true,
        data: server.getDisplayInfo()
      });
    } catch (error) {
      console.error('Error fetching server:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch server'
      });
    }
  });

  // Update server configuration
  router.put('/:serverId', AuthController.authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { serverId } = req.params;
      const userId = req.user?.id;
      const updateData = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const server = await MinecraftServer.findOne({
        where: { id: serverId, userId }
      });

      if (!server) {
        res.status(404).json({
          success: false,
          message: 'Server not found'
        });
        return;
      }

      // Only allow updates to certain fields
      const allowedUpdates = ['name', 'description', 'memory', 'maxPlayers', 'motd', 'difficulty', 'gamemode', 'allowNether', 'enablePvp', 'enableCommandBlock', 'onlineMode', 'enableWhitelist'];
      const filteredUpdates = Object.keys(updateData)
        .filter(key => allowedUpdates.includes(key))
        .reduce((obj, key) => {
          obj[key] = updateData[key];
          return obj;
        }, {} as Record<string, string | number | boolean>);

      await server.update(filteredUpdates);

      res.json({
        success: true,
        message: 'Server updated successfully',
        data: server.getDisplayInfo()
      });
    } catch (error) {
      console.error('Error updating server:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update server'
      });
    }
  });

  // Delete a server
  router.delete('/:serverId', AuthController.authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { serverId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const server = await MinecraftServer.findOne({
        where: { id: serverId, userId }
      });

      if (!server) {
        res.status(404).json({
          success: false,
          message: 'Server not found'
        });
        return;
      }

      // Don't allow deletion of running servers
      if (server.isRunning()) {
        res.status(400).json({
          success: false,
          message: 'Cannot delete a running server. Please stop it first.'
        });
        return;
      }

      await server.destroy();

      // Clean up server files and directories
      await serverSetupService.cleanupServer(server);

      res.json({
        success: true,
        message: 'Server deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting server:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete server'
      });
    }
  });

  // Send command to a running server
  router.post('/:serverId/command', AuthController.authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { serverId } = req.params;
      const { command } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      if (!command || typeof command !== 'string') {
        res.status(400).json({
          success: false,
          message: 'Command is required and must be a string'
        });
        return;
      }

      const server = await MinecraftServer.findOne({
        where: { id: serverId, userId }
      });

      if (!server) {
        res.status(404).json({
          success: false,
          message: 'Server not found'
        });
        return;
      }

      const result = await serverControlService.sendCommand(server, command);

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: result.message,
          error: result.error
        });
        return;
      }

      res.json({
        success: true,
        message: result.message,
        data: {
          serverId: server.id,
          command
        }
      });
    } catch (error) {
      console.error('Error sending command to server:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to send command'
      });
    }
  });

  // Server control actions (start, stop, restart)
  router.post('/:serverId/:action', AuthController.authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { serverId, action } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      if (!['start', 'stop', 'restart'].includes(action)) {
        res.status(400).json({
          success: false,
          message: 'Invalid action. Must be start, stop, or restart'
        });
        return;
      }

      const server = await MinecraftServer.findOne({
        where: { id: serverId, userId }
      });

      if (!server) {
        res.status(404).json({
          success: false,
          message: 'Server not found'
        });
        return;
      }

      // Check if action is valid for current status
      if (action === 'start' && server.isRunning()) {
        res.status(400).json({
          success: false,
          message: 'Server is already running'
        });
        return;
      }

      if (action === 'stop' && server.isStopped()) {
        res.status(400).json({
          success: false,
          message: 'Server is already stopped'
        });
        return;
      }

      if (server.isTransitioning()) {
        res.status(400).json({
          success: false,
          message: 'Server is currently transitioning. Please wait.'
        });
        return;
      }

      // Update status based on action
      let newStatus: 'starting' | 'stopping';
      if (action === 'start') {
        newStatus = 'starting';
      } else if (action === 'stop') {
        newStatus = 'stopping';
      } else { // restart
        newStatus = 'stopping'; // First stop, then will start
      }

      await server.updateStatus(newStatus);

      // Execute the actual server control action
      let controlResult;
      if (action === 'start') {
        controlResult = await serverControlService.startServer(server);
      } else if (action === 'stop') {
        controlResult = await serverControlService.stopServer(server);
      } else { // restart
        controlResult = await serverControlService.restartServer(server);
      }

      if (!controlResult.success) {
        res.status(500).json({
          success: false,
          message: controlResult.message,
          error: controlResult.error
        });
        return;
      }

      res.json({
        success: true,
        message: controlResult.message,
        data: {
          serverId: server.id,
          action,
          status: server.status
        }
      });
    } catch (error) {
      console.error(`Error ${req.params.action}ing server:`, error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : `Failed to ${req.params.action} server`
      });
    }
  });

  // Get server console output
  router.get('/:serverId/console', AuthController.authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { serverId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const server = await MinecraftServer.findOne({
        where: { id: serverId, userId }
      });

      if (!server) {
        res.status(404).json({
          success: false,
          message: 'Server not found'
        });
        return;
      }

      const output = serverControlService.getServerOutput(server);

      res.json({
        success: true,
        data: {
          serverId: server.id,
          output,
          isRunning: serverControlService.isServerRunning(server.id)
        }
      });
    } catch (error) {
      console.error('Error fetching server console:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch console output'
      });
    }
  });

  // Get detailed server information for management page
  router.get('/:serverId/manage', AuthController.authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { serverId } = req.params;
      const server = await MinecraftServer.findOne({
        where: { 
          id: parseInt(serverId),
          userId: req.user!.id
        }
      });

      if (!server) {
        res.status(404).json({
          success: false,
          message: 'Server not found'
        });
        return;
      }

      const isRunning = serverControlService.isServerRunning(server.id);
      const runningServer = serverControlService.getRunningServer(server.id);
      const output = serverControlService.getServerOutput(server);

      // Get server stats if running
      let serverStats = null;
      if (isRunning && runningServer) {
        serverStats = runningServer.getStatus();
      }

      res.json({
        success: true,
        data: {
          server: {
            id: server.id,
            name: server.name,
            description: server.description,
            minecraftVersion: server.minecraftVersion,
            serverType: server.serverType,
            forgeVersion: server.forgeVersion,
            status: server.status,
            memory: server.memory,
            port: server.port,
            maxPlayers: server.maxPlayers,
            motd: server.motd,
            difficulty: server.difficulty,
            gamemode: server.gamemode,
            allowNether: server.allowNether,
            enablePvp: server.enablePvp,
            enableCommandBlock: server.enableCommandBlock,
            worldType: server.worldType,
            onlineMode: server.onlineMode,
            enableWhitelist: server.enableWhitelist,
            serverPath: server.serverPath,
            jarFile: server.jarFile,
            lastStarted: server.lastStarted,
            lastStopped: server.lastStopped,
            createdAt: server.createdAt,
            updatedAt: server.updatedAt
          },
          runtime: {
            isRunning,
            stats: serverStats,
            consoleOutput: output
          }
        }
      });
    } catch (error) {
      console.error('Error fetching server management data:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch server data'
      });
    }
  });

  // Get server performance metrics
  router.get('/:serverId/metrics', AuthController.authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { serverId } = req.params;
      const server = await MinecraftServer.findOne({
        where: { 
          id: parseInt(serverId),
          userId: req.user!.id
        }
      });

      if (!server) {
        res.status(404).json({
          success: false,
          message: 'Server not found'
        });
        return;
      }

      const isRunning = serverControlService.isServerRunning(server.id);
      let metrics = null;

      if (isRunning) {
        const runningServer = serverControlService.getRunningServer(server.id);
        if (runningServer) {
          const status = runningServer.getStatus();
          const playerList = runningServer.getPlayerList();
          
          metrics = {
            status: status.status,
            uptime: status.uptime,
            playerCount: status.players,
            maxPlayers: status.maxPlayers,
            playerList,
            memoryUsage: status.memoryUsage,
            tps: status.tps,
            version: status.version
          };
        }
      }

      res.json({
        success: true,
        data: {
          serverId: server.id,
          isRunning,
          metrics
        }
      });
    } catch (error) {
      console.error('Error fetching server metrics:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch server metrics'
      });
    }
  });
}

export default ServerController;