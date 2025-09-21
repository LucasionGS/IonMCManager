import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import cors from "cors";
import process from "node:process";
import ApiController from "./controllers/ApiController.ts";
import metadata from "./metadata.ts";
import MonitoringService from "./services/MonitoringService.ts";

console.log(`Starting`, metadata);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Export io instance for use in other modules
export { io };

// Initialize monitoring service
const monitoringService = new MonitoringService();

const port = process.env.INTERNAL_PORT || 3174;

// CORS configuration
const corsOptions = {
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '100mb' })); // Increase JSON payload limit
app.use(express.urlencoded({ extended: true, limit: '100mb' })); // Increase URL encoded payload limit

// Configure request timeout for the entire app
app.use((req, _res, next) => {
  // Set longer timeout for file upload routes
  if (req.path.includes('/mods') && req.method === 'POST') {
    req.setTimeout(300000); // 5 minutes for file uploads
  }
  next();
});

// Routes
app.use("/api", ApiController.router);

app.get("/", (_req, res) => {
  res.send("Hello World!");
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Start server
function startServer() {
  try {
    // Start monitoring service
    monitoringService.startCollection();
    
    httpServer.listen(port, () => {
      console.log(`Server is running on port ${port}`);
      console.log(`Socket.IO is ready for connections`);
      console.log(`System monitoring started`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();