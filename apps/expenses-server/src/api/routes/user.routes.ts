import { Router } from "express";
import { userController } from "../controllers/index.js";
import { authMiddleware, requireFinanceAdmin } from "../../middleware/index.js";

const router = Router();

router.use(authMiddleware);

// GET /users/me — auth only, no role guard
router.get("/me", userController.getMe.bind(userController));

// Remaining routes require finance admin
router.use(requireFinanceAdmin);

router.post("/register", userController.registerUser.bind(userController));

export const userRouter: Router = router;
