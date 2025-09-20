import { Router, Request, Response } from 'express';
import process from 'node:process';
import ErrorLog from '../database/models/ErrorLog.ts';
import User from '../database/models/User.ts';
import AuthController from './AuthController.ts';

interface AuthenticatedRequest extends Request {
  user?: User;
}

interface LogErrorRequest {
  message: string;
  stackTrace?: string;
  source: 'server' | 'client';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  url?: string;
  userAgent?: string;
  userInfo?: Record<string, unknown>;
  errorCode?: string;
}

namespace ErrorLoggingController {
  export const router = Router();

  /**
   * Log a new error (authenticated users and unauthenticated for client errors)
   */
  router.post('/log', async (req: Request, res: Response) => {
    try {
      const {
        message,
        stackTrace,
        source,
        severity = 'medium',
        url,
        userAgent,
        userInfo,
        errorCode
      }: LogErrorRequest = req.body;

      // Basic validation
      if (!message || !source) {
        return res.status(400).json({
          success: false,
          message: 'Message and source are required'
        });
      }

      if (!['server', 'client'].includes(source)) {
        return res.status(400).json({
          success: false,
          message: 'Source must be either "server" or "client"'
        });
      }

      if (!['low', 'medium', 'high', 'critical'].includes(severity)) {
        return res.status(400).json({
          success: false,
          message: 'Severity must be one of: low, medium, high, critical'
        });
      }

      // Try to get user from token if available (but don't require authentication)
      let userId: number | null = null;
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        try {
          // Use the same JWT verification logic as AuthController
          const jwt = await import('jsonwebtoken');
          const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-this';
          const decoded = jwt.verify(token, jwtSecret) as { id: number };
          const user = await User.findByPk(decoded.id);
          if (user) {
            userId = user.id;
          }
        } catch {
          // Invalid token, but we'll continue without user ID
        }
      }

      // Create error log entry
      const errorLog = await ErrorLog.create({
        message,
        stackTrace,
        source,
        severity,
        userId,
        userAgent: userAgent || req.headers['user-agent'] || null,
        url: url || req.originalUrl || null,
        method: req.method,
        userInfo: userInfo ? JSON.stringify(userInfo) : null,
        errorCode
      });

      res.status(201).json({
        success: true,
        data: {
          errorId: errorLog.id,
          message: 'Error logged successfully'
        }
      });

    } catch (error) {
      console.error('Error logging error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to log error'
      });
    }
  });

  /**
   * Get error logs with filtering and pagination (admin only)
   */
  router.get('/logs', AuthController.authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { user } = req;
      
      if (!user?.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const {
        page = '1',
        limit = '50',
        source,
        severity,
        resolved,
        userId,
        startDate,
        endDate
      } = req.query;

      const pageNum = Math.max(1, parseInt(page as string));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));
      const offset = (pageNum - 1) * limitNum;

      const filters: {
        limit: number;
        offset: number;
        source?: 'server' | 'client';
        severity?: 'low' | 'medium' | 'high' | 'critical';
        resolved?: boolean;
        userId?: number;
        startDate?: Date;
        endDate?: Date;
      } = {
        limit: limitNum,
        offset
      };

      if (source && ['server', 'client'].includes(source as string)) {
        filters.source = source as 'server' | 'client';
      }

      if (severity && ['low', 'medium', 'high', 'critical'].includes(severity as string)) {
        filters.severity = severity as 'low' | 'medium' | 'high' | 'critical';
      }

      if (resolved !== undefined) {
        filters.resolved = resolved === 'true';
      }

      if (userId) {
        filters.userId = parseInt(userId as string);
      }

      if (startDate) {
        filters.startDate = new Date(startDate as string);
      }

      if (endDate) {
        filters.endDate = new Date(endDate as string);
      }

      const result = await ErrorLog.getErrorLogs(filters);

      res.json({
        success: true,
        data: {
          logs: result.rows,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: result.count,
            totalPages: Math.ceil(result.count / limitNum)
          }
        }
      });

    } catch (error) {
      console.error('Error fetching error logs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch error logs'
      });
    }
  });

  /**
   * Get error statistics (admin only)
   */
  router.get('/stats', AuthController.authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { user } = req;
      
      if (!user?.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const stats = await ErrorLog.getErrorStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Error fetching error stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch error statistics'
      });
    }
  });

  /**
   * Get a specific error log by ID (admin only)
   */
  router.get('/logs/:id', AuthController.authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { user } = req;
      
      if (!user?.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const { id } = req.params;
      const errorLog = await ErrorLog.findByPk(parseInt(id));

      if (!errorLog) {
        return res.status(404).json({
          success: false,
          message: 'Error log not found'
        });
      }

      res.json({
        success: true,
        data: errorLog
      });

    } catch (error) {
      console.error('Error fetching error log:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch error log'
      });
    }
  });

  /**
   * Mark an error as resolved (admin only)
   */
  router.patch('/logs/:id/resolve', AuthController.authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { user } = req;
      
      if (!user?.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const { id } = req.params;
      const errorLog = await ErrorLog.findByPk(parseInt(id));

      if (!errorLog) {
        return res.status(404).json({
          success: false,
          message: 'Error log not found'
        });
      }

      await errorLog.markResolved(user.id);

      res.json({
        success: true,
        message: 'Error marked as resolved'
      });

    } catch (error) {
      console.error('Error resolving error log:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resolve error log'
      });
    }
  });

  /**
   * Mark an error as unresolved (admin only)
   */
  router.patch('/logs/:id/unresolve', AuthController.authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { user } = req;
      
      if (!user?.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const { id } = req.params;
      const errorLog = await ErrorLog.findByPk(parseInt(id));

      if (!errorLog) {
        return res.status(404).json({
          success: false,
          message: 'Error log not found'
        });
      }

      await errorLog.markUnresolved();

      res.json({
        success: true,
        message: 'Error marked as unresolved'
      });

    } catch (error) {
      console.error('Error unresolving error log:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to unresolve error log'
      });
    }
  });

  /**
   * Delete old resolved errors (admin only)
   */
  router.delete('/cleanup', AuthController.authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { user } = req;
      
      if (!user?.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Admin access required'
        });
      }

      const daysToKeep = Math.max(7, parseInt(req.query.days as string) || 90);
      const deletedCount = await ErrorLog.cleanupOldErrors(daysToKeep);

      res.json({
        success: true,
        data: {
          deletedCount,
          daysToKeep
        },
        message: `Cleaned up ${deletedCount} old resolved errors`
      });

    } catch (error) {
      console.error('Error cleaning up error logs:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cleanup error logs'
      });
    }
  });
}

export default ErrorLoggingController;