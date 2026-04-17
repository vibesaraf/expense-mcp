import { Router } from 'express';
import { categoryController } from '../controllers/index.js';
import { authMiddleware } from '../../middleware/index.js';

const router = Router();

// Category routes require authentication
router.use(authMiddleware);

/**
 * GET /categories - List all categories
 */
router.get(
    '/',
    categoryController.listCategories.bind(categoryController)
);

export const categoryRouter: Router = router;
