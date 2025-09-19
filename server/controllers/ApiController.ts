import { Router } from "express";
import UpgradeController from "./UpgradeController.ts";
import AuthController from "./AuthController.ts";
import ServerController from "./ServerController.ts";
import AdminController from "./AdminController.ts";

namespace ApiController {
  export const router = Router();
  
  router.get("/", (req, res) => {
    res.json({ message: "Hello from the API!" });
  });

  router.use("/upgrade", UpgradeController.router);
  router.use("/auth", AuthController.router);
  router.use("/servers", ServerController.router);
  router.use("/admin", AdminController.router);
}

export default ApiController;