import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Frontend lives in frontend/, builds to frontend/dist (served by Express).
// In dev, Vite runs on :5173 and proxies /api to the Express server on :3000.
export default defineConfig({
  root: "frontend",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
