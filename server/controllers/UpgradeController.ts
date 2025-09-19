import { Router } from "express";
import { migrate, rollbackMigration } from "../database/migration.ts";

namespace UpgradeController {
  export const router = Router();
  
  router.get("/migrate", async (req, res) => {
    const migrations = await migrate();
    res.json({ migrations });
  });
  
  router.get("/rollback", async (req, res) => {
    const migrations = await rollbackMigration();
    res.json({ migrations });
  });
}

export default UpgradeController;