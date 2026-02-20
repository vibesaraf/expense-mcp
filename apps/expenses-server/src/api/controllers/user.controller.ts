import type { Request, Response, NextFunction } from "express";
import { userService } from "../../services";
import { sendCreated } from "../../utils/response";
import { registerUserSchema } from "../validators";
import { ValidationError } from "../../utils/errors";

export class UserController {
  /**
   * POST /api/users/register - Register a new user
   */
  async registerUser(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = {
        ...req.body,
        ...(req.body.lrUserId
          ? {}
          : req.body.lr_user_id
            ? { lrUserId: req.body.lr_user_id }
            : {}),
      };
      const parsed = registerUserSchema.safeParse(payload);
      if (!parsed.success) {
        throw new ValidationError("Invalid user data", {
          errors: parsed.error.issues,
        });
      }

      const user = await userService.registerUser(parsed.data);
      sendCreated(res, user);
    } catch (error) {
      next(error);
    }
  }
}

export const userController = new UserController();
