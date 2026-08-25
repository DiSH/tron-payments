import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    global: "globalThis",
  },
  resolve: {
    alias: {
      buffer: "buffer/",
    },
  },
  server: {
    port: 5173,
    host: "0.0.0.0",
    watch: {
      usePolling: process.env.CHOKIDAR_USEPOLLING === "true",
    },
  },
  optimizeDeps: {
    include: [
      "buffer",
      "@ledgerhq/hw-transport-webhid",
      "@ledgerhq/hw-app-trx",
    ],
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
});
