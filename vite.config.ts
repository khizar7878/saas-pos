import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: true,
    proxy: {
      '/api/fbr': {
        target: 'http://146.190.202.112:5060',
        changeOrigin: true,
      },
      '/api/local-fbr': {
        target: 'http://127.0.0.1:5060',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/local-fbr/, '/api'),
      },
    },
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
