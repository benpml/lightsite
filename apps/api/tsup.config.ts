import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    server: "src/server.ts",
    "automation-worker": "scripts/automation-worker.ts",
  },
  format: ["esm"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  bundle: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  noExternal: [/^@handout\//],
});
