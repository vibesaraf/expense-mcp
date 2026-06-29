import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    resolve: {
      dedupe: ["react", "react-dom", "react-router-dom"],
    },
    server: {
      proxy: {
        "/api": env.VITE_REST_RESOURCE_URL || "http://localhost:3001",
        "/oidc": env.VITE_REST_RESOURCE_URL || "http://localhost:3001",
      },
    },
  };
});
