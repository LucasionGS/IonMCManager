import ErrorLog from '../database/models/ErrorLog.ts';

interface ErrorLogData {
  message: string;
  stackTrace?: string;
  source: 'server' | 'client';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  userId?: number | null;
  userAgent?: string | null;
  url?: string | null;
  method?: string | null;
  statusCode?: number | null;
  userInfo?: Record<string, unknown> | null;
  errorCode?: string | null;
}

class ErrorLoggingService {
  /**
   * Log an error to the database
   */
  async logError(errorData: ErrorLogData): Promise<{ success: boolean; message: string; errorId?: number }> {
    try {
      // Clean and validate stack trace
      const cleanStackTrace = this.cleanStackTrace(errorData.stackTrace);
      
      // Determine severity if not provided
      const severity = errorData.severity || this.determineSeverity(errorData);

      // Create the error log entry
      const errorLog = await ErrorLog.create({
        message: errorData.message,
        stackTrace: cleanStackTrace,
        source: errorData.source,
        severity,
        userId: errorData.userId,
        userAgent: errorData.userAgent,
        url: errorData.url,
        method: errorData.method,
        statusCode: errorData.statusCode,
        userInfo: errorData.userInfo ? JSON.stringify(errorData.userInfo) : null,
        errorCode: errorData.errorCode
      });

      return {
        success: true,
        message: 'Error logged successfully',
        errorId: errorLog.id
      };

    } catch (error) {
      console.error('Failed to log error to database:', error);
      return {
        success: false,
        message: 'Failed to log error to database'
      };
    }
  }

  /**
   * Log a server-side error with enhanced context
   */
  async logServerError(
    error: Error, 
    context: {
      userId?: number;
      url?: string;
      method?: string;
      statusCode?: number;
      userAgent?: string;
      additionalInfo?: Record<string, unknown>;
    } = {}
  ): Promise<{ success: boolean; message: string; errorId?: number }> {
    const errorData: ErrorLogData = {
      message: error.message,
      stackTrace: error.stack,
      source: 'server',
      severity: this.getServerErrorSeverity(error, context.statusCode),
      userId: context.userId,
      userAgent: context.userAgent,
      url: context.url,
      method: context.method,
      statusCode: context.statusCode,
      userInfo: context.additionalInfo,
      errorCode: this.extractErrorCode(error)
    };

    return await this.logError(errorData);
  }

  /**
   * Log a client-side error
   */
  async logClientError(
    message: string,
    stackTrace?: string,
    context: {
      userId?: number;
      userAgent?: string;
      url?: string;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      userInfo?: Record<string, unknown>;
      errorCode?: string;
    } = {}
  ): Promise<{ success: boolean; message: string; errorId?: number }> {
    const errorData: ErrorLogData = {
      message,
      stackTrace,
      source: 'client',
      severity: context.severity || 'medium',
      userId: context.userId,
      userAgent: context.userAgent,
      url: context.url,
      userInfo: context.userInfo,
      errorCode: context.errorCode
    };

    return await this.logError(errorData);
  }

  /**
   * Clean and format stack trace for better readability
   */
  private cleanStackTrace(stackTrace?: string): string | null {
    if (!stackTrace) return null;

    try {
      // Remove sensitive information and clean up paths
      return stackTrace
        .split('\n')
        .map(line => {
          // Remove file system paths for security
          return line.replace(/file:\/\/\/[^:]+/g, 'file:///<path>')
                    .replace(/at file:\/\/\/[^:]+:/g, 'at <path>:')
                    .trim();
        })
        .filter(line => line.length > 0)
        .slice(0, 50) // Limit stack trace length
        .join('\n');
    } catch {
      return stackTrace.substring(0, 5000); // Fallback: truncate if processing fails
    }
  }

