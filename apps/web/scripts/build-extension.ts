import { copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { build, loadEnv, type InlineConfig } from "vite"

const webDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const repositoryDirectory = path.resolve(webDirectory, "../..")
const extensionDirectory = path.join(webDirectory, "extension")
const outputDirectory = path.join(webDirectory, "dist-extension")
const sourceDirectory = path.join(webDirectory, "src")
const mode = process.env.NODE_ENV === "production" ? "production" : "development"
const env = loadEnv(mode, repositoryDirectory, "")
const publicOrigin = env.VITE_EXTENSION_PUBLIC_ORIGIN || "https://lightsite.io"
const previewOrigin = env.VITE_EXTENSION_PREVIEW_ORIGIN || (mode === "production" ? publicOrigin : "http://localhost:3011")
const define = {
  "import.meta.env.DEV": JSON.stringify(mode !== "production"),
  "import.meta.env.VITE_EXTENSION_API_ORIGIN": JSON.stringify(env.VITE_EXTENSION_API_ORIGIN || "http://localhost:3011"),
  "import.meta.env.VITE_EXTENSION_WEB_ORIGIN": JSON.stringify(env.VITE_EXTENSION_WEB_ORIGIN || "http://localhost:5173"),
  "import.meta.env.VITE_EXTENSION_PREVIEW_ORIGIN": JSON.stringify(previewOrigin),
  "import.meta.env.VITE_EXTENSION_PUBLIC_ORIGIN": JSON.stringify(publicOrigin),
}

await rm(outputDirectory, { force: true, recursive: true })

await build({
  configFile: false,
  root: webDirectory,
  envDir: repositoryDirectory,
  publicDir: false,
  plugins: [react(), tailwindcss()],
  define,
  resolve: { alias: { "@": sourceDirectory } },
  build: {
    emptyOutDir: false,
    outDir: outputDirectory,
    sourcemap: false,
    rollupOptions: { input: { panel: path.join(extensionDirectory, "panel.html") } },
  },
})

await Promise.all([
  buildScript("background", path.join(sourceDirectory, "features/gmail-extension/background.ts")),
  buildScript("content-script", path.join(sourceDirectory, "features/gmail-extension/content-script.ts")),
])

await mkdir(outputDirectory, { recursive: true })
await rename(
  path.join(outputDirectory, "extension/panel.html"),
  path.join(outputDirectory, "panel.html"),
)
await rm(path.join(outputDirectory, "extension"), { force: true, recursive: true })
await Promise.all([
  copyFile(path.join(extensionDirectory, "manifest.json"), path.join(outputDirectory, "manifest.json")),
  copyFile(path.join(webDirectory, "public/lightsite-logo.svg"), path.join(outputDirectory, "lightsite-logo.svg")),
])

const panelPath = path.join(outputDirectory, "panel.html")
const panelHtml = await readFile(panelPath, "utf8")
await writeFile(panelPath, panelHtml.replace(/crossorigin/g, ""), "utf8")
await assertExtensionOutput()

async function buildScript(name: string, entry: string) {
  const config: InlineConfig = {
    configFile: false,
    root: webDirectory,
    publicDir: false,
    define,
    resolve: { alias: { "@": sourceDirectory } },
    build: {
      emptyOutDir: false,
      outDir: outputDirectory,
      sourcemap: false,
      minify: mode === "production",
      lib: {
        entry,
        formats: ["iife"],
        name: `Lightsite${name.replace(/\W/g, "")}`,
        fileName: () => `${name}.js`,
      },
    },
  }
  await build(config)
}

async function assertExtensionOutput() {
  const allowedRootEntries = new Set([
    "assets",
    "background.js",
    "content-script.js",
    "lightsite-logo.svg",
    "manifest.json",
    "panel.html",
  ])
  const unexpectedEntries = (await readdir(outputDirectory))
    .filter((entry) => !allowedRootEntries.has(entry))

  if (unexpectedEntries.length > 0) {
    throw new Error(`Unexpected extension output: ${unexpectedEntries.join(", ")}`)
  }
}
