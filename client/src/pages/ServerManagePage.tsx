import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import minecraftApiService from '../services/minecraftApi';
import ModsList from '../components/ModsList';
import ModUpload from '../components/ModUpload';
import CurseForgeModBrowser from '../components/CurseForgeModBrowser';
import './ServerManagePage.scss';

interface ServerData {
  id: number;
  name: string;
  description?: string;
  minecraftVersion: string;
  serverType: string;
  forgeVersion?: string;
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'crashed' | 'creating' | 'error';
  memory: number;
  port?: number;
  maxPlayers: number;
  motd?: string;
  difficulty: 'peaceful' | 'easy' | 'normal' | 'hard';
  gamemode: 'survival' | 'creative' | 'adventure' | 'spectator';
  allowNether: boolean;
  enablePvp: boolean;
  enableCommandBlock: boolean;
  worldType: string;
  onlineMode: boolean;
  enableWhitelist: boolean;
  serverPath?: string;
  jarFile?: string;
  lastStarted?: string;
  lastStopped?: string;
  createdAt: string;
  updatedAt: string;
}

interface ServerStats {
  status: string;
  players: number;
  maxPlayers: number;
  version: string;
  uptime: number;
  memoryUsage: number;
  tps: number;
}

interface RuntimeData {
  isRunning: boolean;
  stats?: ServerStats;
  consoleOutput: string[];
}

