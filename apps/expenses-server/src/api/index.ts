import { Router } from "express";
import type { Request, Response } from "express";
import {
  expenseRouter,
  categoryRouter,
  reportRouter,
  userRouter,
  activityRouter,
} from "./routes/index.js";
import { auditLogMiddleware } from "../middleware/auditLog.middleware.js";
import { config } from "../config/index.js";
import { McpScopes } from "../config/constants.js";

const apiRouter: Router = Router();

/**
 * API Health check endpoint
 */
apiRouter.get("/health", (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    },
  });
});

/**
 * API Info endpoint
 */
apiRouter.get("/", (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      name: "Expense Management API",
      version: "1.0.0",
      endpoints: {
        expenses: "/api/expenses",
        categories: "/api/categories",
        reports: "/api/expenses/reports",
        users: "/api/users",
      },
      documentation: "/api/docs",
    },
  });
});

// REST Protected Resource Metadata (public — no auth)
apiRouter.get("/.well-known/oauth-protected-resource", (_req: Request, res: Response) => {
  res.json({
    resource: config.REST_RESOURCE_URL,
    authorization_servers: [config.LR_ISSUER],
    scopes_supported: Object.values(McpScopes),
  });
});

// Audit all authenticated REST requests
apiRouter.use(auditLogMiddleware);

// Register routes
apiRouter.use("/expenses/reports", reportRouter); // Must be before /expenses
apiRouter.use("/expenses", expenseRouter);
apiRouter.use("/categories", categoryRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/activity", activityRouter);

export { apiRouter };
