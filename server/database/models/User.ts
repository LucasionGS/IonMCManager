import sequelize from "../sequelize.ts";
import { DataTypes, Model, Sequelize } from "sequelize";
import bcrypt from "bcrypt";
import MinecraftServer from "./MinecraftServer.ts";

export interface UserAttributes {
  id?: number;
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
  isActive: boolean;
  serverLimit: number;
  lastLogin?: Date;
  createdAt?: Date;
  updatedAt?: Date;

  servers?: MinecraftServer[];
}

export interface UserCreationAttributes extends Omit<UserAttributes, 'id' | 'createdAt' | 'updatedAt' | 'lastLogin'> {}

export default class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  declare id: number;
  declare username: string;
  declare email: string;
  declare password: string;
  declare role: 'admin' | 'user';
  declare isActive: boolean;
  declare serverLimit: number;
  declare lastLogin?: Date;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  public get isAdmin(): boolean {
    return this.role === 'admin';
  }

  // Instance methods
  public comparePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password);
  }

  public override toJSON(): Omit<UserAttributes, 'password'> {
    const values = { ...this.get(), isAdmin: this.isAdmin };
    const { password: _password, ...userWithoutPassword } = values;
    return { ...userWithoutPassword };
  }

  // Static methods
  public static hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  public static findByUsername(username: string): Promise<User | null> {
    return this.findOne({ where: { username } });
  }

  public static findByEmail(email: string): Promise<User | null> {
    return this.findOne({ where: { email } });
  }

  public static async createUser(userData: UserCreationAttributes): Promise<User> {
    const hashedPassword = await this.hashPassword(userData.password);
    return this.create({
      ...userData,
      password: hashedPassword
    });
  }
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        len: [3, 50],
        isAlphanumeric: true,
      },
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        len: [6, 255],
      },
    },
    role: {
      type: DataTypes.ENUM('admin', 'user'),
      allowNull: false,
      defaultValue: 'user',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    serverLimit: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
      validate: {
        min: 0,
        max: 100,
      },
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    hooks: {
      beforeUpdate: async (user: User) => {
        if (user.changed('password')) {
          user.password = await User.hashPassword(user.password);
        }
      },
    },
  }
);