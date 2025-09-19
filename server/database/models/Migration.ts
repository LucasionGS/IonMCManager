import { Model, DataTypes } from "sequelize";
import sequelize from "../sequelize.ts";

export default class Migration extends Model {
  declare id: number;
  declare version: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Migration.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    version: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    }
  },
  {
    sequelize
  }
);