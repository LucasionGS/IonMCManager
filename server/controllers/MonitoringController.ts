import { Router, Request, Response } from 'express';
import SystemMetrics from '../database/models/SystemMetrics.ts';
import User from '../database/models/User.ts';
import AuthController from './AuthController.ts';

interface AuthenticatedRequest extends Request {
  user?: User;
}

namespace MonitoringController {
  export const router = Router();

  /**
   * Get latest system metrics (admin only)
   */
  router.get('/metrics', AuthController.authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { user } = req;
      
      if (!user?.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
      
      try {
        const metrics = await SystemMetrics.getLatestMetrics(limit);
        res.json({
          success: true,
          data: metrics
        });
      } catch (dbError) {
        console.error('Database error fetching metrics:', dbError);
        // Return empty array if table doesn't exist yet
        res.json({
          success: true,
          data: []
        });
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch metrics'
      });
    }
  });

  /**
   * Get metrics within a date range (admin only)
   */
  router.get('/metrics/range', AuthController.authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { user } = req;
      
      if (!user?.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const startDate = new Date(req.query.start as string);
      const endDate = new Date(req.query.end as string);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date range provided'
        });
      }

      const metrics = await SystemMetrics.getMetricsInRange(startDate, endDate);

      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      console.error('Error fetching metrics range:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch metrics range'
      });
    }
  });

  /**
   * Get average metrics for a specified time period (admin only)
   */
  router.get('/metrics/average', AuthController.authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { user } = req;
      
      if (!user?.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const hours = Math.min(parseInt(req.query.hours as string) || 24, 168); // Max 1 week
      
      try {
        const averages = await SystemMetrics.getAverageMetrics(hours);
        res.json({
          success: true,
          data: averages
        });
      } catch (dbError) {
        console.error('Database error fetching average metrics:', dbError);
        // Return default values if table doesn't exist yet
        res.json({
          success: true,
          data: {
            avgCpuUsage: 0,
            avgMemoryUsage: 0,
            avgDiskUsage: 0,
            avgLoadAverage: 0,
            maxCpuUsage: 0,
            maxMemoryUsage: 0,
            avgActiveConnections: 0,
            avgRunningServers: 0
          }
        });
      }
    } catch (error) {
      console.error('Error fetching average metrics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch average metrics'
      });
    }
  });

  /**
   * Get current system health status (admin only)
   */
  router.get('/health', AuthController.authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { user } = req;
      
      if (!user?.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      try {
        // Get the latest metric entry
        const latestMetrics = await SystemMetrics.getLatestMetrics(1);
        
        if (latestMetrics.length === 0) {
          return res.json({
            success: true,
            data: {
              status: 'unknown',
              issues: ['No metrics data available'],
              lastUpdated: new Date().toISOString(),
              currentMetrics: {
                cpu: 0,
                memory: 0,
                disk: 0,
                load: 0,
                activeConnections: 0,
                runningServers: 0
              }
            }
          });
        }

        const latest = latestMetrics[0];
        const now = new Date();
        const metricAge = now.getTime() - latest.timestamp.getTime();
        const isStale = metricAge > 5 * 60 * 1000; // 5 minutes

        // Determine system health
        let status = 'healthy';
        const issues = [];

        if (isStale) {
          status = 'warning';
          issues.push('Metrics data is stale');
        }

        if (latest.cpuUsage > 90) {
          status = 'critical';
          issues.push('High CPU usage');
        } else if (latest.cpuUsage > 75) {
          status = status === 'healthy' ? 'warning' : status;
          issues.push('Elevated CPU usage');
        }

        if (latest.memoryUsage > 90) {
          status = 'critical';
          issues.push('High memory usage');
        } else if (latest.memoryUsage > 80) {
          status = status === 'healthy' ? 'warning' : status;
          issues.push('Elevated memory usage');
        }

        if (latest.diskUsage > 95) {
          status = 'critical';
          issues.push('Disk space critically low');
        } else if (latest.diskUsage > 85) {
          status = status === 'healthy' ? 'warning' : status;
          issues.push('Disk space running low');
        }

        if (latest.loadAverage > 4) {
          status = status === 'healthy' ? 'warning' : status;
          issues.push('High system load');
        }

        res.json({
          success: true,
          data: {
            status,
            issues: issues.length > 0 ? issues : ['System operating normally'],
            lastUpdated: latest.timestamp,
            currentMetrics: {
              cpu: latest.cpuUsage,
              memory: latest.memoryUsage,
              disk: latest.diskUsage,
              load: latest.loadAverage,
              activeConnections: latest.activeConnections,
              runningServers: latest.runningServers
            }
          }
        });
      } catch (dbError) {
        console.error('Database error fetching health status:', dbError);
        // Return default health status if table doesn't exist yet
        res.json({
          success: true,
          data: {
            status: 'unknown',
            issues: ['Monitoring system not yet initialized'],
            lastUpdated: new Date().toISOString(),
            currentMetrics: {
              cpu: 0,
              memory: 0,
              disk: 0,
              load: 0,
              activeConnections: 0,
              runningServers: 0
            }
          }
        });
      }
    } catch (error) {
      console.error('Error fetching system health:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch system health'
      });
    }
  });

  /**
   * Cleanup old metrics data (admin only)
   */
  router.delete('/metrics/cleanup', AuthController.authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { user } = req;
      
      if (!user?.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const daysToKeep = Math.max(parseInt(req.query.days as string) || 30, 7); // Minimum 7 days
      const deletedCount = await SystemMetrics.cleanupOldMetrics(daysToKeep);

      res.json({
        success: true,
        message: `Cleaned up ${deletedCount} old metric records`,
        data: {
          deletedRecords: deletedCount,
          daysKept: daysToKeep
        }
      });
    } catch (error) {
      console.error('Error cleaning up metrics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cleanup metrics'
      });
    }
  });
}

export default MonitoringController;