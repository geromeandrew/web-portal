import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const apiTarget = env.API_PROXY_TARGET?.replace(/\/$/, "") ?? "http://127.0.0.1:3001";

  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: 3000,
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
