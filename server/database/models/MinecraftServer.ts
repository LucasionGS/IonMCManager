import sequelize from "../sequelize.ts";
import { Op, DataTypes, Model, Sequelize, Association } from "sequelize";
import User from "./User.ts";

export interface MinecraftServerAttributes {
  id?: number;
  userId: number;
  name: string;
  description?: string;
  minecraftVersion: string;
  serverType: string;
  forgeVersion?: string;
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'crashed' | 'creating' | 'error';
  memory: number;
  port?: number;
  serverPath?: string;
  jarFile?: string;
  maxPlayers: number;
  motd?: string;
  difficulty: 'peaceful' | 'easy' | 'normal' | 'hard';
  gamemode: 'survival' | 'creative' | 'adventure' | 'spectator';
  allowNether: boolean;
  enablePvp: boolean;
  enableCommandBlock: boolean;
  worldSeed?: string;
  worldType: string;
  onlineMode: boolean;
  enableWhitelist: boolean;
  lastStarted?: Date;
  lastStopped?: Date;
  totalUptime: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MinecraftServerCreationAttributes extends Omit<MinecraftServerAttributes, 'id' | 'createdAt' | 'updatedAt' | 'lastStarted' | 'lastStopped' | 'totalUptime'> {}

export default class MinecraftServer extends Model<MinecraftServerAttributes, MinecraftServerCreationAttributes> implements MinecraftServerAttributes {
  declare id: number;
  declare userId: number;
  declare name: string;
  declare description?: string;
  declare minecraftVersion: string;
  declare serverType: string;
  declare forgeVersion?: string;
  declare status: 'stopped' | 'starting' | 'running' | 'stopping' | 'crashed' | 'creating' | 'error';
  declare memory: number;
  declare port?: number;
  declare serverPath?: string;
  declare jarFile?: string;
  declare maxPlayers: number;
  declare motd?: string;
  declare difficulty: 'peaceful' | 'easy' | 'normal' | 'hard';
  declare gamemode: 'survival' | 'creative' | 'adventure' | 'spectator';
  declare allowNether: boolean;
  declare enablePvp: boolean;
  declare enableCommandBlock: boolean;
  declare worldSeed?: string;
  declare worldType: string;
  declare onlineMode: boolean;
  declare enableWhitelist: boolean;
  declare lastStarted?: Date;
  declare lastStopped?: Date;
  declare totalUptime: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  // Associations
  declare user?: User;
  declare static associations: {
    user: Association<MinecraftServer, User>;
  };

  // Instance methods
  public isRunning(): boolean {
    return this.status === 'running';
  }

  public isStopped(): boolean {
    return this.status === 'stopped';
  }

  public isTransitioning(): boolean {
    return ['starting', 'stopping', 'creating'].includes(this.status);
  }

  public hasError(): boolean {
    return ['crashed', 'error'].includes(this.status);
  }

  public getUptimeHours(): number {
    return Math.floor(this.totalUptime / 3600);
  }

  public getFormattedUptime(): string {
    const hours = Math.floor(this.totalUptime / 3600);
    const minutes = Math.floor((this.totalUptime % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  public async updateStatus(newStatus: MinecraftServerAttributes['status']): Promise<void> {
    const now = new Date();
    
    // Handle status transitions
    if (this.status === 'running' && newStatus === 'stopped') {
      this.lastStopped = now;
      if (this.lastStarted) {
        const uptimeSeconds = Math.floor((now.getTime() - this.lastStarted.getTime()) / 1000);
        this.totalUptime += uptimeSeconds;
      }
    } else if (this.status !== 'running' && newStatus === 'running') {
      this.lastStarted = now;
    }

    this.status = newStatus;
    await this.save();
  }

  public getDisplayInfo() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      minecraftVersion: this.minecraftVersion,
      serverType: this.serverType,
      forgeVersion: this.forgeVersion,
      status: this.status,
      memory: this.memory,
      port: this.port,
      maxPlayers: this.maxPlayers,
      motd: this.motd,
      difficulty: this.difficulty,
      gamemode: this.gamemode,
      allowNether: this.allowNether,
      enablePvp: this.enablePvp,
      enableCommandBlock: this.enableCommandBlock,
      worldType: this.worldType,
      onlineMode: this.onlineMode,
      enableWhitelist: this.enableWhitelist,
      lastStarted: this.lastStarted,
      lastStopped: this.lastStopped,
      uptime: this.getFormattedUptime(),
      uptimeHours: this.getUptimeHours(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // Static methods
  public static findByUser(userId: number): Promise<MinecraftServer[]> {
    return this.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']]
    });
  }

  public static findByUserAndName(userId: number, name: string): Promise<MinecraftServer | null> {
    return this.findOne({
      where: { userId, name }
    });
  }

  public static findRunningServers(): Promise<MinecraftServer[]> {
    return this.findAll({
      where: { status: 'running' },
      include: [{ model: User, as: 'user', attributes: ['id', 'username'] }]
    });
  }

  public static findByStatus(status: MinecraftServerAttributes['status']): Promise<MinecraftServer[]> {
    return this.findAll({
      where: { status },
      include: [{ model: User, as: 'user', attributes: ['id', 'username'] }]
    });
  }

  public static async getNextAvailablePort(startPort = 25565): Promise<number> {
    const usedPorts = await this.findAll({
      attributes: ['port'],
      where: {
        port: {
          [Op.ne]: null as unknown as number
        }
      }
    });
    
    const usedPortNumbers = usedPorts.map(server => server.port).filter(Boolean) as number[];
    
    let port = startPort;
    while (usedPortNumbers.includes(port)) {
      port++;
    }
    
    return port;
  }

  public static async createServer(serverData: Omit<MinecraftServerCreationAttributes, "status">): Promise<MinecraftServer> {
    // Assign next available port if not provided
    if (!serverData.port) {
      serverData.port = await this.getNextAvailablePort();
    }

    return this.create({
      ...serverData,
      status: 'creating'
    });
  }
}

MinecraftServer.init(
  {
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
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [1, 100],
        notEmpty: true,
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    minecraftVersion: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    serverType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
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
      validate: {
        min: 512,
        max: 32768,
      },
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
    },
    jarFile: {
      type: DataTypes.STRING(255),
      allowNull: true,
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
    },
  },
  {
    sequelize,
    modelName: 'MinecraftServer',
    tableName: 'minecraft_servers',
    timestamps: true,
    indexes: [
      {
        fields: ['userId']
      },
      {
        fields: ['status']
      },
      {
        fields: ['serverType']
      },
      {
        fields: ['minecraftVersion']
      },
      {
        fields: ['port'],
        unique: true,
        where: {
          port: {
            [Op.ne]: null
          }
        }
      },
      {
        fields: ['name', 'userId'],
        unique: true
      }
    ],
  }
);

// Define associations
User.hasMany(MinecraftServer, {
  foreignKey: 'userId',
  as: 'servers'
});

MinecraftServer.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});