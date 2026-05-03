import path from "node:path";
import { fileURLToPath } from "node:url";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vercel.com/docs/frameworks/full-stack/tanstack-start
// Nitro produces `.vercel/output` so Vercel can route SSR + static assets (not Cloudflare Workers).

export default defineConfig({
  server: {
    port: 8080,
    host: "::",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  plugins: [
    tailwindcss(),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
    viteReact(),
    // Vercel’s build pipeline expects the Nitro `vercel` preset (`.vercel/output`), not `node-server`.
    nitro({ preset: "vercel" }),
  ],
});
