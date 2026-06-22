import { z } from "zod";

export const activityQuerySchema = z.object({
  actorType: z.enum(["user", "agent"]).optional(),
  action: z.string().optional(),
  fromDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "fromDate must be YYYY-MM-DD")
    .optional(),
  toDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "toDate must be YYYY-MM-DD")
    .optional(),
  page: z
    .string()
    .default("1")
    .transform(Number)
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .default("20")
    .transform(Number)
    .pipe(z.number().int().min(1).max(100)),
});

export type ActivityQueryInput = z.infer<typeof activityQuerySchema>;
