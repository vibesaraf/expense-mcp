import { z } from "zod";

export const registerUserSchema = z.object({
  email: z.string().email("Email must be a valid email address"),
  fullName: z.string().min(1, "Full name is required"),
  department: z.string().min(1).optional(),
  managerId: z.string().min(1).optional(),
  lrUserId: z.string().min(1, "LoginRadius user id is required"),
});

export type RegisterUserInput = z.infer<typeof registerUserSchema>;
