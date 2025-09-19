import metadata from "../metadata.ts";
import Migration from "./models/Migration.ts";
import sequelize from "./sequelize.ts";
import { QueryInterface } from "sequelize";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const migrationsPath = path.join(import.meta.dirname!, "migrations");

export async function migrate() {
  const newMigrations: DBMigration[] = [];
  // Check for existing table for migrations
  if (!(await sequelize.getQueryInterface().tableExists("Migrations"))) {
    await Migration.sync();
  }

  const migrations = await getMigrationFiles();

  console.log(`Found ${migrations.length} migrations. Checked ${migrationsPath}.`);
  const existingMigrations = await Migration.findAll().then(rows => rows.map(r => r.version));
  
  // Apply migrations
  for (const migration of migrations) {
    if (!existingMigrations.includes(migration.version)) {
      console.log(`Applying migration ${migration.version}...`);
      const qi = sequelize.getQueryInterface();
      const t = await sequelize.transaction();
      await qi.startTransaction(t);
      try {
        await migration.up(qi);
      } catch (error) {
        console.error(`Migration ${migration.version} failed:`, error);
        await qi.rollbackTransaction(t);
        return;
      }
      await qi.commitTransaction(t);
      newMigrations.push(migration);
      await Migration.create({ version: migration.version });
      console.log(`Migration ${migration.version} applied.`);
    }
  }

  console.log("Upgrading database...");
  console.log("Current version:", metadata.version);

  return newMigrations.map(m => m.version);
}

export async function rollbackMigration(count = 1) {
  const migrations = await getMigrationFiles();
  const appliedMigrations = await Migration.findAll({
    order: [["createdAt", "DESC"]],
    limit: count
  });

  const rolledbackMigrations: DBMigration[] = [];
  
  for (const migrationRecord of appliedMigrations) {
    const migration = migrations.find(m => m.version === migrationRecord.version);
    if (migration) {
      console.log(`Rolling back migration ${migration.version}...`);
      await migration.down(sequelize.getQueryInterface());
      await migrationRecord.destroy();
      console.log(`Migration ${migration.version} rolled back.`);
      rolledbackMigrations.push(migration);
    } else {
      console.warn(`Migration ${migrationRecord.version} not found, cannot roll back.`);
    }
  }

  return rolledbackMigrations.map(m => m.version);
}

async function getMigrationFiles(): Promise<DBMigration[]> {
  const migrations = await fs.promises.readdir(migrationsPath).then(
    files => files
    .filter(file => file.endsWith(".ts"))
    .map(async file => {
      const mod = (await import(path.join(migrationsPath, file))).default as DBMigration;
      try {
        mod.version = file.replace(/\.ts$/, "");
      } catch (error) {
        console.error(`Error setting version for migration ${file}:`, error);
        process.exit()
      }
      return mod
    })
  )
    .then(modules => Promise.all(modules))
    .then(mods => mods.sort((a, b) => a.version.localeCompare(b.version)));
  return migrations;
}

export class DBMigration {
  public declare version: string;
  public up: (queryInterface: QueryInterface) => Promise<void>;
  public down: (queryInterface: QueryInterface) => Promise<void>;

  constructor({
    up = async (_queryInterface: QueryInterface) => {},
    down = async (_queryInterface: QueryInterface) => {}
  }) {
    this.up = up;
    this.down = down;
  }
}