import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  bundle: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  noExternal: [/^@lightsite\//],
});
