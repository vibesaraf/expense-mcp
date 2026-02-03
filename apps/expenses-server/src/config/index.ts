import { z } from 'zod';

const envSchema = z.object({
    // Server
    PORT: z.string().default('3000').transform(Number),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    SERVER_URL: z.string().url().default('http://localhost:3000'),

    // Descope
    DESCOPE_PROJECT_ID: z.string().min(1, 'DESCOPE_PROJECT_ID is required'),
    DESCOPE_MANAGEMENT_KEY: z.string().optional(),
    DESCOPE_BASE_URL: z.string().url().optional(),

    // Database
    DATABASE_PATH: z.string().default('./data/expense.db'),

    // MCP
    MCP_SERVER_NAME: z.string().default('Expense Management MCP Server'),
    MCP_SERVER_VERSION: z.string().default('1.0.0'),

    // CORS
    CORS_ORIGIN: z.string().default('*'),
});

export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
    const result = envSchema.safeParse(process.env);

    if (!result.success) {
        console.error('❌ Invalid environment variables:');
        console.error(result.error.format());
        process.exit(1);
    }

    return result.data;
}

export const config = loadConfig();
