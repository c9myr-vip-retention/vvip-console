import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist" },
  // Honor a PORT env var when one is set (e.g. the preview harness) — Vite ignores PORT by default.
  // Plain `npm run dev` (no PORT) keeps Vite's normal 5173-with-fallback behavior.
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    strictPort: !!process.env.PORT,
  },
});
