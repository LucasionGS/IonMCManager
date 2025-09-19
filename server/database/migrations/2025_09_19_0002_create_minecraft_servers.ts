import { DataTypes } from "sequelize";
import { DBMigration } from "../migration.ts";

export default new DBMigration({
  async up(queryInterface): Promise<void> {
    await queryInterface.createTable('minecraft_servers', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      minecraftVersion: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      serverType: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      forgeVersion: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('stopped', 'starting', 'running', 'stopping', 'crashed', 'creating', 'error'),
        allowNull: false,
        defaultValue: 'stopped',
      },
      memory: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1024,
        comment: 'Memory allocation in MB',
      },
      port: {
        type: DataTypes.INTEGER,
        allowNull: true,
        unique: true,
        validate: {
          min: 1024,
          max: 65535,
        },
      },
      serverPath: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'Absolute path to server directory',
      },
      jarFile: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Name of the server jar file',
      },
      maxPlayers: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 20,
        validate: {
          min: 1,
          max: 1000,
        },
      },
      motd: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: 'A Minecraft Server',
      },
      difficulty: {
        type: DataTypes.ENUM('peaceful', 'easy', 'normal', 'hard'),
        allowNull: false,
        defaultValue: 'normal',
      },
      gamemode: {
        type: DataTypes.ENUM('survival', 'creative', 'adventure', 'spectator'),
        allowNull: false,
        defaultValue: 'survival',
      },
      allowNether: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      enablePvp: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      enableCommandBlock: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      worldSeed: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      worldType: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'default',
      },
      onlineMode: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      enableWhitelist: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      lastStarted: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      lastStopped: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      totalUptime: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Total uptime in seconds',
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });

    // Create indexes for better query performance
    await queryInterface.addIndex('minecraft_servers', ['userId']);
    await queryInterface.addIndex('minecraft_servers', ['status']);
    await queryInterface.addIndex('minecraft_servers', ['serverType']);
    await queryInterface.addIndex('minecraft_servers', ['minecraftVersion']);
    await queryInterface.addIndex('minecraft_servers', ['port']);
    await queryInterface.addIndex('minecraft_servers', ['name', 'userId'], { unique: true }); // Unique server name per user
  },

  async down(queryInterface) {
    await queryInterface.dropTable('minecraft_servers');
  }
});