import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './ErrorLogsPage.scss';

interface ErrorLog {
  id: number;
  message: string;
  stackTrace: string | null;
  source: 'server' | 'client';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId: number | null;
  userAgent: string | null;
  url: string | null;
  method: string | null;
  statusCode: number | null;
  userInfo: string | null;
  errorCode: string | null;
  resolved: boolean;
  resolvedBy: number | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ErrorStats {
  totalErrors: number;
  unresolvedErrors: number;
  serverErrors: number;
  clientErrors: number;
  criticalErrors: number;
  recentErrors: number;
}

function ErrorLogsPage() {
  const { authState } = useAuth();
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);
  const [showModal, setShowModal] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    source: '',
    severity: '',
    resolved: '',
    page: 1,
    limit: 25
  });

  const apiUrl = '/api';

  useEffect(() => {
    if (!authState.user?.isAdmin) {
      setError('Admin access required');
      setLoading(false);
      return;
    }

    fetchErrorLogs();
    fetchErrorStats();
  }, [authState.user, filters]);

  const fetchErrorLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (filters.source) params.append('source', filters.source);
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.resolved) params.append('resolved', filters.resolved);
      params.append('page', filters.page.toString());
      params.append('limit', filters.limit.toString());

      const response = await fetch(`${apiUrl}/errors/logs?${params}`, {
        headers: {
          'Authorization': `Bearer ${authState.token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setErrorLogs(data.data.logs);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Failed to fetch error logs');
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchErrorStats = async () => {
    try {
      const response = await fetch(`${apiUrl}/errors/stats`, {
        headers: {
          'Authorization': `Bearer ${authState.token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const handleResolveError = async (errorId: number, resolve: boolean) => {
    try {
      const endpoint = resolve ? 'resolve' : 'unresolve';
      const response = await fetch(`${apiUrl}/errors/logs/${errorId}/${endpoint}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authState.token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        // Update the error log in the list
        setErrorLogs(logs => 
          logs.map(log => 
            log.id === errorId 
              ? { ...log, resolved: resolve, resolvedAt: resolve ? new Date().toISOString() : null }
              : log
          )
        );
        
        // Update selected error if it's open
        if (selectedError?.id === errorId) {
          setSelectedError({
            ...selectedError,
            resolved: resolve,
            resolvedAt: resolve ? new Date().toISOString() : null
          });
        }

        // Refresh stats
        fetchErrorStats();
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error('Error updating error status:', err);
      alert('Failed to update error status');
    }
  };

  const handleCleanupOldErrors = async () => {
    if (!confirm('This will delete all resolved errors older than 90 days. Are you sure?')) {
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/errors/cleanup?days=90`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authState.token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        alert(`Deleted ${data.data.deletedCount} old resolved errors`);
        fetchErrorLogs();
        fetchErrorStats();
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error('Error cleaning up logs:', err);
      alert('Failed to cleanup old errors');
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#dc3545';
      case 'high': return '#fd7e14';
      case 'medium': return '#ffc107';
      case 'low': return '#28a745';
      default: return '#6c757d';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const openErrorDetails = (errorLog: ErrorLog) => {
    setSelectedError(errorLog);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedError(null);
  };

  if (!authState.user?.isAdmin) {
    return (
      <div className="error-logs-page">
        <div className="error-logs-page__error">
          <h2>Access Denied</h2>
          <p>You need administrator privileges to view error logs.</p>
        </div>
      </div>
    );
  }

  if (loading && !errorLogs.length) {
    return (
      <div className="error-logs-page">
        <div className="error-logs-page__loading">Loading error logs...</div>
      </div>
    );
  }

  return (
    <div className="error-logs-page">
      {/* Header */}
      <div className="error-logs-page__header">
        <div className="error-logs-page__title-section">
          <h1>Error Logs</h1>
          <p>System error monitoring and management</p>
        </div>
        
        <div className="error-logs-page__actions">
          <button 
            className="error-logs-page__cleanup-btn"
            onClick={handleCleanupOldErrors}
          >
            🗑️ Cleanup Old Errors
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="error-logs-page__stats">
          <div className="error-logs-page__stat-card">
            <div className="error-logs-page__stat-number">{stats.totalErrors}</div>
            <div className="error-logs-page__stat-label">Total Errors</div>
          </div>
          <div className="error-logs-page__stat-card error-logs-page__stat-card--warning">
            <div className="error-logs-page__stat-number">{stats.unresolvedErrors}</div>
            <div className="error-logs-page__stat-label">Unresolved</div>
          </div>
          <div className="error-logs-page__stat-card error-logs-page__stat-card--danger">
            <div className="error-logs-page__stat-number">{stats.criticalErrors}</div>
            <div className="error-logs-page__stat-label">Critical</div>
          </div>
          <div className="error-logs-page__stat-card error-logs-page__stat-card--info">
            <div className="error-logs-page__stat-number">{stats.serverErrors}</div>
            <div className="error-logs-page__stat-label">Server Errors</div>
          </div>
          <div className="error-logs-page__stat-card error-logs-page__stat-card--info">
            <div className="error-logs-page__stat-number">{stats.clientErrors}</div>
            <div className="error-logs-page__stat-label">Client Errors</div>
          </div>
          <div className="error-logs-page__stat-card error-logs-page__stat-card--success">
            <div className="error-logs-page__stat-number">{stats.recentErrors}</div>
            <div className="error-logs-page__stat-label">Last 24h</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="error-logs-page__filters">
        <div className="error-logs-page__filter-group">
          <label>Source:</label>
          <select 
            value={filters.source} 
            onChange={(e) => setFilters({ ...filters, source: e.target.value, page: 1 })}
          >
            <option value="">All</option>
            <option value="server">Server</option>
            <option value="client">Client</option>
          </select>
        </div>

        <div className="error-logs-page__filter-group">
          <label>Severity:</label>
          <select 
            value={filters.severity} 
            onChange={(e) => setFilters({ ...filters, severity: e.target.value, page: 1 })}
          >
            <option value="">All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="error-logs-page__filter-group">
          <label>Status:</label>
          <select 
            value={filters.resolved} 
            onChange={(e) => setFilters({ ...filters, resolved: e.target.value, page: 1 })}
          >
            <option value="">All</option>
            <option value="false">Unresolved</option>
            <option value="true">Resolved</option>
          </select>
        </div>

        <div className="error-logs-page__filter-group">
          <label>Per Page:</label>
          <select 
            value={filters.limit} 
            onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value), page: 1 })}
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="error-logs-page__error">
          {error}
        </div>
      )}

      {/* Error logs table */}
      <div className="error-logs-page__table-container">
        <table className="error-logs-page__table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Source</th>
              <th>Severity</th>
              <th>Message</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {errorLogs.map((log) => (
              <tr key={log.id} className={log.resolved ? 'error-logs-page__row--resolved' : ''}>
                <td className="error-logs-page__cell--time">
                  {formatDate(log.createdAt)}
                </td>
                <td>
                  <span className={`error-logs-page__source-badge error-logs-page__source-badge--${log.source}`}>
                    {log.source}
                  </span>
                </td>
                <td>
                  <span 
                    className="error-logs-page__severity-badge"
                    style={{ backgroundColor: getSeverityColor(log.severity) }}
                  >
                    {log.severity}
                  </span>
                </td>
                <td className="error-logs-page__cell--message">
                  <span 
                    className="error-logs-page__message"
                    onClick={() => openErrorDetails(log)}
                    title="Click to view details"
                  >
                    {log.message.length > 100 ? `${log.message.substring(0, 100)}...` : log.message}
                  </span>
                </td>
                <td>
                  <span className={`error-logs-page__status-badge error-logs-page__status-badge--${log.resolved ? 'resolved' : 'unresolved'}`}>
                    {log.resolved ? 'Resolved' : 'Unresolved'}
                  </span>
                </td>
                <td className="error-logs-page__cell--actions">
                  <button
                    className="error-logs-page__action-btn error-logs-page__action-btn--view"
                    onClick={() => openErrorDetails(log)}
                    title="View details"
                  >
                    👁️
                  </button>
                  <button
                    className={`error-logs-page__action-btn ${log.resolved ? 'error-logs-page__action-btn--unresolve' : 'error-logs-page__action-btn--resolve'}`}
                    onClick={() => handleResolveError(log.id, !log.resolved)}
                    title={log.resolved ? 'Mark as unresolved' : 'Mark as resolved'}
                  >
                    {log.resolved ? '↶' : '✓'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Error details modal */}
      {showModal && selectedError && (
        <div className="error-logs-page__modal-overlay" onClick={closeModal}>
          <div className="error-logs-page__modal" onClick={(e) => e.stopPropagation()}>
            <div className="error-logs-page__modal-header">
              <h3>Error Details</h3>
              <button className="error-logs-page__modal-close" onClick={closeModal}>×</button>
            </div>
            
            <div className="error-logs-page__modal-content">
              <div className="error-logs-page__modal-section">
                <h4>Error Information</h4>
                <div className="error-logs-page__modal-grid">
                  <div><strong>ID:</strong> {selectedError.id}</div>
                  <div><strong>Source:</strong> {selectedError.source}</div>
                  <div><strong>Severity:</strong> 
                    <span 
                      className="error-logs-page__severity-badge"
                      style={{ backgroundColor: getSeverityColor(selectedError.severity), marginLeft: '8px' }}
                    >
                      {selectedError.severity}
                    </span>
                  </div>
                  <div><strong>Status:</strong> {selectedError.resolved ? 'Resolved' : 'Unresolved'}</div>
                  <div><strong>Created:</strong> {formatDate(selectedError.createdAt)}</div>
                  {selectedError.resolvedAt && (
                    <div><strong>Resolved:</strong> {formatDate(selectedError.resolvedAt)}</div>
                  )}
                </div>
              </div>

              <div className="error-logs-page__modal-section">
                <h4>Error Message</h4>
                <pre className="error-logs-page__modal-message">{selectedError.message}</pre>
              </div>

              {selectedError.stackTrace && (
                <div className="error-logs-page__modal-section">
                  <h4>Stack Trace</h4>
                  <pre className="error-logs-page__modal-stack">{selectedError.stackTrace}</pre>
                </div>
              )}

              {(selectedError.url || selectedError.method || selectedError.statusCode) && (
                <div className="error-logs-page__modal-section">
                  <h4>Request Information</h4>
                  <div className="error-logs-page__modal-grid">
                    {selectedError.url && <div><strong>URL:</strong> {selectedError.url}</div>}
                    {selectedError.method && <div><strong>Method:</strong> {selectedError.method}</div>}
                    {selectedError.statusCode && <div><strong>Status Code:</strong> {selectedError.statusCode}</div>}
                  </div>
                </div>
              )}

              {selectedError.userInfo && (
                <div className="error-logs-page__modal-section">
                  <h4>Additional Information</h4>
                  <pre className="error-logs-page__modal-user-info">
                    {JSON.stringify(JSON.parse(selectedError.userInfo), null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="error-logs-page__modal-actions">
              <button
                className={`error-logs-page__modal-btn ${selectedError.resolved ? 'error-logs-page__modal-btn--unresolve' : 'error-logs-page__modal-btn--resolve'}`}
                onClick={() => handleResolveError(selectedError.id, !selectedError.resolved)}
              >
                {selectedError.resolved ? 'Mark as Unresolved' : 'Mark as Resolved'}
              </button>
              <button className="error-logs-page__modal-btn error-logs-page__modal-btn--close" onClick={closeModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ErrorLogsPage;