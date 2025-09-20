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
import './App.scss';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ProtectedRoute>
          <SocketProvider>
            <Router>
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
            </Router>
          </SocketProvider>
        </ProtectedRoute>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
