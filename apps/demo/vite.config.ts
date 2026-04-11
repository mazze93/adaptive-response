import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy /v1 to the local Worker during development
    proxy: {
      "/v1": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
