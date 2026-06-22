import type { Request, Response, NextFunction } from "express";
import { auditRepository } from "../../db/repositories/index.js";
import { isFinanceAdmin, isManagerOrHigher } from "../../middleware/index.js";
import { sendSuccess } from "../../utils/response.js";
import { ValidationError } from "../../utils/errors.js";
import { activityQuerySchema } from "../validators/index.js";

export class ActivityController {
  async getActivity(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = activityQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new ValidationError("Invalid query parameters", {
          errors: parsed.error.issues,
        });
      }

      const filters = parsed.data;
      let result;

      if (isFinanceAdmin(req.user!)) {
        result = auditRepository.findAll(filters);
      } else if (isManagerOrHigher(req.user!)) {
        result = auditRepository.findForTeam(req.user!.userId, filters);
      } else {
        result = auditRepository.findForUser(req.user!.userId, filters);
      }

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}

export const activityController = new ActivityController();
