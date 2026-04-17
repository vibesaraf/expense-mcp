import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { AppError } from '../utils/errors.js';
import { sendError } from '../utils/response.js';
import { config } from '../config/index.js';

/**
 * Global error handler middleware
 */
export const errorHandler: ErrorRequestHandler = (
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction
): void => {
    console.error('Error:', err);

    // Handle known application errors
    if (err instanceof AppError) {
        sendError(res, err.statusCode, err.code, err.message, err.details);
        return;
    }

    // Handle Zod validation errors
    if (err.name === 'ZodError') {
        const zodError = err as unknown as { errors: Array<{ path: string[]; message: string }> };
        sendError(res, 400, 'VALIDATION_ERROR', 'Invalid request data', {
            errors: zodError.errors,
        });
        return;
    }

    // Handle JWT/Auth errors
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        sendError(res, 401, 'UNAUTHORIZED', 'Invalid or expired token');
        return;
    }

    // Handle unknown errors
    const message = config.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message;

    sendError(res, 500, 'INTERNAL_ERROR', message,
        config.NODE_ENV === 'development' ? { stack: err.stack } : undefined
    );
};

/**
 * Not found handler for unmatched routes
 */
export const notFoundHandler = (req: Request, res: Response): void => {
    sendError(res, 404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`);
};
