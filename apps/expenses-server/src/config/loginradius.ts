import { z } from "zod";

export const loginRadiusConfigSchema = z.object({
  LR_ISSUER: z.string().url(),
  LR_INTROSPECT_URL: z.string().url(),
  LR_JWKS_URI: z.string().url(),
  LR_CLIENT_ID: z.string().min(1),
  LR_CLIENT_SECRET: z.string().min(1),
  LR_TOKEN_ENDPOINT_AUTH_METHOD: z
    .enum(["client_secret_post", "client_secret_basic"])
    .default("client_secret_post"),
});

export type LoginRadiusConfig = z.infer<typeof loginRadiusConfigSchema>;

let config: LoginRadiusConfig | null = null;

export function getLoginRadiusConfig(): LoginRadiusConfig {
  if (!config) {
    config = loginRadiusConfigSchema.parse({
      LR_ISSUER: process.env.LR_ISSUER,
      LR_INTROSPECT_URL: process.env.LR_INTROSPECT_URL,
      LR_JWKS_URI: process.env.LR_JWKS_URI,
      LR_CLIENT_ID: process.env.LR_CLIENT_ID,
      LR_CLIENT_SECRET: process.env.LR_CLIENT_SECRET,
      LR_TOKEN_ENDPOINT_AUTH_METHOD: process.env.LR_TOKEN_ENDPOINT_AUTH_METHOD,
    });
  }

  return config;
}
