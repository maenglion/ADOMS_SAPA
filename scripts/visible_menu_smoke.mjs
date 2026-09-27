import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const baseArg = process.argv.find((arg) => arg.startsWith("--base="));
const outArg = process.argv.find((arg) => arg.startsWith("--out="));
if (!baseArg) {
  console.error("usage: npm run verify:menu-smoke -- --base=https://example.netlify.app [--out=path.json]");
  process.exit(2);
}

const base = new URL(baseArg.slice("--base=".length));
const root = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "adoms-menu-smoke-"));

try {
  fs.writeFileSync(path.join(temp, "package.json"), '{"type":"commonjs"}');
  for (const name of ["roles", "perm", "menu"]) {
    const source = fs.readFileSync(path.join(root, "lib", `${name}.ts`), "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
      fileName: `${name}.ts`,
    }).outputText;
    fs.writeFileSync(path.join(temp, `${name}.js`), output);
  }

  const require = createRequire(import.meta.url);
  const { usGroupsFor } = require(path.join(temp, "menu.js"));
  const { ALL_ROLES } = require(path.join(temp, "perm.js"));
  const forbidden = [
    "Internal Server Error", "Unhandled", "TypeError", "ReferenceError", "Error:",
    "SQLSTATE", "ECONN", "DATABASE_URL", "ADOMS_READ_SERVER_TOKEN",
    "undefined is not", "Cannot read properties", "Unexpected token",
  ];
  const assetChecks = new Map();

  function checkAsset(src, pageUrl) {
    const assetUrl = new URL(src, pageUrl).toString();
    let pending = assetChecks.get(assetUrl);
    if (!pending) {
      pending = fetch(assetUrl, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(45_000),
      }).then((response) => ({ url: assetUrl, status: response.status }))
        .catch((error) => ({ url: assetUrl, status: 0, error: error instanceof Error ? error.message : String(error) }));
      assetChecks.set(assetUrl, pending);
    }
    return pending;
  }

  const targets = ALL_ROLES.flatMap((role) => usGroupsFor(role).flatMap((group) =>
    group.items.filter((item) => item.href && !item.heading).map((item) => ({
      role,
      group: group.key || group.label.replace(/\n/g, ""),
      label: item.label,
      href: item.href,
    })),
  ));

  async function inspect(target) {
    const url = new URL(target.href, base);
    url.searchParams.set("role", target.role);
    const started = performance.now();
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: { accept: "text/html" },
        signal: AbortSignal.timeout(45_000),
      });
      const html = await response.text();
      const visibleText = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&[^;]+;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const contentType = response.headers.get("content-type") || "";
      const symptoms = [];
      if (response.status >= 400) symptoms.push(`HTTP ${response.status}`);
      if (contentType.includes("application/json")) symptoms.push("raw JSON response");
      if (!visibleText) symptoms.push("blank page");
      if (!html.includes('class="us-app') || !html.includes('class="us-header') || !html.includes('class="us-page')) {
        symptoms.push("ADOMS shell missing");
      }
      const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/gi)].map((match) => match[1]);
      const brokenAssets = (await Promise.all([...new Set(scripts)].map((src) => checkAsset(src, response.url))))
        .filter((asset) => asset.status !== 200);
      for (const asset of brokenAssets) symptoms.push(`script asset HTTP ${asset.status}: ${new URL(asset.url).pathname}`);
      for (const token of forbidden) if (visibleText.includes(token)) symptoms.push(`internal token: ${token}`);
      return {
        ...target,
        url: url.toString(),
        finalUrl: response.url,
        status: response.status,
        elapsedMs: Math.round((performance.now() - started) * 10) / 10,
        pass: symptoms.length === 0,
        symptoms,
      };
    } catch (error) {
      return {
        ...target,
        url: url.toString(),
        finalUrl: "",
        status: 0,
        elapsedMs: Math.round((performance.now() - started) * 10) / 10,
        pass: false,
        symptoms: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  const results = [];
  const queue = [...targets];
  const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
    while (queue.length) {
      const target = queue.shift();
      if (target) results.push(await inspect(target));
    }
  });
  await Promise.all(workers);
  results.sort((a, b) => a.role.localeCompare(b.role) || a.group.localeCompare(b.group) || a.href.localeCompare(b.href));

  const report = {
    generatedAt: new Date().toISOString(),
    base: base.origin,
    source: "lib/menu.ts usGroupsFor(role)",
    total: results.length,
    pass: results.filter((row) => row.pass).length,
    fail: results.filter((row) => !row.pass).length,
    byRole: Object.fromEntries(ALL_ROLES.map((role) => {
      const rows = results.filter((row) => row.role === role);
      return [role, { total: rows.length, pass: rows.filter((row) => row.pass).length, fail: rows.filter((row) => !row.pass).length }];
    })),
    failures: results.filter((row) => !row.pass),
    scriptAssets: [...assetChecks.values()].length,
    results,
  };
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (outArg) fs.writeFileSync(path.resolve(root, outArg.slice("--out=".length)), json);
  process.stdout.write(json);
  process.exitCode = report.fail ? 1 : 0;
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
