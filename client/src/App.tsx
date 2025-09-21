import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppShell from './layouts/AppShell';
import { SocketProvider } from './contexts/SocketContext';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import HomePage from './pages/HomePage';
import InstancesPage from './pages/InstancesPage';
import ServerManagePage from './pages/ServerManagePage';
import UsersPage from './pages/UsersPage';
import MonitoringPage from './pages/MonitoringPage';
import ErrorLogsPage from './pages/ErrorLogsPage';
import DatabaseMigrationPage from './pages/DatabaseMigrationPage';
import './App.scss';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public route for database migration - works without authentication */}
            <Route path="/migrate" element={<DatabaseMigrationPage />} />
            
            {/* Protected routes that require authentication */}
            <Route path="/*" element={
              <ProtectedRoute>
                <SocketProvider>
                  <AppShell>
                    <Routes>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/instances" element={<InstancesPage />} />
                      <Route path="/servers/:serverId/manage" element={<ServerManagePage />} />
                      <Route path="/users" element={<UsersPage />} />
                      <Route path="/monitoring" element={<MonitoringPage />} />
                      <Route path="/error-logs" element={<ErrorLogsPage />} />
                    </Routes>
                  </AppShell>
                </SocketProvider>
              </ProtectedRoute>
            } />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
