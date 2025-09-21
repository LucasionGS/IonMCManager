import { useState, useEffect } from 'react';
import './DatabaseMigrationPage.scss';

interface MigrationStatus {
  canConnect: boolean;
  migrationsTableExists: boolean;
  totalMigrations: number;
  appliedCount: number;
  pendingCount: number;
  appliedMigrations: string[];
  pendingMigrations: string[];
  requiresSetup: boolean;
  error?: string;
}

interface MigrationResponse {
  success: boolean;
  message: string;
  data?: {
    appliedMigrations: string[];
    totalApplied: number;
  };
  error?: string;
}

function DatabaseMigrationPage() {
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  const checkStatus = async () => {
    try {
      setStatusLoading(true);
      const response = await fetch('/api/upgrade/status');
      const data = await response.json();
      
      if (data.success) {
        setStatus(data.data);
      } else {
        setStatus(data.data);
        showMessage(data.message, 'error');
      }
    } catch (error) {
      console.error('Error checking migration status:', error);
      showMessage('Failed to check migration status', 'error');
    } finally {
      setStatusLoading(false);
    }
  };

  const runMigrations = async () => {
    if (!password.trim()) {
      showMessage('Please enter the migration password', 'error');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/upgrade/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });
      
      const data: MigrationResponse = await response.json();
      
      if (data.success) {
        showMessage(data.message, 'success');
        setPassword(''); // Clear password on success
        // Refresh status after successful migration
        setTimeout(() => checkStatus(), 1000);
      } else {
        showMessage(data.message, 'error');
      }
    } catch (error) {
      console.error('Error running migrations:', error);
      showMessage('Failed to run migrations', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const getStatusColor = () => {
    if (!status) return 'warning';
    if (!status.canConnect) return 'error';
    if (status.requiresSetup) return 'warning';
    return 'success';
  };

  const getStatusText = () => {
    if (!status) return 'Checking...';
    if (!status.canConnect) return 'Cannot connect to database';
    if (status.requiresSetup) return 'Database setup required';
    return 'Database is up to date';
  };

  return (
    <div className="migration-page">
      <div className="migration-page__container">
        <header className="migration-page__header">
          <h1>Database Migration</h1>
          <p>Manage database schema updates and migrations</p>
        </header>

        {message && (
          <div className={`migration-page__message migration-page__message--${messageType}`}>
            {message}
          </div>
        )}

        <div className="migration-page__content">
          {/* Status Section */}
          <section className="migration-page__section">
            <h2>Database Status</h2>
            <div className="status-card">
              <div className="status-card__header">
                <div className={`status-indicator status-indicator--${getStatusColor()}`}>
                  <div className="status-indicator__dot"></div>
                  <span>{statusLoading ? 'Checking...' : getStatusText()}</span>
                </div>
                <button 
                  className="btn btn--secondary btn--small"
                  onClick={checkStatus}
                  disabled={statusLoading}
                >
                  {statusLoading ? 'Checking...' : 'Refresh'}
                </button>
              </div>

              {status && (
                <div className="status-card__details">
                  <div className="status-grid">
                    <div className="status-item">
                      <span className="status-item__label">Total Migrations</span>
                      <span className="status-item__value">{status.totalMigrations}</span>
                    </div>
                    <div className="status-item">
                      <span className="status-item__label">Applied</span>
                      <span className="status-item__value">{status.appliedCount}</span>
                    </div>
                    <div className="status-item">
                      <span className="status-item__label">Pending</span>
                      <span className="status-item__value status-item__value--warning">
                        {status.pendingCount}
                      </span>
                    </div>
                    <div className="status-item">
                      <span className="status-item__label">Connection</span>
                      <span className={`status-item__value ${status.canConnect ? 'status-item__value--success' : 'status-item__value--error'}`}>
                        {status.canConnect ? 'Connected' : 'Failed'}
                      </span>
                    </div>
                  </div>

                  {status.pendingMigrations.length > 0 && (
                    <div className="pending-migrations">
                      <h4>Pending Migrations:</h4>
                      <ul>
                        {status.pendingMigrations.map(migration => (
                          <li key={migration}>{migration}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {status.error && (
                    <div className="error-details">
                      <h4>Connection Error:</h4>
                      <code>{status.error}</code>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Migration Controls */}
          <section className="migration-page__section">
            <h2>Run Migrations</h2>
            <div className="migration-form">
              <div className="form-group">
                <label htmlFor="migration-password">Migration Password</label>
                <input
                  id="migration-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter migration password"
                  disabled={loading}
                  onKeyPress={(e) => e.key === 'Enter' && runMigrations()}
                />
                <small>This password is configured in the server environment variables.</small>
              </div>

              <div className="form-actions">
                <button
                  className="btn btn--primary"
                  onClick={runMigrations}
                  disabled={loading || !password.trim() || (status?.pendingCount === 0)}
                >
                  {loading ? 'Running Migrations...' : 'Update Database'}
                </button>
              </div>

              {status?.pendingCount === 0 && status?.canConnect && (
                <div className="migration-form__notice">
                  <p>✅ Database is already up to date. No migrations needed.</p>
                </div>
              )}
            </div>
          </section>

          {/* Information Section */}
          <section className="migration-page__section">
            <h2>Information</h2>
            <div className="info-card">
              <h4>About Database Migrations</h4>
              <ul>
                <li>Migrations ensure your database schema is up to date</li>
                <li>This page works independently of the main application</li>
                <li>Use this during initial setup or after system updates</li>
                <li>The migration password is configured in your server environment</li>
                <li>Always backup your database before running migrations</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default DatabaseMigrationPage;