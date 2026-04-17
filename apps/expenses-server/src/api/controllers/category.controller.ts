import type { Request, Response, NextFunction } from 'express';
import { categoryRepository } from '../../db/repositories/index.js';
import { sendSuccess } from '../../utils/response.js';

export class CategoryController {
    /**
     * GET /api/categories - List all expense categories
     */
    async listCategories(_req: Request, res: Response, next: NextFunction) {
        try {
            const categories = categoryRepository.findAll();
            sendSuccess(res, { categories });
        } catch (error) {
            next(error);
        }
    }
}

// Export singleton instance
export const categoryController = new CategoryController();
