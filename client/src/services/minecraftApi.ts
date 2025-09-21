export interface MinecraftVersion {
  id: string;
  type: string;
  releaseTime: string;
  time: string;
}

export interface VersionManifest {
  latest: {
    release: string;
    snapshot: string;
  };
  versions: MinecraftVersion[];
}

export interface ServerType {
  id: string;
  name: string;
  description: string;
  category: 'vanilla' | 'modded' | 'plugin';
  supportsVersions: string[];
}

export interface ForgeVersion {
  version: string;
  downloadUrl: string;
}

export interface UserServersResponse {
  count: number;
  serverLimit: number;
  canCreateMore: boolean;
  servers: ServerInstance[];
}

export interface CreateServerRequest {
  name: string;
  version: string;
  serverType: string;
  forgeVersion?: string;
  memory?: number;
  description?: string;
  maxPlayers?: number;
  motd?: string;
  difficulty?: 'peaceful' | 'easy' | 'normal' | 'hard';
  gamemode?: 'survival' | 'creative' | 'adventure' | 'spectator';
  worldSeed?: string;
  worldType?: string;
}

export interface ServerInstance {
  id: number;
  name: string;
  description?: string;
  minecraftVersion: string;
  serverType: string;
  forgeVersion?: string;
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'crashed' | 'creating' | 'error';
  memory: number;
  port?: number;
  maxPlayers: number;
  motd?: string;
  difficulty: 'peaceful' | 'easy' | 'normal' | 'hard';
  gamemode: 'survival' | 'creative' | 'adventure' | 'spectator';
  allowNether: boolean;
  enablePvp: boolean;
  enableCommandBlock: boolean;
  worldType: string;
  onlineMode: boolean;
  enableWhitelist: boolean;
  lastStarted?: string;
  lastStopped?: string;
  uptime: string;
  uptimeHours: number;
  createdAt: string;
  updatedAt: string;
}

class MinecraftApiService {
  private baseUrl = '/api/servers';

