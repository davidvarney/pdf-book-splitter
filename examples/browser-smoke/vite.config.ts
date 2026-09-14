import { defineConfig } from "vite";

export default defineConfig({
  server: {
    fs: {
      // Reach into ../../packages/core/src from this standalone example.
      allow: ["../.."],
    },
  },
});
