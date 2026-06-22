import "dotenv/config";
import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import { config } from "./config/index.js";
import { createMcpRouter } from "./mcp/index.js";
import { apiRouter } from "./api/index.js";
import { wellKnownRouter, oidcRouter } from "./api/routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/index.js";
import { isDatabaseInitialized, getDb } from "./db/index.js";
import { createTables } from "./db/schema.js";

// Initialize database
if (!isDatabaseInitialized()) {
  console.log("📦 Initializing database...");
  createTables();
  console.log("💡 Run `pnpm run db:seed` to populate with sample data");
} else {
  // Verify database connection
  const db = getDb();
  const userCount = (
    db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number }
  ).count;
  console.log(`📦 Database connected (${userCount} users)`);
}

// Create Express app
const app: Express = express();

// ===================
// Security Middleware
// ===================
app.use(
  helmet({
    contentSecurityPolicy: config.NODE_ENV === "production",
  }),
);

// ===================
// CORS Configuration
// ===================
app.use(
  cors({
    origin: config.CORS_ORIGIN === "*" ? "*" : config.CORS_ORIGIN.split(","),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

// ===================
// Request Parsing
// ===================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ===================
// Request Logging
// ===================
if (config.NODE_ENV !== "test") {
  app.use(morgan(config.NODE_ENV === "production" ? "combined" : "dev"));
}

// ===================
// Health Check (before auth)
// ===================
app.get("/health", (_req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
  });
});

// ===================
// OAuth Metadata (public)
// ===================
app.use(wellKnownRouter);
console.log("crossed well known");

// ===================
// MCP Server Endpoint
// ===================
// The MCP router handles:
// - POST /mcp - MCP protocol endpoint (requires Bearer token)
// - GET /.well-known/oauth-authorization-server - Auth server metadata (if supported)
app.use(createMcpRouter());

// ===================
// OIDC Endpoints (public — no auth)
// ===================
app.use("/oidc", oidcRouter);

// ===================
// REST API Endpoints
// ===================
app.use("/api", apiRouter);

// ===================
// Error Handling
// ===================
app.use(notFoundHandler);
app.use(errorHandler);

// ===================
// Start Server
// ===================
const PORT = config.PORT;

app.listen(PORT, () => {
  console.log("\n🚀 Expense Management Server Started");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`   Environment:     ${config.NODE_ENV}`);
  console.log(`   Server URL:      ${config.SERVER_URL}`);
  console.log(`   Health Check:    ${config.SERVER_URL}/health`);
  console.log("");
  console.log("   📡 MCP Endpoint:");
  console.log(`      POST ${config.SERVER_URL}/mcp`);
  console.log("");
  console.log("   🌐 REST API:");
  console.log(`      ${config.SERVER_URL}/api`);
  console.log("");
  console.log("   🔐 OAuth Metadata:");
  console.log(
    `      ${config.SERVER_URL}/.well-known/oauth-protected-resource`,
  );
  console.log(
    `      ${config.SERVER_URL}/.well-known/oauth-authorization-server`,
  );
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Received SIGINT, shutting down gracefully...");
  process.exit(0);
});

export { app };
