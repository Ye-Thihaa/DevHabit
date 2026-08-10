import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Convex functions run in a V8 isolate, not Node — convex-test needs the
// edge-runtime environment to simulate that (fetch/Request/etc. without
// Node-only globals leaking in and masking behavior that only shows up in
// the real deployment).
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
  },
});
