import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
export default defineConfig({
  root,
  plugins: [react()],
  optimizeDeps: { entries: ["tests/fixtures/prepaid-preview.html"] },
  resolve: {
    alias: [
      {
        find: /.*apiClient$/,
        replacement: fileURLToPath(
          new URL("./prepaidPreviewApi.ts", import.meta.url),
        ),
      },
      {
        find: /.*\/auth\/AuthProvider$/,
        replacement: fileURLToPath(
          new URL("./prepaidPreviewAuth.ts", import.meta.url),
        ),
      },
    ],
  },
  server: { host: "127.0.0.1", port: 5188, strictPort: true },
});
