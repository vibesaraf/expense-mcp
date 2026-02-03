export class AppError extends Error {
    constructor(
        public statusCode: number,
        public code: string,
        message: string,
        public details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'AppError';
        Error.captureStackTrace(this, this.constructor);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized', details?: Record<string, unknown>) {
        super(401, 'UNAUTHORIZED', message, details);
        this.name = 'UnauthorizedError';
    }
}

export class ForbiddenError extends AppError {
    constructor(message = 'Forbidden', details?: Record<string, unknown>) {
        super(403, 'FORBIDDEN', message, details);
        this.name = 'ForbiddenError';
    }
}

export class InsufficientPermissionsError extends AppError {
    constructor(
        requiredScope: string,
        userScopes: string[] = [],
        message = 'You do not have permission to access this resource'
    ) {
        super(403, 'INSUFFICIENT_PERMISSIONS', message, {
            required_scope: requiredScope,
            user_scopes: userScopes,
        });
        this.name = 'InsufficientPermissionsError';
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string, id?: string) {
        const message = id
            ? `${resource} with id '${id}' not found`
            : `${resource} not found`;
        super(404, 'RESOURCE_NOT_FOUND', message, { resource, id });
        this.name = 'NotFoundError';
    }
}

export class ValidationError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(400, 'VALIDATION_ERROR', message, details);
        this.name = 'ValidationError';
    }
}

export class ConflictError extends AppError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(409, 'CONFLICT', message, details);
        this.name = 'ConflictError';
    }
}

export class InternalError extends AppError {
    constructor(message = 'Internal server error', details?: Record<string, unknown>) {
        super(500, 'INTERNAL_ERROR', message, details);
        this.name = 'InternalError';
    }
}
