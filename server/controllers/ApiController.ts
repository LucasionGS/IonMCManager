import { Router } from "express";
import UpgradeController from "./UpgradeController.ts";
import AuthController from "./AuthController.ts";
import ServerController from "./ServerController.ts";
import AdminController from "./AdminController.ts";
import MonitoringController from "./MonitoringController.ts";
import ErrorLoggingController from "./ErrorLoggingController.ts";

namespace ApiController {
  export const router = Router();
  
  router.get("/", (_req, res) => {
    res.json({ message: "Hello from the API!" });
  });

  router.use("/upgrade", UpgradeController.router);
  router.use("/auth", AuthController.router);
  router.use("/servers", ServerController.router);
  router.use("/admin", AdminController.router);
  router.use("/monitoring", MonitoringController.router);
  router.use("/errors", ErrorLoggingController.router);
}

export default ApiController;