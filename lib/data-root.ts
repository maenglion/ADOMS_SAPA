import "server-only";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR_NAME = "_데모_용인시_20260920";
const BUNDLED_RELATIVE_ROOT = path.join("data", DATA_DIR_NAME);

type RootSource = "environment" | "legacy-external" | "bundled";

function legacyRoot(): string {
  return path.resolve(
    process.cwd(),
    "../../../../30_데이터/_수집작업/ADOMS_DB_v1/_데모_용인시_20260920"
  );
}

function bundledRoot(): string {
  return path.resolve(process.cwd(), BUNDLED_RELATIVE_ROOT);
}

function resolveRoot(): { root: string; source: RootSource } {
  const configured = (process.env.ADOMS_OPS_DIR || "").trim();
  if (configured) return { root: path.resolve(configured), source: "environment" };

  const legacy = legacyRoot();
  if (fs.existsSync(legacy)) return { root: legacy, source: "legacy-external" };

  return { root: bundledRoot(), source: "bundled" };
}

const resolved = resolveRoot();

export const DATA_ROOT = resolved.root;

export function seedDirectories(): string[] {
  try {
    const all = fs.readdirSync(DATA_ROOT);
    const pick = (prefix: string) => all
      .filter((directory) => directory.startsWith(prefix))
      .sort()
      .reverse()
      .map((directory) => path.join(DATA_ROOT, directory, "seed"));
    return [...pick("us_"), ...pick("ops_")];
  } catch {
    return [];
  }
}

function relativeToRoot(file: string): string {
  return path.relative(DATA_ROOT, file).split(path.sep).join("/");
}

/** Safe runtime diagnostics: no absolute host path or credential is returned. */
export function dataSourceDiagnostics() {
  const directories = seedDirectories();
  const selected: Record<string, string> = {};
  for (const directory of directories) {
    let files: string[] = [];
    try { files = fs.readdirSync(directory); } catch { continue; }
    for (const file of files.filter((name) => name.endsWith(".csv")).sort()) {
      const table = file.slice(0, -4);
      if (!(table in selected)) selected[table] = relativeToRoot(path.join(directory, file));
    }
  }
  return {
    root_source: resolved.source,
    data_root: resolved.source === "bundled" ? BUNDLED_RELATIVE_ROOT.split(path.sep).join("/") : resolved.source,
    adoms_ops_dir_set: Boolean((process.env.ADOMS_OPS_DIR || "").trim()),
    cwd_scope: fs.existsSync(path.join(process.cwd(), "package.json")) ? "application-root" : "runtime-root",
    seed_directory_count: directories.length,
    seed_directories: directories.map(relativeToRoot),
    selected_table_count: Object.keys(selected).length,
    selected_sources: selected,
  };
}
