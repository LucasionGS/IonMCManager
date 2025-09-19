import { useSocket } from '../contexts/SocketContext';
import './Sidebar.scss';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const { socket, isConnected } = useSocket();

  const handleServerControl = (action: 'start' | 'stop' | 'restart') => {
    if (socket) {
      socket.emit('server-control', {
        serverId: 'minecraft-01',
        action
      });
    }
  };

  const handleLinkClick = () => {
    // Close sidebar on mobile when clicking a link
    if (onClose) {
      onClose();
    }
  };

  return (
    <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
      <div className="sidebar__section">
        <h3 className="sidebar__title">Control Panel</h3>
        <nav className="sidebar__nav">
          <a 
            href="#" 
            className="sidebar__nav-item sidebar__nav-item--active"
            onClick={handleLinkClick}
          >
            Instances
          </a>
          <a 
            href="#" 
            className="sidebar__nav-item"
            onClick={handleLinkClick}
          >
            Terminal
          </a>
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
        <div className="sidebar__instance-info">
          <div className="sidebar__instance-status">
            <span className="sidebar__status-indicator sidebar__status-indicator--running"></span>
            <span className="sidebar__instance-name">My Minecraft 01</span>
          </div>
          <div className="sidebar__instance-actions">
            <button 
              className="sidebar__action-btn sidebar__action-btn--stop"
              onClick={() => handleServerControl('stop')}
              disabled={!isConnected}
            >
              Stop
            </button>
            <button 
              className="sidebar__action-btn sidebar__action-btn--restart"
              onClick={() => handleServerControl('restart')}
              disabled={!isConnected}
            >
              Restart
            </button>
            <button 
              className="sidebar__action-btn sidebar__action-btn--terminate"
              onClick={() => handleServerControl('stop')}
              disabled={!isConnected}
            >
              Terminate
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;