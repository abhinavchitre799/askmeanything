/*
 * Build script for the embeddable widget.
 *
 * Run with:  tsx widget/build-widget.ts   (or `npm run build:widget`)
 *
 * Bundles widget/entry.ts into public/widget.js as a single, minified,
 * dependency-free IIFE that browsers can load directly via a <script> tag.
 *
 * The output (public/widget.js) is a generated artifact — do NOT edit it by
 * hand.
 */

import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

const entryPoint = resolve(__dirname, "entry.ts");
const outfile = resolve(projectRoot, "public", "widget.js");

async function main(): Promise<void> {
  const result = await build({
    entryPoints: [entryPoint],
    outfile,
    bundle: true,
    minify: true,
    format: "iife",
    target: "es2018",
    platform: "browser",
    // No external runtime deps: the bundle must be self-contained.
    external: [],
    // Source maps are optional; flip to "external" or "inline" if debugging.
    sourcemap: false,
    legalComments: "none",
    logLevel: "info",
  });

  if (result.warnings.length > 0) {
    for (const w of result.warnings) {
      console.warn("[build:widget] warning:", w.text);
    }
  }

  console.log(`[build:widget] Built widget bundle -> ${outfile}`);
}

main().catch((err) => {
  console.error("[build:widget] Build failed:", err);
  process.exit(1);
});
