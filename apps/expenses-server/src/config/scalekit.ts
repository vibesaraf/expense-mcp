import { Scalekit } from "@scalekit-sdk/node";
import { config } from "./index.js";

export const scalekitClient = new Scalekit(
  config.SCALEKIT_ENV_URL,
  config.SCALEKIT_CLIENT_ID,
  config.SCALEKIT_CLIENT_SECRET,
);
