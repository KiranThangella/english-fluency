import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxying /api to the backend means fetch('/api/...') works unchanged
// in dev and in production (once both sit behind the same reverse proxy).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
