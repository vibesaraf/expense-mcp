import { Router } from 'express';
import { reportController } from '../controllers';
import {
    authMiddleware,
    requireFinanceAdmin,
    auditMiddleware
} from '../../middleware';

const router = Router();

// All report routes require authentication and finance admin role
router.use(authMiddleware);
router.use(requireFinanceAdmin);

/**
 * POST /reports/generate - Generate expense report
 */
router.post(
    '/generate',
    auditMiddleware('report:generate', 'report'),
    reportController.generateReport.bind(reportController)
);

export const reportRouter: Router = router;
