import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Header.scss';

interface HeaderProps {
  onMenuToggle?: () => void;
}

function Header({ onMenuToggle }: HeaderProps) {
  const { authState, logout } = useAuth();
  const location = useLocation();

  const handleLogout = () => {
    logout();
  };

  return (
    <header className="header">
      <div className="header__brand">
        <button 
          className="header__menu-btn"
          onClick={onMenuToggle}
          aria-label="Toggle menu"
        >
          ☰
        </button>
        <span className="header__logo">IonMC Server Manager</span>
      </div>
      
      <nav className="header__nav">
        <Link to="/" className={`header__nav-item ${location.pathname === '/' ? 'header__nav-item--active' : ''}`}>
          Dashboard
        </Link>
        <Link to="/instances" className={`header__nav-item ${location.pathname === '/instances' ? 'header__nav-item--active' : ''}`}>
          Instances
        </Link>
        <Link to="/users" className={`header__nav-item ${location.pathname === '/users' ? 'header__nav-item--active' : ''}`}>
          Users
        </Link>
        <a href="#" className="header__nav-item">Daemons</a>
        <a href="#" className="header__nav-item">Settings</a>
      </nav>
      
      <div className="header__actions">
        <button className="header__action-btn" title="Notifications">
          🔔
        </button>
        <button className="header__action-btn" title="Terminal">
          📟
        </button>
        <div className="header__user-menu">
          <span className="header__username" title={authState.user?.email}>
            {authState.user?.username}
          </span>
          <button 
            className="header__action-btn header__logout-btn" 
            title="Logout"
            onClick={handleLogout}
          >
            �
          </button>
        </div>
        <button className="header__action-btn" title="Refresh">
          🔄
        </button>
      </div>
    </header>
  );
}

export default Header;