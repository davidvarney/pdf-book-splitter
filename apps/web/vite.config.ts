import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri wraps this same build unmodified: `clearScreen`/`envPrefix`/a
// pinned, strict dev port let its CLI drive this dev server reliably (see
// apps/desktop/src-tauri/tauri.conf.json's devUrl/frontendDist).
export default defineConfig({
  plugins: [react()],
  base: "./",
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
});
