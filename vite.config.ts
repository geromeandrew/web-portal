import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const apiTarget = (process.env.API_PROXY_TARGET ?? env.API_PROXY_TARGET ?? "http://127.0.0.1:3001").replace(/\/$/, "");

  return {
    plugins: [react()],
    server: {
      host: "localhost",
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": { target: apiTarget, changeOrigin: true },
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
    },
  };
});
