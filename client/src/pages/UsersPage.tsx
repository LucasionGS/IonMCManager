import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { minecraftApiService } from '../services/minecraftApi';
import './UsersPage.scss';

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  serverLimit: number;
  isAdmin: boolean;
  serverCount: number;
  lastLogin?: string;
  createdAt: string;
}

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  adminUsers: number;
  totalServers: number;
  runningServers: number;
}

function UsersPage() {
  const { authState } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newServerLimit, setNewServerLimit] = useState<number>(5);

  useEffect(() => {
    if (!authState.user?.isAdmin) {
      setError('Admin access required');
      setIsLoading(false);
      return;
    }

    fetchData();
  }, [authState.user]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const [usersData, statsData] = await Promise.all([
        minecraftApiService.getUsers(),
        minecraftApiService.getAdminStats()
      ]);

      setUsers(usersData.users);
      setStats(statsData.stats);
    } catch (err) {
      console.error('Error fetching admin data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setNewServerLimit(user.serverLimit);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    try {
      setError('');
      await minecraftApiService.updateUserLimit(
        editingUser.id, 
        newServerLimit
      );
      
      // Update the user in the list
      setUsers(prev => 
        prev.map(u => 
          u.id === editingUser.id 
            ? { ...u, serverLimit: newServerLimit }
            : u
        )
      );
      
      setEditingUser(null);
    } catch (err) {
      console.error('Error updating user:', err);
      setError(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  const handleToggleStatus = async (userId: number) => {
    try {
      setError('');
      await minecraftApiService.toggleUserStatus(userId);
      
      // Update the user in the list
      setUsers(prev => 
        prev.map(u => 
          u.id === userId 
            ? { ...u, isActive: !u.isActive }
            : u
        )
      );
    } catch (err) {
      console.error('Error toggling user status:', err);
      setError(err instanceof Error ? err.message : 'Failed to toggle user status');
    }
  };

  if (!authState.user?.isAdmin) {
    return (
      <div className="users-page">
        <div className="users-page__error">
          <h2>Access Denied</h2>
          <p>You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="users-page">
        <div className="users-page__loading">
          <div className="loading-spinner"></div>
          <p>Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="users-page">
      <div className="users-page__header">
        <h1>User Management</h1>
        <button onClick={fetchData} className="users-page__refresh-btn">
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="users-page__error">
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* Statistics */}
      {stats && (
        <div className="users-page__stats">
          <div className="stat-card">
            <h3>{stats.totalUsers}</h3>
            <p>Total Users</p>
          </div>
          <div className="stat-card">
            <h3>{stats.activeUsers}</h3>
            <p>Active Users</p>
          </div>
          <div className="stat-card">
            <h3>{stats.adminUsers}</h3>
            <p>Administrators</p>
          </div>
          <div className="stat-card">
            <h3>{stats.totalServers}</h3>
            <p>Total Servers</p>
          </div>
          <div className="stat-card">
            <h3>{stats.runningServers}</h3>
            <p>Running Servers</p>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="users-page__table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Servers</th>
              <th>Server Limit</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className={!user.isActive ? 'user-inactive' : ''}>
                <td>
                  <div className="user-info">
                    <span className="username">{user.username}</span>
                    {user.isAdmin && <span className="admin-badge">ADMIN</span>}
                  </div>
                </td>
                <td>{user.email}</td>
                <td>
                  <span className={`role-badge role-badge--${user.role}`}>
                    {user.role}
                  </span>
                </td>
                <td>
                  <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>{user.serverCount}</td>
                <td>{user.serverLimit}</td>
                <td>
                  {user.lastLogin 
                    ? new Date(user.lastLogin).toLocaleDateString()
                    : 'Never'
                  }
                </td>
                <td>
                  <div className="user-actions">
                    <button 
                      onClick={() => handleEditUser(user)}
                      className="action-btn edit-btn"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleToggleStatus(user.id)}
                      className={`action-btn ${user.isActive ? 'deactivate-btn' : 'activate-btn'}`}
                      disabled={authState.user?.id === user.id}
                    >
                      {user.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal__header">
              <h3>Edit User: {editingUser.username}</h3>
              <button 
                onClick={() => setEditingUser(null)}
                className="modal__close"
              >
                ×
              </button>
            </div>
            <div className="modal__body">
              <div className="form-group">
                <label htmlFor="serverLimit">Server Limit:</label>
                <input
                  id="serverLimit"
                  type="number"
                  min="0"
                  max="100"
                  value={newServerLimit}
                  onChange={(e) => setNewServerLimit(parseInt(e.target.value))}
                  className="form-input"
                />
              </div>
            </div>
            <div className="modal__footer">
              <button 
                onClick={() => setEditingUser(null)}
                className="btn btn--secondary"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdateUser}
                className="btn btn--primary"
              >
                Update User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsersPage;