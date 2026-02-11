import type { Request, Response, NextFunction } from 'express';
import { reportService } from '../../services';
import { sendSuccess } from '../../utils/response';
import { generateReportSchema } from '../validators';
import { ValidationError } from '../../utils/errors';

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
