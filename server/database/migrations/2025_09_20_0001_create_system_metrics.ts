import { DataTypes } from "sequelize";
import { DBMigration } from "../migration.ts";

export default new DBMigration({
  async up(queryInterface): Promise<void> {
    await queryInterface.createTable('system_metrics', {
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
      },
      memoryUsage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
      },
      memoryTotal: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      memoryUsed: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      diskUsage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
      },
      diskTotal: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      diskUsed: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      networkRxBytes: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0,
      },
      networkTxBytes: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0,
      },
      loadAverage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0,
      },
      activeConnections: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      runningServers: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    });

    // Add indexes for better query performance
    await queryInterface.addIndex('system_metrics', ['timestamp']);
    await queryInterface.addIndex('system_metrics', ['timestamp', 'cpuUsage']);
    await queryInterface.addIndex('system_metrics', ['createdAt']);
  },

  async down(queryInterface): Promise<void> {
    await queryInterface.dropTable('system_metrics');
  }
});