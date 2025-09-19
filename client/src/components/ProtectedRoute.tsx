import { type ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LoginPage from '../pages/LoginPage';
import './ProtectedRoute.scss';

interface ProtectedRouteProps {
  children: ReactNode;
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { authState } = useAuth();

  // Show loading while checking authentication
  if (authState.isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  // Show login if not authenticated
  if (!authState.isAuthenticated || !authState.user) {
    return <LoginPage />;
  }

  // Show protected content if authenticated
  return <>{children}</>;
}

export default ProtectedRoute;