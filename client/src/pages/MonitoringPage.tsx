import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { minecraftApiService } from '../services/minecraftApi';
import './MonitoringPage.scss';

interface SystemMetrics {
  id: number;
  timestamp: string;
  cpuUsage: number;
  memoryUsage: number;
  memoryTotal: number;
  memoryUsed: number;
  diskUsage: number;
  diskTotal: number;
  diskUsed: number;
  networkRxBytes: number;
  networkTxBytes: number;
  loadAverage: number;
  activeConnections: number;
  runningServers: number;
  createdAt: string;
  updatedAt: string;
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  issues: string[];
  lastUpdated: string;
  currentMetrics: {
    cpu: number;
    memory: number;
    disk: number;
    load: number;
    activeConnections: number;
    runningServers: number;
  };
}

interface AverageMetrics {
  avgCpuUsage: number;
  avgMemoryUsage: number;
  avgDiskUsage: number;
  avgLoadAverage: number;
  maxCpuUsage: number;
  maxMemoryUsage: number;
  avgActiveConnections: number;
  avgRunningServers: number;
}

function MonitoringPage() {
  const { authState } = useAuth();
  const { socket } = useSocket();
  const [currentMetrics, setCurrentMetrics] = useState<SystemMetrics | null>(null);
  const [metricsHistory, setMetricsHistory] = useState<SystemMetrics[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [averages, setAverages] = useState<AverageMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [selectedTimeRange, setSelectedTimeRange] = useState<number>(24); // hours
  const metricsRef = useRef<SystemMetrics[]>([]);

  // Helper function to safely convert values to numbers
  const toNumber = (value: any): number => {
    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    return isNaN(num) ? 0 : num;
  };

  // Helper function to safely format numbers
  const safeToFixed = (value: any, decimals: number = 1): string => {
    const num = toNumber(value);
    return num.toFixed(decimals);
  };

  useEffect(() => {
    if (!authState.user?.isAdmin) {
      setError('Admin access required');
      setIsLoading(false);
      return;
    }

    fetchData();
    
    // Set up real-time metrics listener
    if (socket) {
      socket.on('system_metrics', handleRealTimeMetrics);
      return () => {
        socket.off('system_metrics', handleRealTimeMetrics);
      };
    }
  }, [authState.user, socket]);

  useEffect(() => {
    if (selectedTimeRange) {
      fetchAverageMetrics();
    }
  }, [selectedTimeRange]);

  const handleRealTimeMetrics = (metrics: any) => {
    const newMetric: SystemMetrics = {
      id: Date.now(), // Temporary ID for real-time data
      timestamp: metrics.timestamp,
      cpuUsage: toNumber(metrics.cpuUsage),
      memoryUsage: toNumber(metrics.memoryUsage),
      memoryTotal: toNumber(metrics.memoryTotal),
      memoryUsed: toNumber(metrics.memoryUsed),
      diskUsage: toNumber(metrics.diskUsage),
      diskTotal: toNumber(metrics.diskTotal),
      diskUsed: toNumber(metrics.diskUsed),
      networkRxBytes: toNumber(metrics.networkRxBytes),
      networkTxBytes: toNumber(metrics.networkTxBytes),
      loadAverage: toNumber(metrics.loadAverage),
      activeConnections: toNumber(metrics.activeConnections),
      runningServers: toNumber(metrics.runningServers),
      createdAt: metrics.timestamp,
      updatedAt: metrics.timestamp
    };

    setCurrentMetrics(newMetric);
    
    // Add to history (keep last 100 for real-time chart)
    metricsRef.current = [...metricsRef.current, newMetric].slice(-100);
    setMetricsHistory([...metricsRef.current]);
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError('');

      const [metricsResponse, healthResponse] = await Promise.all([
        minecraftApiService.getSystemMetrics(100),
        minecraftApiService.getSystemHealth()
      ]);

      // Convert metrics data to proper numbers
      const convertedMetrics = metricsResponse.map((metric: any) => ({
        ...metric,
        cpuUsage: toNumber(metric.cpuUsage),
        memoryUsage: toNumber(metric.memoryUsage),
        memoryTotal: toNumber(metric.memoryTotal),
        memoryUsed: toNumber(metric.memoryUsed),
        diskUsage: toNumber(metric.diskUsage),
        diskTotal: toNumber(metric.diskTotal),
        diskUsed: toNumber(metric.diskUsed),
        networkRxBytes: toNumber(metric.networkRxBytes),
        networkTxBytes: toNumber(metric.networkTxBytes),
        loadAverage: toNumber(metric.loadAverage),
        activeConnections: toNumber(metric.activeConnections),
        runningServers: toNumber(metric.runningServers)
      }));

      setMetricsHistory(convertedMetrics);
      metricsRef.current = convertedMetrics;
      if (convertedMetrics.length > 0) {
        setCurrentMetrics(convertedMetrics[0]);
      }

      setHealth(healthResponse);

    } catch (err) {
      console.error('Error fetching monitoring data:', err);
      setError('Failed to load monitoring data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAverageMetrics = async () => {
    try {
      const response = await minecraftApiService.getAverageMetrics(selectedTimeRange);
      setAverages(response);
    } catch (err) {
      console.error('Error fetching average metrics:', err);
    }
  };

  const cleanupOldMetrics = async () => {
    try {
      const daysToKeep = 30; // Keep 30 days by default
      const response = await minecraftApiService.cleanupMetrics(daysToKeep);
      alert(`Cleaned up ${response.deletedRecords} old metric records`);
    } catch (err) {
      console.error('Error cleaning up metrics:', err);
      alert('Failed to cleanup metrics');
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'healthy': return '#22c55e';
      case 'warning': return '#f59e0b';
      case 'critical': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getUsageColor = (percentage: number): string => {
    if (percentage >= 90) return '#ef4444';
    if (percentage >= 75) return '#f59e0b';
    return '#22c55e';
  };

  if (isLoading) {
    return (
      <div className="monitoring-page">
        <div className="loading">Loading monitoring data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="monitoring-page">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="monitoring-page">
      <div className="page-header">
        <h1>System Monitoring</h1>
        <div className="header-actions">
          <select 
            value={selectedTimeRange} 
            onChange={(e) => setSelectedTimeRange(Number(e.target.value))}
            className="time-range-select"
          >
            <option value={1}>Last Hour</option>
            <option value={6}>Last 6 Hours</option>
            <option value={24}>Last 24 Hours</option>
            <option value={72}>Last 3 Days</option>
            <option value={168}>Last Week</option>
          </select>
          <button onClick={cleanupOldMetrics} className="cleanup-btn">
            Cleanup Old Data
          </button>
        </div>
      </div>

      {health && (
        <div className="health-overview">
          <div className="health-status" style={{ borderColor: getStatusColor(health.status) }}>
            <h3>System Health</h3>
            <div className="status-indicator" style={{ backgroundColor: getStatusColor(health.status) }}>
              {health.status.toUpperCase()}
            </div>
            <p className="last-updated">Last Updated: {formatTimestamp(health.lastUpdated)}</p>
            <div className="health-issues">
              {health.issues.map((issue, index) => (
                <div key={index} className="issue-item">{issue}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {currentMetrics && (
        <div className="metrics-grid">
          <div className="metric-card">
            <h3>CPU Usage</h3>
            <div className="metric-value" style={{ color: getUsageColor(toNumber(currentMetrics.cpuUsage)) }}>
              {safeToFixed(currentMetrics.cpuUsage)}%
            </div>
            <div className="metric-bar">
              <div 
                className="metric-fill" 
                style={{ 
                  width: `${toNumber(currentMetrics.cpuUsage)}%`,
                  backgroundColor: getUsageColor(toNumber(currentMetrics.cpuUsage))
                }}
              />
            </div>
          </div>

          <div className="metric-card">
            <h3>Memory Usage</h3>
            <div className="metric-value" style={{ color: getUsageColor(toNumber(currentMetrics.memoryUsage)) }}>
              {safeToFixed(currentMetrics.memoryUsage)}%
            </div>
            <div className="metric-subtitle">
              {formatBytes(toNumber(currentMetrics.memoryUsed))} / {formatBytes(toNumber(currentMetrics.memoryTotal))}
            </div>
            <div className="metric-bar">
              <div 
                className="metric-fill" 
                style={{ 
                  width: `${toNumber(currentMetrics.memoryUsage)}%`,
                  backgroundColor: getUsageColor(toNumber(currentMetrics.memoryUsage))
                }}
              />
            </div>
          </div>

          <div className="metric-card">
            <h3>Disk Usage</h3>
            <div className="metric-value" style={{ color: getUsageColor(toNumber(currentMetrics.diskUsage)) }}>
              {safeToFixed(currentMetrics.diskUsage)}%
            </div>
            <div className="metric-subtitle">
              {formatBytes(toNumber(currentMetrics.diskUsed))} / {formatBytes(toNumber(currentMetrics.diskTotal))}
            </div>
            <div className="metric-bar">
              <div 
                className="metric-fill" 
                style={{ 
                  width: `${toNumber(currentMetrics.diskUsage)}%`,
                  backgroundColor: getUsageColor(toNumber(currentMetrics.diskUsage))
                }}
              />
            </div>
          </div>

          <div className="metric-card">
            <h3>Load Average</h3>
            <div className="metric-value">
              {safeToFixed(currentMetrics.loadAverage, 2)}
            </div>
          </div>

          <div className="metric-card">
            <h3>Network Traffic</h3>
            <div className="metric-value">
              ↓ {formatBytes(toNumber(currentMetrics.networkRxBytes))}
            </div>
            <div className="metric-subtitle">
              ↑ {formatBytes(toNumber(currentMetrics.networkTxBytes))}
            </div>
          </div>

          <div className="metric-card">
            <h3>Connections & Servers</h3>
            <div className="metric-value">
              {toNumber(currentMetrics.activeConnections)} connections
            </div>
            <div className="metric-subtitle">
              {toNumber(currentMetrics.runningServers)} servers running
            </div>
          </div>
        </div>
      )}

      {averages && (
        <div className="averages-section">
          <h3>Average Metrics ({selectedTimeRange}h period)</h3>
          <div className="averages-grid">
            <div className="average-item">
              <span className="label">Average CPU:</span>
              <span className="value">{safeToFixed(averages.avgCpuUsage)}%</span>
            </div>
            <div className="average-item">
              <span className="label">Peak CPU:</span>
              <span className="value">{safeToFixed(averages.maxCpuUsage)}%</span>
            </div>
            <div className="average-item">
              <span className="label">Average Memory:</span>
              <span className="value">{safeToFixed(averages.avgMemoryUsage)}%</span>
            </div>
            <div className="average-item">
              <span className="label">Peak Memory:</span>
              <span className="value">{safeToFixed(averages.maxMemoryUsage)}%</span>
            </div>
            <div className="average-item">
              <span className="label">Average Disk:</span>
              <span className="value">{safeToFixed(averages.avgDiskUsage)}%</span>
            </div>
            <div className="average-item">
              <span className="label">Average Load:</span>
              <span className="value">{safeToFixed(averages.avgLoadAverage, 2)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="metrics-history">
        <h3>Recent Metrics History</h3>
        <div className="metrics-table-container">
          <table className="metrics-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>CPU</th>
                <th>Memory</th>
                <th>Disk</th>
                <th>Load</th>
                <th>Connections</th>
                <th>Servers</th>
              </tr>
            </thead>
            <tbody>
              {metricsHistory.slice(0, 20).map((metric) => (
                <tr key={metric.id}>
                  <td>{formatTimestamp(metric.timestamp)}</td>
                  <td style={{ color: getUsageColor(toNumber(metric.cpuUsage)) }}>
                    {safeToFixed(metric.cpuUsage)}%
                  </td>
                  <td style={{ color: getUsageColor(toNumber(metric.memoryUsage)) }}>
                    {safeToFixed(metric.memoryUsage)}%
                  </td>
                  <td style={{ color: getUsageColor(toNumber(metric.diskUsage)) }}>
                    {safeToFixed(metric.diskUsage)}%
                  </td>
                  <td>{safeToFixed(metric.loadAverage, 2)}</td>
                  <td>{toNumber(metric.activeConnections)}</td>
                  <td>{toNumber(metric.runningServers)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default MonitoringPage;