function ServerManagePage() {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  
  const [serverData, setServerData] = useState<ServerData | null>(null);
  const [runtimeData, setRuntimeData] = useState<RuntimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [commandInput, setCommandInput] = useState('');
  const [isCommandLoading, setIsCommandLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'console' | 'mods' | 'settings'>('console');
  
  // Mod management state
  const [mods, setMods] = useState<{ enabled: any[], disabled: any[] } | null>(null);
  const [modLoading, setModLoading] = useState(false);
  const [modError, setModError] = useState('');
  
  const consoleRef = useRef<HTMLDivElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll console to bottom
  const scrollToBottom = () => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  };

  // Load server data
  useEffect(() => {
    if (!serverId) {
      navigate('/instances');
      return;
    }

    const loadServerData = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await minecraftApiService.getServerManagementData(parseInt(serverId));
        setServerData(data.server);
        setRuntimeData(data.runtime);
        setConsoleOutput(data.runtime.consoleOutput || []);
      } catch (err) {
        console.error('Error loading server data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load server data');
      } finally {
        setLoading(false);
      }
    };

    loadServerData();
  }, [serverId, navigate]);

  // Load mods for Forge and NeoForge servers
  const loadMods = async () => {
    if (!serverId || (serverData?.serverType !== 'forge' && serverData?.serverType !== 'neoforge')) return;
    
    try {
      setModLoading(true);
      setModError('');
      const response = await minecraftApiService.getServerMods(serverId);
      if (response.enabled && response.disabled) {
        setMods(response.enabled && response.disabled ? response : { enabled: [], disabled: [] });
      } else {
        setModError((response as any)?.message || 'Failed to load mods');
      }
    } catch (err) {
      console.error('Error loading mods:', err);
      setModError('Failed to load mods');
    } finally {
      setModLoading(false);
    }
  };

  // Load mods when server data is loaded and it's a modded server
  useEffect(() => {
    if (serverData?.serverType === 'forge' || serverData?.serverType === 'neoforge') {
      loadMods();
    }
  }, [serverData]);

  // Mod management handlers
  const handleUploadMods = async (files: File[]) => {
    if (!serverId) return;
    try {
      await minecraftApiService.uploadMods(serverId, files);
      await loadMods();
    } catch (error) {
      setModError('Failed to upload mods');
    }
  };

  const handleInstallFromCurseForge = async (modId: number, fileId?: number) => {
    if (!serverId) return;
    try {
      await minecraftApiService.installModFromCurseForge(serverId, modId, fileId);
      await loadMods();
    } catch (error) {
      setModError('Failed to install mod from CurseForge');
    }
  };

  const handleInstallFromManifest = async (manifest: any) => {
    if (!serverId) return;
    try {
      // Implement manifest installation
      console.log('Installing mod from manifest:', manifest);
      await loadMods();
    } catch (error) {
      setModError('Failed to install mod from manifest');
    }
  };

  const handleSearchMods = async (query: string, gameVersion?: string, pageSize?: number, index?: number) => {
    if (!serverId) throw new Error('Server ID not available');
    return await minecraftApiService.searchCurseForgeMods(serverId, query, gameVersion, undefined, pageSize || 20, index || 0);
  };

  const handleDeleteMod = async (filename: string) => {
    if (!serverId) return;
    try {
      await minecraftApiService.deleteMod(serverId, filename);
      await loadMods();
    } catch (error) {
      setModError('Failed to delete mod');
    }
  };

  const handleEnableMod = async (filename: string) => {
    if (!serverId) return;
    try {
      await minecraftApiService.enableMod(serverId, filename);
      await loadMods();
    } catch (error) {
      setModError('Failed to enable mod');
    }
  };

  const handleDisableMod = async (filename: string) => {
    if (!serverId) return;
    try {
      await minecraftApiService.disableMod(serverId, filename);
      await loadMods();
    } catch (error) {
      setModError('Failed to disable mod');
    }
  };

  // Auto-scroll when console output changes
  useEffect(() => {
    scrollToBottom();
  }, [consoleOutput]);

  // Socket.IO event listeners for real-time updates
  useEffect(() => {
    if (!socket || !isConnected || !serverId) return;

    const serverIdNum = parseInt(serverId);

    // Server status updates
    const handleServerStatusUpdate = (data: {
      serverId: number;
      status: string;
      timestamp: string;
    }) => {
      if (data.serverId === serverIdNum) {
        setServerData(prev => prev ? { ...prev, status: data.status as ServerData['status'] } : null);
        setRuntimeData(prev => prev ? { ...prev, isRunning: data.status === 'running' } : null);
      }
    };

    // Console output updates
    const handleConsoleOutput = (data: {
      serverId: number;
      output: string;
      timestamp: string;
    }) => {
      if (data.serverId === serverIdNum) {
        setConsoleOutput(prev => [...prev, `[${new Date(data.timestamp).toLocaleTimeString()}] ${data.output}`]);
      }
    };

    // Player activity
    const handlePlayerActivity = (data: {
      serverId: number;
      action: 'join' | 'leave';
      playerName: string;
      timestamp: string;
    }) => {
      if (data.serverId === serverIdNum) {
        // Update player count in runtime data if available
        // This could be enhanced to maintain a real player list
      }
    };

    socket.on('serverStatusUpdate', handleServerStatusUpdate);
    socket.on('serverConsoleOutput', handleConsoleOutput);
    socket.on('playerActivity', handlePlayerActivity);

    return () => {
      socket.off('serverStatusUpdate', handleServerStatusUpdate);
      socket.off('serverConsoleOutput', handleConsoleOutput);
      socket.off('playerActivity', handlePlayerActivity);
    };
  }, [socket, isConnected, serverId]);

  const handleServerAction = async (action: 'start' | 'stop') => {
    if (!serverData || !socket) return;
    
    try {
      setError('');
      await minecraftApiService.controlServer(serverData.id, action);
      
      // Update status optimistically
      const newStatus = action === 'start' ? 'starting' : 'stopping';
      setServerData(prev => prev ? { ...prev, status: newStatus } : null);
    } catch (err) {
      console.error(`Error ${action}ing server:`, err);
      setError(err instanceof Error ? err.message : `Failed to ${action} server`);
    }
  };

  const handleSendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim() || !serverData || !runtimeData?.isRunning) return;

    try {
      setIsCommandLoading(true);
      setError('');
      
      await minecraftApiService.sendAdminCommand(serverData.id, commandInput.trim());
      
      // Add command to console output immediately
      setConsoleOutput(prev => [
        ...prev, 
        `[${new Date().toLocaleTimeString()}] > ${commandInput.trim()}`
      ]);
      
      setCommandInput('');
      commandInputRef.current?.focus();
    } catch (err) {
      console.error('Error sending command:', err);
      setError(err instanceof Error ? err.message : 'Failed to send command');
    } finally {
      setIsCommandLoading(false);
    }
  };

  const getStatusColor = (status: ServerData['status']) => {
    switch (status) {
      case 'running': return '#22c55e';
      case 'stopped': return '#6b7280';
      case 'starting': return '#f97316';
      case 'stopping': return '#f97316';
      case 'creating': return '#3b82f6';
      case 'crashed':
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const formatUptime = (uptimeMs: number) => {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatMemory = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb.toFixed(0)} MB`;
  };

  // Helper function to detect log level and return appropriate CSS class
  const getLogLevelClass = (line: string): string => {
    const upperLine = line.toUpperCase();
    if (upperLine.includes('[ERROR]') || upperLine.includes('ERROR:') || upperLine.includes('SEVERE:')) {
      return 'console-line--error';
    }
    if (upperLine.includes('[WARN]') || upperLine.includes('WARNING:') || upperLine.includes('WARN:')) {
      return 'console-line--warning';
    }
    if (upperLine.includes('[INFO]') || upperLine.includes('INFO:')) {
      return 'console-line--info';
    }
    if (upperLine.includes('[DEBUG]') || upperLine.includes('DEBUG:')) {
      return 'console-line--debug';
    }
    return '';
  };

  // Helper functions for button states and text
  const getStartButtonText = () => {
    switch (serverData?.status) {
      case 'starting': return '⏳ Starting...';
      case 'running': return '✓ Running';
      default: return '▶ Start';
    }
  };

  const getStopButtonText = () => {
    switch (serverData?.status) {
      case 'stopping': return '⏳ Stopping...';
      case 'stopped': return '✓ Stopped';
      default: return '⏹ Stop';
    }
  };

  if (loading) {
    return (
      <div className="server-manage-page">
        <div className="server-manage-page__loading">
          <div className="loading-spinner"></div>
          <p>Loading server...</p>
        </div>
      </div>
    );
  }

  if (!serverData) {
    return (
      <div className="server-manage-page">
        <div className="server-manage-page__error">
          <h2>Server not found</h2>
          <button onClick={() => navigate('/instances')}>Back to Instances</button>
        </div>
      </div>
    );
  }

  return (
    <div className="server-manage-page">
      <div className="server-manage-page__header">
        <div className="server-manage-page__title-section">
          <button 
            className="back-button"
            onClick={() => navigate('/instances')}
          >
            ← Back
          </button>
          <h1>{serverData.name}</h1>
          <div className="server-status">
            <span 
              className="status-indicator"
              style={{ backgroundColor: getStatusColor(serverData.status) }}
            ></span>
            <span className="status-text">
              {serverData.status.charAt(0).toUpperCase() + serverData.status.slice(1)}
            </span>
          </div>
        </div>
        
        <div className="server-manage-page__connection-status">
          <span 
            className={`connection-indicator ${isConnected ? 'connected' : 'disconnected'}`}
            title={isConnected ? 'Real-time updates active' : 'Real-time updates disconnected'}
          >
            {isConnected ? '🟢' : '🔴'} {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {error && (
        <div className="server-manage-page__error">
          {error}
        </div>
      )}

      <div className="server-manage-page__content">
        <div className="server-manage-page__left">
          {/* Server Controls */}
          <div className="control-panel">
            <h3>Server Controls</h3>
            <div className="control-buttons">
              <button 
                className="control-btn start"
                onClick={() => handleServerAction('start')}
                disabled={
                  serverData.status === 'running' || 
                  serverData.status === 'starting' || 
                  serverData.status === 'stopping' ||
                  serverData.status === 'creating'
                }
              >
                {getStartButtonText()}
              </button>
              <button 
                className="control-btn stop"
                onClick={() => handleServerAction('stop')}
                disabled={
                  serverData.status === 'stopped' || 
                  serverData.status === 'stopping' || 
                  serverData.status === 'starting' ||
                  serverData.status === 'creating' ||
                  serverData.status === 'crashed' ||
                  serverData.status === 'error'
                }
              >
                {getStopButtonText()}
              </button>
            </div>
          </div>

          {/* Server Info */}
          <div className="server-info">
            <h3>Server Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Version:</span>
                <span className="value">{serverData.minecraftVersion}</span>
              </div>
              <div className="info-item">
                <span className="label">Type:</span>
                <span className="value">{serverData.serverType}</span>
              </div>
              {serverData.forgeVersion && (
                <div className="info-item">
                  <span className="label">Forge:</span>
                  <span className="value">{serverData.forgeVersion}</span>
                </div>
              )}
              <div className="info-item">
                <span className="label">Memory:</span>
                <span className="value">{serverData.memory} MB</span>
              </div>
              <div className="info-item">
                <span className="label">Port:</span>
                <span className="value">{serverData.port || 25565}</span>
              </div>
              <div className="info-item">
                <span className="label">Max Players:</span>
                <span className="value">{serverData.maxPlayers}</span>
              </div>
              <div className="info-item">
                <span className="label">Difficulty:</span>
                <span className="value">{serverData.difficulty}</span>
              </div>
              <div className="info-item">
                <span className="label">Game Mode:</span>
                <span className="value">{serverData.gamemode}</span>
              </div>
            </div>
          </div>

          {/* Runtime Stats */}
          {runtimeData?.isRunning && runtimeData.stats && (
            <div className="runtime-stats">
              <h3>Runtime Statistics</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">Uptime:</span>
                  <span className="stat-value">{formatUptime(runtimeData.stats.uptime)}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Players:</span>
                  <span className="stat-value">{runtimeData.stats.players}/{runtimeData.stats.maxPlayers}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">TPS:</span>
                  <span className="stat-value">{runtimeData.stats.tps.toFixed(1)}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Memory:</span>
                  <span className="stat-value">{formatMemory(runtimeData.stats.memoryUsage)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="server-manage-page__right">
          {/* Tab Navigation */}
          <div className="tab-navigation">
            <button 
              className={`tab-btn ${activeTab === 'console' ? 'active' : ''}`}
              onClick={() => setActiveTab('console')}
            >
              Console
            </button>
            {(serverData?.serverType === 'forge' || serverData?.serverType === 'neoforge') && (
              <button 
                className={`tab-btn ${activeTab === 'mods' ? 'active' : ''}`}
                onClick={() => setActiveTab('mods')}
              >
                Mods
              </button>
            )}
            <button 
              className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              Settings
            </button>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {activeTab === 'console' && (
              <div className="console-panel">
                <div className="console-output" ref={consoleRef}>
                  {consoleOutput.length === 0 ? (
                    <div className="console-empty">
                      {runtimeData?.isRunning ? 'Waiting for output...' : 'Server is not running'}
                    </div>
                  ) : (
                    consoleOutput.map((line, index) => (
                      <div key={index} className={`console-line ${getLogLevelClass(line)}`}>
                        {line}
                      </div>
                    ))
                  )}
                </div>
                
                {runtimeData?.isRunning && (
                  <form className="console-input" onSubmit={handleSendCommand}>
                    <input
                      ref={commandInputRef}
                      type="text"
                      value={commandInput}
                      onChange={(e) => setCommandInput(e.target.value)}
                      placeholder="Enter server command..."
                      disabled={isCommandLoading}
                    />
                    <button type="submit" disabled={isCommandLoading || !commandInput.trim()}>
                      {isCommandLoading ? '...' : 'Send'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {activeTab === 'mods' && (serverData?.serverType === 'forge' || serverData?.serverType === 'neoforge') && (
              <div className="mods-panel">
                {modError && (
                  <div className="error-message">{modError}</div>
                )}
                <div className="mods-section">
                  <ModUpload 
                    onUploadMods={handleUploadMods}
                    onInstallFromCurseForge={handleInstallFromCurseForge}
                    onInstallFromManifest={handleInstallFromManifest}
                    loading={modLoading}
                  />
                </div>
                <div className="mods-section">
                  <CurseForgeModBrowser 
                    onInstallMod={handleInstallFromCurseForge}
                    onSearchMods={handleSearchMods}
                    gameVersion={serverData.minecraftVersion}
                    loading={modLoading}
                  />
                </div>
                <div className="mods-section">
                  {mods && (
                    <ModsList 
                      mods={mods}
                      onDeleteMod={handleDeleteMod}
                      onEnableMod={handleEnableMod}
                      onDisableMod={handleDisableMod}
                      loading={modLoading}
                    />
                  )}
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="settings-panel">
                <p>Server settings panel coming soon...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ServerManagePage;