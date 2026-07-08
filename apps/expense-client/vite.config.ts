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
    preview: {
      host: true,
      port: 4173,
      // In production the preview server sits behind nginx, which forwards the
      // public Host header (e.g. mydomain.com). The preview container is only
      // reachable inside the compose network, so accept any forwarded host.
      allowedHosts: true,
    },
  };
});
