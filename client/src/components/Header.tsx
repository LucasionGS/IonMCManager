import './Header.scss';

interface HeaderProps {
  onMenuToggle?: () => void;
}

function Header({ onMenuToggle }: HeaderProps) {
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
        <a href="#" className="header__nav-item header__nav-item--active">Dashboard</a>
        <a href="#" className="header__nav-item">Instances</a>
        <a href="#" className="header__nav-item">Users</a>
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
        <button className="header__action-btn" title="Account">
          👤
        </button>
        <button className="header__action-btn" title="Refresh">
          🔄
        </button>
      </div>
    </header>
  );
}

export default Header;