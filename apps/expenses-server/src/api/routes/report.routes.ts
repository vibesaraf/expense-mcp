import { Router } from 'express';
import { reportController } from '../controllers/index.js';
import {
    authMiddleware,
    requireScopes,
    auditMiddleware
} from '../../middleware/index.js';
import { McpScopes } from '../../config/constants.js';

const router = Router();

// All report routes require authentication
router.use(authMiddleware);

/**
 * POST /reports/generate - Generate expense report
 * Required scope: expense:report:generate
 */
router.post(
    '/generate',
    requireScopes(McpScopes.EXPENSE_REPORT_GENERATE),
    auditMiddleware('report:generate', 'report'),
    reportController.generateReport.bind(reportController)
);

export const reportRouter: Router = router;
