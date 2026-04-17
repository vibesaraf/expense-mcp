import { Router } from "express";
import type { Request, Response } from "express";
import {
  expenseRouter,
  categoryRouter,
  reportRouter,
  userRouter,
} from "./routes/index.js";

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

// Register routes
apiRouter.use("/expenses/reports", reportRouter); // Must be before /expenses
apiRouter.use("/expenses", expenseRouter);
apiRouter.use("/categories", categoryRouter);
apiRouter.use("/users", userRouter);

export { apiRouter };
