import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

// This used to be a one-line wrapper around @lovable.dev/vite-tanstack-config,
// which bundled these plugins and defaulted Nitro to the Cloudflare preset.
// Spelled out here so the build target is visible and changeable — the wrapper
// gave no way to switch it, and the app deploys to Vercel.
//
// Plugin order matters: tanstackStart generates the route tree and the server
// entry, so it runs before react; nitro consumes that server build and goes
// last.
export default defineConfig({
  server: { port: 8080 },
  // Nitro reads this to decide what to emit. "vercel" produces the Build
  // Output API v3 directory (.vercel/output) that Vercel deploys directly,
  // with the SSR handler wired to every route — see vercel.json.
  // NITRO_PRESET overrides it, so the same source still builds for other
  // hosts without editing this file.
  nitro: {
    preset: process.env["NITRO_PRESET"] ?? "vercel",
  },
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts
      // (our SSR error wrapper). Nitro builds from this.
      server: { entry: "server" },
    }),
    react(),
    nitro(),
  ],
});
