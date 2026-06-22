import type { Request, Response, NextFunction } from "express";
import { auditRepository } from "../db/repositories/index.js";

const ACTION_MAP: Record<string, string> = {
  "POST:/api/expenses": "submit_expense",
  "GET:/api/expenses/me": "list_expenses",
  "GET:/api/expenses/team/:teamId": "list_team_expenses",
  "GET:/api/expenses/all": "list_all_expenses",
  "GET:/api/expenses/:expenseId": "get_expense",
  "POST:/api/expenses/:expenseId/approve": "approve_expense",
  "POST:/api/expenses/:expenseId/reject": "reject_expense",
  "POST:/api/expenses/reports/generate": "generate_report",
  "GET:/api/users/me": "get_profile",
  "GET:/api/activity": "list_activity",
};

const RESOURCE_TYPE_MAP: Record<string, string> = {
  "/api/expenses": "expense",
  "/api/expenses/reports": "report",
  "/api/users": "user",
  "/api/activity": "audit_log",
};

export function auditLogMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.on("finish", () => {
    try {
      if (!req.user) return;

      const routePath = req.route?.path ?? "";
      const key = `${req.method}:${req.baseUrl}${routePath}`.replace(/\/$/, "");
      const action = ACTION_MAP[key];
      if (!action) return;

      auditRepository.insert({
        userId: req.user.userId,
        actorType: req.actorId ? "agent" : "user",
        actorClientId: req.actorId,
        action,
        resourceType: RESOURCE_TYPE_MAP[req.baseUrl] ?? req.baseUrl,
        resourceId: (req.params.expenseId ?? req.params.id) as string | undefined,
        scopeUsed: req.user.scopes.join(" "),
        statusCode: res.statusCode,
      });
    } catch {
      // silently ignore — never let audit failures affect responses
    }
  });

  next();
}
