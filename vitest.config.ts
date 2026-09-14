import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Aliases the workspace package to its TS source so `npm test` runs against
// current code without requiring `packages/core` to be built first.
export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@pdf-book-splitter\/core\/node$/,
        replacement: fileURLToPath(new URL("./packages/core/src/node/index.ts", import.meta.url)),
      },
      {
        find: /^@pdf-book-splitter\/core$/,
        replacement: fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
      },
    ],
  },
});
