/**
 * [캡처 v2] K03 증빙 파일 첨부 — 서버 쪽 도우미 한 곳 (2026-09-24)
 *
 * 입력 양식의 파일 칸(기본 `evidence_file`)에 파일이 담겨 오면 lib/storage `saveFile` 로 저장하고
 * { evidence_name, evidence_url } 을 돌려준다. 파일이 없으면 지금처럼 이름 칸 글자만 돌려준다(주소는 빈칸).
 *
 * ★ 파일을 올렸는데 이름 칸이 비어 있으면 **폼의 이름 칸에 파일 이름을 채워 넣는다**(f.set).
 *   그래서 뒤따르는 필수 칸 검사(「조사 기록(파일 이름)」 등)가 파일만 올려도 통과하고,
 *   `v(f, "cause_evidence")` 처럼 이름 칸을 다시 읽는 기존 코드도 그대로 돈다.
 * ★ 쓰기는 이 함수가 하지 않는다 — 돌려받은 두 값을 각 화면이 appendRow / patchRow 행에 함께 넣는다.
 * ★ 시행령 제13조: 이행 사항은 서면(전자문서 포함)으로 5년 보관 — 파일은 지우지 않는다.
 */
import "server-only";
import { saveFile } from "@/lib/storage";

export type Attached = { evidence_name: string; evidence_url: string };

/** 이름 칸 최대 길이(표 칸 한 줄). */
const MAX = 120;

/** 같은 폼을 한 번의 저장에서 여러 번 불러도(문서 칸 + 기록 한 줄 등) 파일은 한 번만 저장한다. */
const done = new WeakMap<FormData, Map<string, Promise<Attached>>>();

export function attachOf(f: FormData, nameField = "evidence_name", fileField = "evidence_file"): Promise<Attached> {
  const m = done.get(f) || new Map<string, Promise<Attached>>();
  done.set(f, m);
  const k = `${fileField}>${nameField}`;
  if (!m.has(k)) m.set(k, save(f, nameField, fileField));
  return m.get(k)!;
}

async function save(f: FormData, nameField: string, fileField: string): Promise<Attached> {
  const typed = String(f.get(nameField) ?? "").trim().slice(0, MAX);
  const file = f.get(fileField);
  if (file instanceof File && file.size > 0) {
    const sv = await saveFile(file);
    const name = typed || file.name.slice(0, MAX);
    if (!typed) f.set(nameField, name);
    return { evidence_name: name, evidence_url: sv.url };
  }
  return { evidence_name: typed, evidence_url: "" };
}
