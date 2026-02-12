import { z } from "zod";

const envSchema = z.object({
  // Server
  PORT: z.string().default("3001").transform(Number),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  SERVER_URL: z.string().url().default("http://localhost:3001"),

  // Database
  DATABASE_PATH: z.string().default("./data/expense.db"),

  // Scalekit
  SCALEKIT_ENV_URL: z.string().url(),
  SCALEKIT_CLIENT_ID: z.string().min(1, "SCALEKIT_CLIENT_ID is required"),
  SCALEKIT_CLIENT_SECRET: z
    .string()
    .min(1, "SCALEKIT_CLIENT_SECRET is required"),

  // MCP (Scalekit)
  MCP_SERVER_URL: z.string().url(),
  PROTECTED_RESOURCE_METADATA: z
    .string()
    .min(1, "PROTECTED_RESOURCE_METADATA is required"),

  // MCP
  MCP_SERVER_NAME: z.string().default("Expense Management MCP Server"),
  MCP_SERVER_VERSION: z.string().default("1.0.0"),

  // CORS
  CORS_ORIGIN: z.string().default("*"),
});

export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid environment variables:");
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();
