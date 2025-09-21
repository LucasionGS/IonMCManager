import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CreateServerForm from '../components/CreateServerForm';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import minecraftApiService from '../services/minecraftApi';
import './InstancesPage.scss';

interface ServerInstance {
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
  lastStarted?: string;
  lastStopped?: string;
  uptime: string;
  uptimeHours: number;
  createdAt: string;
  updatedAt: string;
}

function InstancesPage() {
  const { authState } = useAuth();
  const { socket, isConnected } = useSocket();
  const navigate = useNavigate();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [servers, setServers] = useState<ServerInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Load user's servers
  useEffect(() => {
    const loadServers = async () => {
      try {
        setIsLoading(true);
        setError('');
        const userServers = await minecraftApiService.getUserServers();
        setServers(userServers);
      } catch (err) {
        console.error('Error loading servers:', err);
        setError(err instanceof Error ? err.message : 'Failed to load servers');
      } finally {
        setIsLoading(false);
      }
    };

    loadServers();
  }, []);

  // Socket.IO event listeners for real-time updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Listen for server status updates
    const handleServerStatusUpdate = (data: {
      serverId: number;
      status: string;
      timestamp: string;
      exitCode?: number;
      error?: string;
    }) => {
      setServers(prev => prev.map(server => 
        server.id === data.serverId 
          ? { 
              ...server, 
              status: data.status as ServerInstance['status'],
              ...(data.status === 'stopped' && { lastStopped: data.timestamp }),
              ...(data.status === 'running' && { lastStarted: data.timestamp })
            }
          : server
      ));
    };

    // Listen for player activity
    const handlePlayerActivity = (data: {
      serverId: number;
      action: 'join' | 'leave';
      playerName: string;
      timestamp: string;
    }) => {
      // Could update player count or show notifications
      console.log(`Player ${data.playerName} ${data.action}ed server ${data.serverId}`);
    };

    // Listen for console output (could be used for a console component later)
    const handleConsoleOutput = (data: {
      serverId: number;
      output: string;
      timestamp: string;
    }) => {
      // For now, just log it - could be used for a console component
      console.log(`[Server ${data.serverId}] ${data.output}`);
    };

    // Register event listeners
    socket.on('serverStatusUpdate', handleServerStatusUpdate);
    socket.on('playerActivity', handlePlayerActivity);
    socket.on('serverConsoleOutput', handleConsoleOutput);

    // Cleanup listeners on unmount or socket change
    return () => {
      socket.off('serverStatusUpdate', handleServerStatusUpdate);
      socket.off('playerActivity', handlePlayerActivity);
      socket.off('serverConsoleOutput', handleConsoleOutput);
    };
  }, [socket, isConnected]);

  const handleCreateServer = () => {
    setShowCreateForm(true);
  };

  const handleCloseCreateForm = () => {
    setShowCreateForm(false);
  };

  const handleServerCreated = async (serverData: any) => {
    console.log('Server created:', serverData);
    setShowCreateForm(false);
    
    // Refresh server list
    try {
      const userServers = await minecraftApiService.getUserServers();
      setServers(userServers);
    } catch (err) {
      console.error('Error refreshing servers:', err);
    }
  };

  const handleServerAction = async (serverId: number, action: 'start' | 'stop' | 'restart' | 'delete') => {
    try {
      setError('');
      
      if (action === 'delete') {
        if (confirm('Are you sure you want to delete this server? This action cannot be undone.')) {
          await minecraftApiService.deleteServer(serverId);
          setServers(prev => prev.filter(s => s.id !== serverId));
        }
      } else {
        // Optimistically update to show immediate feedback
        setServers(prev => prev.map(server => 
          server.id === serverId 
            ? { ...server, status: action === 'start' ? 'starting' : action === 'stop' ? 'stopping' : 'stopping' }
            : server
        ));
        
        await minecraftApiService.controlServer(serverId, action);
        
        // The actual status will be updated via Socket.IO events
        // No need for manual refresh since we listen to serverStatusUpdate
      }
    } catch (err) {
      console.error(`Error ${action}ing server:`, err);
      setError(err instanceof Error ? err.message : `Failed to ${action} server`);
      
      // Refresh servers to get actual status if there was an error
      try {
        const userServers = await minecraftApiService.getUserServers();
        setServers(userServers);
      } catch (refreshErr) {
        console.error('Error refreshing servers after failed action:', refreshErr);
      }
    }
  };

  const getStatusColor = (status: ServerInstance['status']) => {
    switch (status) {
      case 'running': return '#22c55e'; // green
      case 'stopped': return '#6b7280'; // gray
      case 'starting': return '#f97316'; // orange
      case 'stopping': return '#f97316'; // orange
      case 'creating': return '#3b82f6'; // blue
      case 'crashed':
      case 'error': return '#ef4444'; // red
      default: return '#6b7280'; // gray
    }
  };

  const getStatusText = (status: ServerInstance['status']) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (showCreateForm) {
    return (
      <div className="instances-page">
        <div className="instances-page__overlay">
          <CreateServerForm 
            onClose={handleCloseCreateForm}
            onServerCreated={handleServerCreated}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="instances-page">
      <div className="instances-page__header">
        <div className="instances-page__title-section">
          <h1>Server Instances</h1>
          <p>Manage your Minecraft servers</p>
          <div className="instances-page__connection-status">
            <span 
              className={`connection-indicator ${isConnected ? 'connected' : 'disconnected'}`}
              title={isConnected ? 'Real-time updates active' : 'Real-time updates disconnected'}
            >
              {isConnected ? '🟢' : '🔴'} {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
        <button 
          className="instances-page__create-btn"
          onClick={handleCreateServer}
        >
          + Create Server
        </button>
      </div>

      {error && (
        <div className="instances-page__error">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="instances-page__loading">
          <div className="loading-spinner"></div>
          <p>Loading your servers...</p>
        </div>
      ) : (
        <div className="instances-page__content">
          {servers.length === 0 ? (
            <div className="instances-page__empty">
              <div className="instances-page__empty-icon">🎮</div>
              <h2>No servers yet</h2>
              <p>Create your first Minecraft server to get started!</p>
              <button 
                className="instances-page__empty-create-btn"
                onClick={handleCreateServer}
              >
                Create Your First Server
              </button>
            </div>
          ) : (
            <div className="instances-page__grid">
              {servers.map(server => (
                <div key={server.id} className="server-card">
                  <div className="server-card__header">
                    <div className="server-card__title">
                      <h3>{server.name}</h3>
                      <div 
                        className="server-card__status"
                        style={{ color: getStatusColor(server.status) }}
                      >
                        <span className="server-card__status-dot" style={{ backgroundColor: getStatusColor(server.status) }}></span>
                        {getStatusText(server.status)}
                      </div>
                    </div>
                    <div className="server-card__info">
                      <span className="server-card__version">{server.minecraftVersion}</span>
                      <span className="server-card__type">{server.serverType}</span>
                    </div>
                  </div>

                  <div className="server-card__details">
                    {server.description && (
                      <p className="server-card__description">{server.description}</p>
                    )}
                    
                    <div className="server-card__stats">
                      <div className="server-card__stat">
                        <span className="server-card__stat-label">Memory:</span>
                        <span className="server-card__stat-value">{server.memory} MB</span>
                      </div>
                      
                      <div className="server-card__stat">
                        <span className="server-card__stat-label">Players:</span>
                        <span className="server-card__stat-value">
                          ?/{server.maxPlayers || '?'}
                        </span>
                      </div>
                      
                      <div className="server-card__stat">
                        <span className="server-card__stat-label">Created:</span>
                        <span className="server-card__stat-value">{formatDate(server.createdAt)}</span>
                      </div>
                      
                      {server.lastStarted && (
                        <div className="server-card__stat">
                          <span className="server-card__stat-label">Last Started:</span>
                          <span className="server-card__stat-value">{formatDate(server.lastStarted)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="server-card__actions">
                    {server.status === 'stopped' && (
                      <button 
                        className="server-card__action server-card__action--start"
                        onClick={() => handleServerAction(server.id, 'start')}
                      >
                        Start
                      </button>
                    )}
                    
                    {(server.status === 'running' || server.status === 'starting') && (
                      <button 
                        className="server-card__action server-card__action--stop"
                        onClick={() => handleServerAction(server.id, 'stop')}
                      >
                        Stop
                      </button>
                    )}
                    
                    {/* {server.status === 'running' && (
                      <button 
                        className="server-card__action server-card__action--restart"
                        onClick={() => handleServerAction(server.id, 'restart')}
                      >
                        Restart
                      </button>
                    )} */}
                    
                    <button 
                      className="server-card__action server-card__action--manage"
                      onClick={() => navigate(`/servers/${server.id}/manage`)}
                    >
                      Manage
                    </button>
                    
                    <button 
                      className="server-card__action server-card__action--delete"
                      onClick={() => handleServerAction(server.id, 'delete')}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default InstancesPage;