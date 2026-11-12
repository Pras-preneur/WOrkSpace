// Bundles the React app with esbuild into ./dist (served by the FastAPI/Starlette backend).
import * as esbuild from "esbuild";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const watch = process.argv.includes("--watch");
mkdirSync("dist/assets", { recursive: true });

const options = {
  entryPoints: { app: "src/main.tsx" },
  bundle: true, outdir: "dist/assets", format: "esm", target: "es2020", jsx: "automatic",
  minify: !watch, sourcemap: watch, loader: { ".svg": "dataurl" },
  define: { "process.env.NODE_ENV": watch ? '"development"' : '"production"' },
  entryNames: "[name]", logLevel: "info",
};

function copyStatic() {
  let html = readFileSync("public/index.html", "utf8");
  writeFileSync("dist/index.html", html);
  cpSync("public", "dist", { recursive: true });
}

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  copyStatic();
  console.log("watching… (backend serves ./dist on http://localhost:8000)");
} else {
  await esbuild.build(options);
  copyStatic();
}
