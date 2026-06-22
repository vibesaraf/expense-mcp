import { Router } from "express";
import { activityController } from "../controllers/index.js";
import { authMiddleware, requireAnyScope } from "../../middleware/index.js";
import { McpScopes } from "../../config/constants.js";

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  requireAnyScope(
    McpScopes.EXPENSE_VIEW_OWN,
    McpScopes.EXPENSE_VIEW_TEAM,
    McpScopes.EXPENSE_VIEW_ALL,
  ),
  activityController.getActivity.bind(activityController),
);

export const activityRouter: Router = router;
