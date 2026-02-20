export interface User {
  userId: string;
  email: string;
  fullName: string;
  department?: string;
  managerId?: string;
  lrUserId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  userId: string;
  email: string;
  fullName: string;
  department?: string;
  managerId?: string;
  lrUserId?: string;
}

export interface UpdateUserInput {
  email?: string;
  fullName?: string;
  department?: string;
  managerId?: string;
  lrUserId?: string;
}
