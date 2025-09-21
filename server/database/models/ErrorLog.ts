import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../sequelize.ts';

export interface ErrorLogAttributes {
  id: number;
  message: string;
  stackTrace: string | null;
  source: 'server' | 'client';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId: number | null;
  userAgent: string | null;
  url: string | null;
  method: string | null;
  statusCode: number | null;
  userInfo: string | null; // JSON string with additional user context
  errorCode: string | null;
  resolved: boolean;
  resolvedBy: number | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ErrorLogCreationAttributes extends Optional<ErrorLogAttributes, 'id' | 'stackTrace' | 'userId' | 'userAgent' | 'url' | 'method' | 'statusCode' | 'userInfo' | 'errorCode' | 'resolved' | 'resolvedBy' | 'resolvedAt' | 'createdAt' | 'updatedAt'> {}

class ErrorLog extends Model<ErrorLogAttributes, ErrorLogCreationAttributes> implements ErrorLogAttributes {
  public declare id: number;
  public declare message: string;
  public declare stackTrace: string | null;
  public declare source: 'server' | 'client';
  public declare severity: 'low' | 'medium' | 'high' | 'critical';
  public declare userId: number | null;
  public declare userAgent: string | null;
  public declare url: string | null;
  public declare method: string | null;
  public declare statusCode: number | null;
  public declare userInfo: string | null;
  public declare errorCode: string | null;
  public declare resolved: boolean;
  public declare resolvedBy: number | null;
  public declare resolvedAt: Date | null;
  public declare readonly createdAt: Date;
  public declare readonly updatedAt: Date;

  // Static methods for queries
  static async getErrorLogs(options: {
    limit?: number;
    offset?: number;
    source?: 'server' | 'client';
    severity?: 'low' | 'medium' | 'high' | 'critical';
    resolved?: boolean;
    userId?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<{ rows: ErrorLog[], count: number }> {
    const {
      limit = 50,
      offset = 0,
      source,
      severity,
      resolved,
      userId,
      startDate,
      endDate
    } = options;

    const whereClause: Record<string, unknown> = {};

    if (source) whereClause.source = source;
    if (severity) whereClause.severity = severity;
    if (resolved !== undefined) whereClause.resolved = resolved;
    if (userId) whereClause.userId = userId;

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.gte = startDate;
      if (endDate) dateFilter.lte = endDate;
      whereClause.createdAt = dateFilter;
    }

    return await ErrorLog.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });
  }

  static async getErrorStats(): Promise<{
    totalErrors: number;
    unresolvedErrors: number;
    serverErrors: number;
    clientErrors: number;
    criticalErrors: number;
    recentErrors: number; // Last 24 hours
  }> {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      totalErrors,
      unresolvedErrors,
      serverErrors,
      clientErrors,
      criticalErrors,
      recentErrors
    ] = await Promise.all([
      ErrorLog.count(),
      ErrorLog.count({ where: { resolved: false } }),
      ErrorLog.count({ where: { source: 'server' } }),
      ErrorLog.count({ where: { source: 'client' } }),
      ErrorLog.count({ where: { severity: 'critical' } }),
      ErrorLog.count({ where: { createdAt: { gte: yesterday } } })
    ]);

    return {
      totalErrors,
      unresolvedErrors,
      serverErrors,
      clientErrors,
      criticalErrors,
      recentErrors
    };
  }

  static async cleanupOldErrors(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    const deletedCount = await ErrorLog.destroy({
      where: {
        createdAt: { lt: cutoffDate },
        resolved: true // Only delete resolved errors
      }
    });

    return deletedCount;
  }

  // Instance methods
  public async markResolved(resolvedByUserId: number): Promise<void> {
    await this.update({
      resolved: true,
      resolvedBy: resolvedByUserId,
      resolvedAt: new Date()
    });
  }

  public async markUnresolved(): Promise<void> {
    await this.update({
      resolved: false,
      resolvedBy: null,
      resolvedAt: null
    });
  }

  public getUserInfoObject(): Record<string, unknown> | null {
    if (!this.userInfo) return null;
    try {
      return JSON.parse(this.userInfo);
    } catch {
      return null;
    }
  }

  public getFormattedStackTrace(): string[] {
    if (!this.stackTrace) return [];
    return this.stackTrace.split('\n').filter(line => line.trim().length > 0);
  }
}

ErrorLog.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  stackTrace: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
  },
  source: {
    type: DataTypes.ENUM('server', 'client'),
    allowNull: false,
  },
  severity: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    allowNull: false,
    defaultValue: 'medium',
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  url: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  method: {
    type: DataTypes.STRING(10),
    allowNull: true,
  },
  statusCode: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  userInfo: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  errorCode: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  resolved: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  resolvedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  resolvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
  }
}, {
  sequelize,
  modelName: 'ErrorLog',
  tableName: 'error_logs',
  timestamps: true,
  indexes: [
    {
      fields: ['source']
    },
    {
      fields: ['severity']
    },
    {
      fields: ['resolved']
    },
    {
      fields: ['userId']
    },
    {
      fields: ['createdAt']
    },
    {
      fields: ['source', 'severity']
    },
    {
      fields: ['resolved', 'createdAt']
    }
  ]
});

export default ErrorLog;