import { Link, useLocation } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';
import { minecraftApiService, type ServerInstance } from '../services/minecraftApi';
import './Sidebar.scss';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { socket, isConnected } = useSocket();
  const { authState } = useAuth();
  const location = useLocation();
  const [servers, setServers] = useState<ServerInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  // Fetch user servers on component mount
  useEffect(() => {
    const fetchServers = async () => {
      try {
        setIsLoading(true);
        setError('');
        const userServers = await minecraftApiService.getUserServers();
        setServers(userServers);
      } catch (err) {
        console.error('Error fetching servers:', err);
        setError(err instanceof Error ? err.message : 'Failed to load servers');
      } finally {
        setIsLoading(false);
      }
    };

    fetchServers();
  }, []);

  // Listen for real-time server status updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleServerStatusUpdate = (data: { serverId: number; status: string }) => {
      setServers(prevServers => 
        prevServers.map(server => 
          server.id === data.serverId 
            ? { ...server, status: data.status as ServerInstance['status'] }
            : server
        )
      );
    };

    socket.on('serverStatusUpdate', handleServerStatusUpdate);

    return () => {
      socket.off('serverStatusUpdate', handleServerStatusUpdate);
    };
  }, [socket, isConnected]);

  const handleServerControl = async (serverId: number, action: 'start' | 'stop') => {
    if (!socket) return;
    
    try {
      await minecraftApiService.controlServer(serverId, action);
      // Update optimistically
      setServers(prevServers => 
        prevServers.map(server => 
          server.id === serverId 
            ? { ...server, status: action === 'start' ? 'starting' : 'stopping' }
            : server
        )
      );
    } catch (err) {
      console.error(`Error ${action}ing server:`, err);
    }
  };

  const handleLinkClick = () => {
    // Close sidebar on mobile when clicking a link
    if (onClose) {
      onClose();
    }
  };

  const getStatusColor = (status: ServerInstance['status']) => {
    switch (status) {
      case 'running': return '#10b981';
      case 'stopped': return '#6b7280';
      case 'starting': return '#f97316';
      case 'stopping': return '#f97316';
      case 'crashed': return '#ef4444';
      case 'error': return '#ef4444';
      case 'creating': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  return (
    <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
      <div className="sidebar__section">
        <h3 className="sidebar__title">Control Panel</h3>
        <nav className="sidebar__nav">
          <Link 
            to="/" 
            className={`sidebar__nav-item ${location.pathname === '/' ? 'sidebar__nav-item--active' : ''}`}
            onClick={handleLinkClick}
          >
            Dashboard
          </Link>
          <Link 
            to="/instances" 
            className={`sidebar__nav-item ${location.pathname === '/instances' ? 'sidebar__nav-item--active' : ''}`}
            onClick={handleLinkClick}
          >
            Instances
          </Link>
          {/* Admin-only navigation */}
          {authState.user?.isAdmin && (
            <Link 
              to="/users" 
              className={`sidebar__nav-item ${location.pathname === '/users' ? 'sidebar__nav-item--active' : ''}`}
              onClick={handleLinkClick}
            >
              👥 Users
            </Link>
          )}
        </nav>
      </div>
      
      <div className="sidebar__section">
        <div className="sidebar__connection-status">
          <span className={`sidebar__status-indicator ${isConnected ? 'sidebar__status-indicator--connected' : 'sidebar__status-indicator--disconnected'}`}></span>
          <span className="sidebar__connection-text">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
      
      <div className="sidebar__section">
        <h4 className="sidebar__section-title">My Servers</h4>
        
        {isLoading && (
          <div className="sidebar__loading">
            <div className="loading-spinner"></div>
            <span>Loading servers...</span>
          </div>
        )}
        
        {error && (
          <div className="sidebar__error">
            <span>⚠️ {error}</span>
          </div>
        )}
        
        {!isLoading && !error && servers.length === 0 && (
          <div className="sidebar__empty">
            <span>No servers found</span>
            <Link to="/instances" onClick={handleLinkClick}>
              Create one
            </Link>
          </div>
        )}
        
        {servers.map(server => (
          <div key={server.id} className="sidebar__instance-info">
            <div className="sidebar__instance-status">
              <span 
                className="sidebar__status-indicator"
                style={{ backgroundColor: getStatusColor(server.status) }}
              ></span>
              <Link
                to={`/servers/${server.id}/manage`}
                className="sidebar__instance-name"
                onClick={handleLinkClick}
              >
                {server.name}
              </Link>
            </div>
            <div className="sidebar__instance-actions">
              {server.status === 'stopped' || server.status === 'crashed' || server.status === 'error' ? (
                <button 
                  className="sidebar__action-btn sidebar__action-btn--start"
                  onClick={() => handleServerControl(server.id, 'start')}
                  disabled={!isConnected}
                >
                  Start
                </button>
              ) : server.status === 'running' ? (
                <button 
                  className="sidebar__action-btn sidebar__action-btn--stop"
                  onClick={() => handleServerControl(server.id, 'stop')}
                  disabled={!isConnected}
                >
                  Stop
                </button>
              ) : (
                <button 
                  className="sidebar__action-btn"
                  disabled
                >
                  {server.status === 'starting' ? 'Starting...' : 'Stopping...'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

export default Sidebar;