  /**
   * Get authorization headers for authenticated requests
   */
  private getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('token');
    return token ? {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    } : {
      'Content-Type': 'application/json'
    };
  }

  /**
   * Fetch all available Minecraft versions
   */
  async getVersions(): Promise<VersionManifest> {
    const response = await fetch(`${this.baseUrl}/versions`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch versions');
    }
    
    return data.data;
  }

  /**
   * Fetch versions by type (release, snapshot, etc.)
   */
  async getVersionsByType(type: string): Promise<MinecraftVersion[]> {
    const response = await fetch(`${this.baseUrl}/versions/type/${type}`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch versions');
    }
    
    return data.data.versions;
  }

  /**
   * Get detailed information about a specific version
   */
  async getVersionData(versionId: string) {
    const response = await fetch(`${this.baseUrl}/versions/${versionId}`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch version data');
    }
    
    return data.data;
  }

  /**
   * Get available server types
   */
  async getServerTypes(): Promise<ServerType[]> {
    const response = await fetch(`${this.baseUrl}/types`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch server types');
    }
    
    return data.data.serverTypes;
  }

  /**
   * Get available Forge versions for a Minecraft version
   */
  async getForgeVersions(minecraftVersion: string): Promise<ForgeVersion[]> {
    const response = await fetch(`${this.baseUrl}/forge-versions/${minecraftVersion}`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch Forge versions');
    }
    
    return data.data.forgeVersions;
  }

  /**
   * Get latest release and snapshot versions
   */
  async getLatestVersions(): Promise<{ release: string; snapshot: string }> {
    const response = await fetch(`${this.baseUrl}/latest`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch latest versions');
    }
    
    return data.data;
  }

  /**
   * Validate a version ID
   */
  async validateVersion(versionId: string): Promise<{ isValid: boolean; versionInfo: MinecraftVersion | null }> {
    const response = await fetch(`${this.baseUrl}/validate/${versionId}`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to validate version');
    }
    
    return data.data;
  }

  /**
   * Create a new Minecraft server
   */
  async createServer(serverData: CreateServerRequest) {
    const response = await fetch(`${this.baseUrl}/create`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(serverData),
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to create server');
    }
    
    return data.data;
  }

  /**
   * Get all servers for the current user
   */
  async getUserServers(): Promise<UserServersResponse> {
    const response = await fetch(this.baseUrl, {
      headers: this.getAuthHeaders(),
    });
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch servers');
    }
    
    return data.data;
  }

  /**
   * Get a specific server by ID
   */
  async getServer(serverId: number): Promise<ServerInstance> {
    const response = await fetch(`${this.baseUrl}/${serverId}`, {
      headers: this.getAuthHeaders(),
    });
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch server');
    }
    
    return data.data;
  }

  /**
   * Update server configuration
   */
  async updateServer(serverId: number, updateData: Partial<ServerInstance>) {
    const response = await fetch(`${this.baseUrl}/${serverId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(updateData),
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to update server');
    }
    
    return data.data;
  }

  /**
   * Delete a server
   */
  async deleteServer(serverId: number): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${serverId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to delete server');
    }
  }

  /**
   * Control server (start, stop, restart)
   */
  async controlServer(serverId: number, action: 'start' | 'stop' | 'restart') {
    const response = await fetch(`${this.baseUrl}/${serverId}/${action}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || `Failed to ${action} server`);
    }
    
    return data.data;
  }

  /**
   * Send command to a running server
   */
  async sendServerCommand(serverId: number, command: string) {
    const response = await fetch(`${this.baseUrl}/${serverId}/command`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ command }),
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to send command');
    }
    
    return data.data;
  }

  /**
   * Get server console output
   */
  async getServerConsole(serverId: number) {
    const response = await fetch(`${this.baseUrl}/${serverId}/console`, {
      headers: this.getAuthHeaders(),
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch console output');
    }
    
    return data.data;
  }

  /**
   * Get detailed server management data
   */
  async getServerManagementData(serverId: number) {
    const response = await fetch(`${this.baseUrl}/${serverId}/manage`, {
      headers: this.getAuthHeaders(),
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch server management data');
    }
    
    return data.data;
  }

  /**
   * Get server performance metrics
   */
  async getServerMetrics(serverId: number) {
    const response = await fetch(`${this.baseUrl}/${serverId}/metrics`, {
      headers: this.getAuthHeaders(),
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch server metrics');
    }
    
    return data.data;
  }

  /**
   * Send admin command to server
   */
  async sendAdminCommand(serverId: number, command: string) {
    const response = await fetch(`${this.baseUrl}/${serverId}/command`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ command }),
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to send command');
    }
    
    return data.data;
  }

  // Admin endpoints
  /**
   * Get all users (admin only)
   */
  async getUsers() {
    const response = await fetch('/api/admin/users', {
      headers: this.getAuthHeaders(),
    });
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch users');
    }
    
    return data.data;
  }

  /**
   * Update user server limit (admin only)
   */
  async updateUserLimit(userId: number, serverLimit: number) {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ serverLimit }),
    });
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to update user');
    }
    
    return data.data;
  }

  /**
   * Toggle user active status (admin only)
   */
  async toggleUserStatus(userId: number) {
    const response = await fetch(`/api/admin/users/${userId}/toggle`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
    });
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to toggle user status');
    }
    
    return data.data;
  }

  /**
   * Get admin statistics (admin only)
   */
  async getAdminStats() {
    const response = await fetch('/api/admin/stats', {
      headers: this.getAuthHeaders(),
    });
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch statistics');
    }
    
    return data.data;
  }

  /**
   * Get system metrics (admin only)
   */
  async getSystemMetrics(limit = 100) {
    const response = await fetch(`/api/monitoring/metrics?limit=${limit}`, {
      headers: this.getAuthHeaders(),
    });
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch system metrics');
    }
    
    return data.data;
  }

  /**
   * Get system health status (admin only)
   */
  async getSystemHealth() {
    const response = await fetch('/api/monitoring/health', {
      headers: this.getAuthHeaders(),
    });
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch system health');
    }
    
    return data.data;
  }

  /**
   * Get average system metrics (admin only)
   */
  async getAverageMetrics(hours = 24) {
    const response = await fetch(`/api/monitoring/metrics/average?hours=${hours}`, {
      headers: this.getAuthHeaders(),
    });
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to fetch average metrics');
    }
    
    return data.data;
  }

  /**
   * Cleanup old metrics data (admin only)
   */
  async cleanupMetrics(days = 30) {
    const response = await fetch(`/api/monitoring/metrics/cleanup?days=${days}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || 'Failed to cleanup metrics');
    }
    
    return data.data;
  }
}

export const minecraftApiService = new MinecraftApiService();
export default minecraftApiService;