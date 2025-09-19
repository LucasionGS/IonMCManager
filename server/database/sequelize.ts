import { Sequelize } from "sequelize";
import process from "node:process";

const dbName = process.env.DB_DATABASE || "ionmcmanager";
const dbUser = process.env.DB_USERNAME || "ionmcmanager";
const dbPassword = process.env.DB_PASSWORD || "ionmcmanager";
const dbHost = process.env.DB_HOST || "localhost";
const dbPort = process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306;

const sequelize = new Sequelize({
  dialect: "mysql",
  host: dbHost,
  port: dbPort,
  database: dbName,
  username: dbUser,
  password: dbPassword,
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
});

export default sequelize;