  /**
   * Determine error severity based on context
   */
  private determineSeverity(errorData: ErrorLogData): 'low' | 'medium' | 'high' | 'critical' {
    // Critical errors
    if (errorData.statusCode === 500 || 
        errorData.message.toLowerCase().includes('database') ||
        errorData.message.toLowerCase().includes('connection') ||
        errorData.message.toLowerCase().includes('timeout')) {
      return 'critical';
    }

    // High severity errors
    if (errorData.statusCode === 403 || 
        errorData.statusCode === 401 ||
        errorData.message.toLowerCase().includes('permission') ||
        errorData.message.toLowerCase().includes('unauthorized')) {
      return 'high';
    }

    // Low severity errors
    if (errorData.statusCode === 400 || 
        errorData.statusCode === 404 ||
        errorData.message.toLowerCase().includes('validation') ||
        errorData.message.toLowerCase().includes('not found')) {
      return 'low';
    }

    // Default to medium severity
    return 'medium';
  }

  /**
   * Determine server error severity based on error type and status code
   */
  private getServerErrorSeverity(error: Error, statusCode?: number): 'low' | 'medium' | 'high' | 'critical' {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();

    // Critical system errors
    if (errorName.includes('typeerror') && errorMessage.includes('cannot read')) {
      return 'critical';
    }

    if (errorMessage.includes('econnrefused') || 
        errorMessage.includes('sequelize') ||
        errorMessage.includes('database') ||
        statusCode === 500) {
      return 'critical';
    }

    // High priority errors
    if (statusCode === 403 || statusCode === 401 || 
        errorMessage.includes('jwt') ||
        errorMessage.includes('authentication')) {
      return 'high';
    }

    // Low priority errors
    if (statusCode === 400 || statusCode === 404) {
      return 'low';
    }

    return 'medium';
  }

  /**
   * Extract error code from error object if available
   */
  private extractErrorCode(error: Error): string | null {
    // Try to extract error codes from common error types
    const errorWithCode = error as Error & { 
      code?: string | number; 
      errno?: number; 
      status?: number; 
    };
    
    if (errorWithCode.code) return errorWithCode.code.toString();
    if (errorWithCode.errno) return errorWithCode.errno.toString();
    if (errorWithCode.status) return errorWithCode.status.toString();
    
    return null;
  }

  /**
   * Get error statistics for admin dashboard
   */
  async getErrorStatistics(): Promise<{
    success: boolean;
    data?: {
      totalErrors: number;
      unresolvedErrors: number;
      serverErrors: number;
      clientErrors: number;
      criticalErrors: number;
      recentErrors: number;
      errorTrends: {
        today: number;
        yesterday: number;
        thisWeek: number;
        lastWeek: number;
      };
    };
    message: string;
  }> {
    try {
      const baseStats = await ErrorLog.getErrorStats();
      
      // Get trend data
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
      
      const lastWeekStart = new Date(thisWeekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const lastWeekEnd = new Date(thisWeekStart);

      const [todayCount, yesterdayCount, thisWeekCount, lastWeekCount] = await Promise.all([
        ErrorLog.count({ where: { createdAt: { gte: today } } }),
        ErrorLog.count({ 
          where: { 
            createdAt: { 
              gte: yesterday, 
              lt: today 
            } 
          } 
        }),
        ErrorLog.count({ where: { createdAt: { gte: thisWeekStart } } }),
        ErrorLog.count({ 
          where: { 
            createdAt: { 
              gte: lastWeekStart, 
              lt: lastWeekEnd 
            } 
          } 
        })
      ]);

      return {
        success: true,
        data: {
          ...baseStats,
          errorTrends: {
            today: todayCount,
            yesterday: yesterdayCount,
            thisWeek: thisWeekCount,
            lastWeek: lastWeekCount
          }
        },
        message: 'Error statistics retrieved successfully'
      };

    } catch (error) {
      console.error('Failed to get error statistics:', error);
      return {
        success: false,
        message: 'Failed to get error statistics'
      };
    }
  }

  /**
   * Clean up old resolved errors
   */
  async cleanupOldErrors(daysToKeep: number = 90): Promise<{ success: boolean; message: string; deletedCount?: number }> {
    try {
      const deletedCount = await ErrorLog.cleanupOldErrors(daysToKeep);
      
      return {
        success: true,
        message: `Successfully cleaned up ${deletedCount} old resolved errors`,
        deletedCount
      };
    } catch (error) {
      console.error('Failed to cleanup old errors:', error);
      return {
        success: false,
        message: 'Failed to cleanup old errors'
      };
    }
  }
}

export default ErrorLoggingService;