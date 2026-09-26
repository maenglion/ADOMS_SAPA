import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const APP = process.env.ADOMS_APP_DIR;
const req = createRequire(path.join(APP, "package.json"));
const ts = req("typescript");
const EMPTY = "data:text/javascript,export {};";

function tryFile(p) {
  for (const c of [p, p + ".ts", p + ".tsx", p + ".js", p + ".mjs", path.join(p, "index.ts"), path.join(p, "index.tsx")]) {
    try { if (fs.statSync(c).isFile()) return c; } catch {}
  }
  return null;
}

export async function resolve(spec, ctx, next) {
  if (spec === "server-only") return { url: EMPTY, shortCircuit: true };
  let base = null;
  if (spec.startsWith("@/")) base = path.join(APP, spec.slice(2));
  else if ((spec.startsWith("./") || spec.startsWith("../")) && ctx.parentURL && ctx.parentURL.startsWith("file:")) {
    base = path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec);
  }
  if (base) {
    const f = tryFile(base);
    if (f) return { url: pathToFileURL(f).href, shortCircuit: true };
  }
  return next(spec, ctx);
}

export async function load(url, ctx, next) {
  if (url.startsWith("file:") && /\.(ts|tsx)$/.test(url)) {
    const src = fs.readFileSync(fileURLToPath(url), "utf8");
    const out = ts.transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      fileName: fileURLToPath(url),
    });
    return { format: "module", source: out.outputText, shortCircuit: true };
  }
  return next(url, ctx);
}
