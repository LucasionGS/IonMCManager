import SystemMetrics from '../database/models/SystemMetrics.ts';
import { io } from '../server.ts';
import { promisify } from 'node:util';
import { exec } from 'node:child_process';
import os from 'node:os';

const execAsync = promisify(exec);

export interface SystemMetricsData {
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
}

export default class MonitoringService {
  private isCollecting = false;
  private collectionInterval: ReturnType<typeof setInterval> | null = null;
  private readonly COLLECTION_INTERVAL = 30000; // 30 seconds

  /**
   * Start collecting system metrics
   */
  startCollection(): void {
    if (this.isCollecting) {
      console.log('Metrics collection is already running');
      return;
    }

    this.isCollecting = true;
    console.log('Starting system metrics collection...');

    // Collect immediately, then set interval
    this.collectMetrics();
    this.collectionInterval = setInterval(() => {
      this.collectMetrics();
    }, this.COLLECTION_INTERVAL);
  }

  /**
   * Stop collecting system metrics
   */
  stopCollection(): void {
    if (!this.isCollecting) {
      return;
    }

    this.isCollecting = false;
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }
    console.log('Stopped system metrics collection');
  }

  /**
   * Collect and store system metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const metrics = await this.gatherSystemMetrics();
      
      // Store in database
      await SystemMetrics.create({
        timestamp: new Date(),
        ...metrics
      });

      // Emit real-time metrics via Socket.IO
      io.emit('system_metrics', {
        timestamp: new Date().toISOString(),
        ...metrics
      });

      console.log(`Collected metrics: CPU ${metrics.cpuUsage.toFixed(1)}%, Memory ${metrics.memoryUsage.toFixed(1)}%, Disk ${metrics.diskUsage.toFixed(1)}%`);
    } catch (error) {
      console.error('Error collecting system metrics:', error);
    }
  }

  /**
   * Gather current system metrics from the OS
   */
  private async gatherSystemMetrics(): Promise<SystemMetricsData> {
    const [
      cpuUsage,
      memoryInfo,
      diskInfo,
      networkInfo,
      loadAverage,
      connectionCount,
      serverCount
    ] = await Promise.all([
      this.getCpuUsage(),
      this.getMemoryInfo(),
      this.getDiskInfo(),
      this.getNetworkInfo(),
      this.getLoadAverage(),
      this.getActiveConnections(),
      this.getRunningServersCount()
    ]);

    return {
      cpuUsage,
      memoryUsage: memoryInfo.usage,
      memoryTotal: memoryInfo.total,
      memoryUsed: memoryInfo.used,
      diskUsage: diskInfo.usage,
      diskTotal: diskInfo.total,
      diskUsed: diskInfo.used,
      networkRxBytes: networkInfo.rx,
      networkTxBytes: networkInfo.tx,
      loadAverage,
      activeConnections: connectionCount,
      runningServers: serverCount
    };
  }

  /**
   * Get CPU usage percentage
   */
  private async getCpuUsage(): Promise<number> {
    const cpus = os.cpus();
    const numCpus = cpus.length;

    // Calculate CPU usage over a short period
    const startMeasure = this.getCpuInfo();
    await new Promise(resolve => setTimeout(resolve, 100));
    const endMeasure = this.getCpuInfo();

    let idleDiff = 0;
    let totalDiff = 0;

    for (let i = 0; i < numCpus; i++) {
      const startCpu = startMeasure[i];
      const endCpu = endMeasure[i];

      const idle = endCpu.idle - startCpu.idle;
      const total = endCpu.total - startCpu.total;

      idleDiff += idle;
      totalDiff += total;
    }

    const cpuUsage = 100 - (100 * idleDiff / totalDiff);
    return Math.max(0, Math.min(100, cpuUsage));
  }

  /**
   * Get CPU time info for usage calculation
   */
  private getCpuInfo() {
    const cpus = os.cpus();
    return cpus.map(cpu => {
      const times = cpu.times;
      return {
        idle: times.idle,
        total: times.user + times.nice + times.sys + times.idle + times.irq
      };
    });
  }

  /**
   * Get memory usage information
   */
  private getMemoryInfo() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const usage = (usedMemory / totalMemory) * 100;

    return {
      total: totalMemory,
      used: usedMemory,
      usage: Math.max(0, Math.min(100, usage))
    };
  }

  /**
   * Get disk usage information
   */
  private async getDiskInfo() {
    try {
      const { stdout } = await execAsync('df -h / | tail -1');
      const parts = stdout.trim().split(/\s+/);
      const usagePercent = parseInt(parts[4].replace('%', ''));
      
      // Convert sizes to bytes (approximate)
      const totalStr = parts[1];
      const usedStr = parts[2];
      
      const totalBytes = this.convertToBytes(totalStr);
      const usedBytes = this.convertToBytes(usedStr);

      return {
        total: totalBytes,
        used: usedBytes,
        usage: Math.max(0, Math.min(100, usagePercent))
      };
    } catch (error) {
      console.warn('Could not get disk info:', error);
      return { total: 0, used: 0, usage: 0 };
    }
  }

  /**
   * Convert disk size string to bytes
   */
  private convertToBytes(sizeStr: string): number {
    const unit = sizeStr.slice(-1).toUpperCase();
    const value = parseFloat(sizeStr.slice(0, -1));
    
    switch (unit) {
      case 'K': return value * 1024;
      case 'M': return value * 1024 * 1024;
      case 'G': return value * 1024 * 1024 * 1024;
      case 'T': return value * 1024 * 1024 * 1024 * 1024;
      default: return value;
    }
  }

  /**
   * Get network usage information
   */
  private async getNetworkInfo() {
    try {
      const { stdout } = await execAsync('cat /proc/net/dev');
      const lines = stdout.split('\n');
      let totalRx = 0;
      let totalTx = 0;

      for (const line of lines) {
        if (line.includes(':') && !line.includes('lo:')) { // Skip loopback
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 10) {
            totalRx += parseInt(parts[1]) || 0;
            totalTx += parseInt(parts[9]) || 0;
          }
        }
      }

      return {
        rx: totalRx,
        tx: totalTx
      };
    } catch (error) {
      console.warn('Could not get network info:', error);
      return { rx: 0, tx: 0 };
    }
  }

  /**
   * Get system load average
   */
  private getLoadAverage(): number {
    const loadAvg = os.loadavg();
    return Math.max(0, loadAvg[0]); // 1-minute load average
  }

  /**
   * Get number of active connections (approximate)
   */
  private async getActiveConnections(): Promise<number> {
    try {
      const { stdout } = await execAsync('netstat -tun | grep ESTABLISHED | wc -l');
      return parseInt(stdout.trim()) || 0;
    } catch (_error) {
      // Fallback: count Socket.IO connections
      return io.engine.clientsCount || 0;
    }
  }

  /**
   * Get number of running Minecraft servers
   */
  private async getRunningServersCount(): Promise<number> {
    try {
      // Count Java processes that look like Minecraft servers
      const { stdout } = await execAsync('ps aux | grep -E "java.*minecraft.*jar" | grep -v grep | wc -l');
      return parseInt(stdout.trim()) || 0;
    } catch (_error) {
      console.warn('Could not count running servers:', _error);
      return 0;
    }
  }

  /**
   * Get current system metrics without storing them
   */
  async getCurrentMetrics(): Promise<SystemMetricsData> {
    return await this.gatherSystemMetrics();
  }

  /**
   * Check if metrics collection is running
   */
  isRunning(): boolean {
    return this.isCollecting;
  }
}