import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const repoRoot = path.resolve(import.meta.dirname, "../..");

export default defineConfig({
  base: "./",
  build: { emptyOutDir: true, outDir: "dist" },
  plugins: [react(), tailwindcss()],
  resolve: {
    // Studio reuses the site's shadcn and registry components.
    alias: { "@": repoRoot },
    dedupe: ["react", "react-dom"],
  },
  server: {
    // `prompt-manager studio --api-only` serves the API during development.
    proxy: { "/api": "http://127.0.0.1:4983" },
  },
});
