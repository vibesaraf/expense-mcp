import type { Request, Response, NextFunction } from 'express';
import { reportService } from '../../services/index.js';
import { sendSuccess } from '../../utils/response.js';
import { generateReportSchema } from '../validators/index.js';
import { ValidationError } from '../../utils/errors.js';

export class ReportController {
    /**
     * POST /api/expenses/reports/generate - Generate expense report
     */
    async generateReport(req: Request, res: Response, next: NextFunction) {
        try {
            const parsed = generateReportSchema.safeParse(req.body);
            if (!parsed.success) {
                throw new ValidationError('Invalid report parameters', { errors: parsed.error.issues });
            }

            const report = await reportService.generateReport(req.user!, parsed.data);
            sendSuccess(res, report);
        } catch (error) {
            next(error);
        }
    }
}

// Export singleton instance
export const reportController = new ReportController();
