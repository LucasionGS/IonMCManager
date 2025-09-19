import { Router } from "express";
import UpgradeController from "./UpgradeController.ts";

namespace ApiController {
  export const router = Router();
  
  router.get("/", (req, res) => {
    res.json({ message: "Hello from the API!" });
  });

  router.use("/upgrade", UpgradeController.router);
}

export default ApiController;