import { Router } from "express";
import { userController } from "../controllers";
import { authMiddleware, requireFinanceAdmin } from "../../middleware";

const router = Router();

// User registration requires authentication and finance admin role
router.use(authMiddleware);
router.use(requireFinanceAdmin);

/**
 * POST /users/register - Register a new user
 */
router.post("/register", userController.registerUser.bind(userController));

export const userRouter: Router = router;
