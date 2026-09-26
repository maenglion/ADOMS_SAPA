import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * 법정 서식(별표·별지서식) HTML — 법령 원문의 괘선 표를 표로 옮겨 미리 만들어 둔 것.
 * 변환은 파이썬 한 곳(`_build/schedule_to_html.py`)에서만 한다. 앱은 결과만 읽는다.
 * 파일은 최신 ops 판 폴더의 `forms/` 에 있다.
 */
const DATA_ROOT =
  process.env.ADOMS_OPS_DIR ||
  path.resolve(process.cwd(), "../../../../30_데이터/_수집작업/ADOMS_DB_v1/_데모_용인시_20260920");

function formsDir(): string | null {
  try {
    const dirs = fs.readdirSync(DATA_ROOT).filter((d) => d.startsWith("ops_")).sort().reverse();
    for (const d of dirs) {
      const p = path.join(DATA_ROOT, d, "forms");
      if (fs.existsSync(p)) return p;
    }
  } catch {}
  return null;
}

export type FormMeta = { id: string; title: string; kind: string; no: string; doc_id: string; quality: string };

export function formIndex(): FormMeta[] {
  const d = formsDir();
  if (!d) return [];
  try { return JSON.parse(fs.readFileSync(path.join(d, "_index.json"), "utf8")); } catch { return []; }
}

export function formHtml(id: string): string | null {
  if (!/^[A-Z]{2,4}-\d+$/.test(id)) return null;      // 경로를 거슬러 오르는 이름은 받지 않는다
  const d = formsDir();
  if (!d) return null;
  const p = path.join(d, `${id}.html`);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}
