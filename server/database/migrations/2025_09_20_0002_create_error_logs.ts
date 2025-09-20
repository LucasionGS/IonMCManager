import { DataTypes } from "sequelize";
import { DBMigration } from "../migration.ts";

export default new DBMigration({
  async up(queryInterface): Promise<void> {
    await queryInterface.createTable('error_logs', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      stackTrace: {
        type: DataTypes.TEXT('long'),
        allowNull: true
      },
      source: {
        type: DataTypes.ENUM('server', 'client'),
        allowNull: false
      },
      severity: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
        allowNull: false,
        defaultValue: 'medium'
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      userAgent: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      url: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      method: {
        type: DataTypes.STRING(10),
        allowNull: true
      },
      statusCode: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      userInfo: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      errorCode: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      resolved: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      resolvedBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      resolvedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    });

    // Create indexes for better query performance
    await queryInterface.addIndex('error_logs', ['source']);
    await queryInterface.addIndex('error_logs', ['severity']);
    await queryInterface.addIndex('error_logs', ['resolved']);
    await queryInterface.addIndex('error_logs', ['userId']);
    await queryInterface.addIndex('error_logs', ['createdAt']);
    await queryInterface.addIndex('error_logs', ['source', 'severity']);
    await queryInterface.addIndex('error_logs', ['resolved', 'createdAt']);
  },

  async down(queryInterface): Promise<void> {
    await queryInterface.dropTable('error_logs');
  }
});