import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const lambdaUploadUrl = env.VITE_LAMBDA_UPLOAD_URL?.replace(/\/$/, "");

  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: 3000,
      proxy: {
        ...(lambdaUploadUrl
          ? {
              "/lambda-upload": {
                target: lambdaUploadUrl,
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/lambda-upload/, "") || "/",
              },
            }
          : {}),
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
    },
  };
});
