import type { UserRole } from '../config/constants';

export interface User {
    userId: string;
    email: string;
    fullName: string;
    role: UserRole;
    department?: string;
    managerId?: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateUserInput {
    userId: string;
    email: string;
    fullName: string;
    role: UserRole;
    department?: string;
    managerId?: string;
}

export interface UpdateUserInput {
    email?: string;
    fullName?: string;
    role?: UserRole;
    department?: string;
    managerId?: string;
}
