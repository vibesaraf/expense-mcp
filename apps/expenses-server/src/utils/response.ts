import type { Response } from 'express';

export interface SuccessResponse<T> {
    success: true;
    data: T;
}

export interface ErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
}

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
    res.status(statusCode).json({
        success: true,
        data,
    } satisfies SuccessResponse<T>);
}

export function sendError(
    res: Response,
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, unknown>
): void {
    res.status(statusCode).json({
        success: false,
        error: {
            code,
            message,
            ...(details && { details }),
        },
    } satisfies ErrorResponse);
}

export function sendCreated<T>(res: Response, data: T): void {
    sendSuccess(res, data, 201);
}

export function sendNoContent(res: Response): void {
    res.status(204).send();
}
