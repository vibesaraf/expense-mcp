import type { Request, Response, NextFunction, RequestHandler } from 'express';

interface AuditInfo {
    action: string;
    resourceType: string;
    resourceId?: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    timestamp: Date;
}

/**
 * Middleware to log API requests for audit purposes
 * In production, this would write to the audit_log table
 */
export function auditMiddleware(action: string, resourceType: string): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
        // Store audit info on request for later logging
        (req as Request & { auditInfo?: AuditInfo }).auditInfo = {
            action,
            resourceType,
            resourceId: (req.params.id || req.params.expenseId) as string,
            userId: req.user?.userId,
            ipAddress: req.ip || req.socket.remoteAddress,
            userAgent: req.headers['user-agent'],
            timestamp: new Date(),
        };

        // Log on response finish
        res.on('finish', () => {
            const auditInfo = (req as Request & { auditInfo?: AuditInfo }).auditInfo;
            if (auditInfo && auditInfo.userId) {
                // In production, this would insert into audit_log table
                console.log(`[AUDIT] ${auditInfo.action} on ${auditInfo.resourceType}:${auditInfo.resourceId || 'N/A'} by ${auditInfo.userId} - Status: ${res.statusCode}`);
            }
        });

        next();
    };
}
