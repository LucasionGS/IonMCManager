import { Router, Request, Response } from "express";
import { migrate, rollbackMigration, getMigrationStatus } from "../database/migration.ts";

namespace UpgradeController {
  export const router = Router();

  // Get migration status (works without database connection)
  router.get("/status", async (_req: Request, res: Response) => {
    try {
      const status = await getMigrationStatus();
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('Migration status error:', error);
      res.json({
        success: false,
        message: "Unable to check migration status",
        error: error instanceof Error ? error.message : "Unknown error",
        data: {
          canConnect: false,
          pendingMigrations: [],
          appliedMigrations: [],
          requiresSetup: true
        }
      });
    }
  });

  // Run migrations with password protection
  router.post("/migrate", async (req: Request, res: Response) => {
    try {
      const { password } = req.body;
      const expectedPassword = Deno.env.get('MIGRATION_PASSWORD');

      if (!expectedPassword) {
        return res.status(500).json({
          success: false,
          message: "Migration password not configured on server"
        });
      }

      if (!password || password !== expectedPassword) {
        return res.status(401).json({
          success: false,
          message: "Invalid migration password"
        });
      }

      console.log("Starting database migrations...");
      const appliedMigrations = await migrate();
      
      res.json({
        success: true,
        message: `Successfully applied ${appliedMigrations?.length || 0} migrations`,
        data: {
          appliedMigrations: appliedMigrations || [],
          totalApplied: appliedMigrations?.length || 0
        }
      });
    } catch (error) {
      console.error('Migration error:', error);
      res.status(500).json({
        success: false,
        message: "Migration failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Rollback migrations with password protection
  router.post("/rollback", async (req: Request, res: Response) => {
    try {
      const { password, count = 1 } = req.body;
      const expectedPassword = Deno.env.get('MIGRATION_PASSWORD');

      if (!expectedPassword) {
        return res.status(500).json({
          success: false,
          message: "Migration password not configured on server"
        });
      }

      if (!password || password !== expectedPassword) {
        return res.status(401).json({
          success: false,
          message: "Invalid migration password"
        });
      }

      console.log(`Rolling back ${count} migration(s)...`);
      const rolledbackMigrations = await rollbackMigration(count);
      
      res.json({
        success: true,
        message: `Successfully rolled back ${rolledbackMigrations.length} migrations`,
        data: {
          rolledbackMigrations,
          totalRolledback: rolledbackMigrations.length
        }
      });
    } catch (error) {
      console.error('Rollback error:', error);
      res.status(500).json({
        success: false,
        message: "Rollback failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Legacy GET endpoints for backwards compatibility (without password protection)
  router.get("/migrate", async (_req: Request, res: Response) => {
    try {
      const migrations = await migrate();
      res.json({ migrations });
    } catch (error) {
      console.error('Migration error:', error);
      res.status(500).json({
        success: false,
        message: "Migration failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  router.get("/rollback", async (_req: Request, res: Response) => {
    try {
      const migrations = await rollbackMigration();
      res.json({ migrations });
    } catch (error) {
      console.error('Rollback error:', error);
      res.status(500).json({
        success: false,
        message: "Rollback failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
}

export default UpgradeController;