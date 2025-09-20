import sequelize from "../sequelize.ts";
import { DataTypes, Model, Op } from "sequelize";

export interface SystemMetricsAttributes {
  id?: number;
  timestamp: Date;
  cpuUsage: number; // Percentage 0-100
  memoryUsage: number; // Percentage 0-100
  memoryTotal: number; // In bytes
  memoryUsed: number; // In bytes
  diskUsage: number; // Percentage 0-100
  diskTotal: number; // In bytes
  diskUsed: number; // In bytes
  networkRxBytes: number; // Bytes received
  networkTxBytes: number; // Bytes transmitted
  loadAverage: number; // System load average (1 minute)
  activeConnections: number; // Number of active socket connections
  runningServers: number; // Number of running minecraft servers
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SystemMetricsCreationAttributes extends Omit<SystemMetricsAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export default class SystemMetrics extends Model<SystemMetricsAttributes, SystemMetricsCreationAttributes> implements SystemMetricsAttributes {
  declare id: number;
  declare timestamp: Date;
  declare cpuUsage: number;
  declare memoryUsage: number;
  declare memoryTotal: number;
  declare memoryUsed: number;
  declare diskUsage: number;
  declare diskTotal: number;
  declare diskUsed: number;
  declare networkRxBytes: number;
  declare networkTxBytes: number;
  declare loadAverage: number;
  declare activeConnections: number;
  declare runningServers: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  // Static methods
  public static getLatestMetrics(limit: number = 100): Promise<SystemMetrics[]> {
    return this.findAll({
      order: [['timestamp', 'DESC']],
      limit
    });
  }

  public static getMetricsInRange(startDate: Date, endDate: Date): Promise<SystemMetrics[]> {
    return this.findAll({
      where: {
        timestamp: {
          [Op.between]: [startDate, endDate]
        }
      },
      order: [['timestamp', 'ASC']]
    });
  }

  public static async cleanupOldMetrics(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const result = await this.destroy({
      where: {
        timestamp: {
          [Op.lt]: cutoffDate
        }
      }
    });
    
    return result;
  }

  public static async getAverageMetrics(hours: number = 24) {
    try {
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - hours);

      const metrics = await this.findAll({
        where: {
          timestamp: {
            [Op.gte]: startDate
          }
        },
        attributes: [
          [sequelize.fn('AVG', sequelize.col('cpuUsage')), 'avgCpuUsage'],
          [sequelize.fn('AVG', sequelize.col('memoryUsage')), 'avgMemoryUsage'],
          [sequelize.fn('AVG', sequelize.col('diskUsage')), 'avgDiskUsage'],
          [sequelize.fn('AVG', sequelize.col('loadAverage')), 'avgLoadAverage'],
          [sequelize.fn('MAX', sequelize.col('cpuUsage')), 'maxCpuUsage'],
          [sequelize.fn('MAX', sequelize.col('memoryUsage')), 'maxMemoryUsage'],
          [sequelize.fn('AVG', sequelize.col('activeConnections')), 'avgActiveConnections'],
          [sequelize.fn('AVG', sequelize.col('runningServers')), 'avgRunningServers']
        ],
        raw: true
      });

      return metrics[0] || {
        avgCpuUsage: 0,
        avgMemoryUsage: 0,
        avgDiskUsage: 0,
        avgLoadAverage: 0,
        maxCpuUsage: 0,
        maxMemoryUsage: 0,
        avgActiveConnections: 0,
        avgRunningServers: 0
      };
    } catch (error) {
      console.error('Error getting average metrics:', error);
      return {
        avgCpuUsage: 0,
        avgMemoryUsage: 0,
        avgDiskUsage: 0,
        avgLoadAverage: 0,
        maxCpuUsage: 0,
        maxMemoryUsage: 0,
        avgActiveConnections: 0,
        avgRunningServers: 0
      };
    }
  }
}

SystemMetrics.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    cpuUsage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate: {
        min: 0,
        max: 100,
      },
    },
    memoryUsage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate: {
        min: 0,
        max: 100,
      },
    },
    memoryTotal: {
      type: DataTypes.BIGINT,
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    memoryUsed: {
      type: DataTypes.BIGINT,
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    diskUsage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate: {
        min: 0,
        max: 100,
      },
    },
    diskTotal: {
      type: DataTypes.BIGINT,
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    diskUsed: {
      type: DataTypes.BIGINT,
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    networkRxBytes: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    networkTxBytes: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    loadAverage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    activeConnections: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    runningServers: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
  },
  {
    sequelize,
    modelName: 'SystemMetrics',
    tableName: 'system_metrics',
    timestamps: true,
    indexes: [
      {
        fields: ['timestamp']
      },
      {
        fields: ['timestamp', 'cpuUsage']
      },
      {
        fields: ['createdAt']
      }
    ],
  }
);