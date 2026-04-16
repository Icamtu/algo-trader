import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: [".ts.net", ".local", "localhost", "127.0.0.1"],
    hmr: {
      overlay: false,
    },
    watch: {
      ignored: ["**/dist/**", "**/node_modules/**"],
    },
  },
  preview: {
    allowedHosts: [".ts.net", ".local", "localhost", "127.0.0.1"],
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
