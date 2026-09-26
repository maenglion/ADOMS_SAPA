"use client";
import { useState } from "react";
import { ACTS, BYEOLPYO5, VERDICTS, b5State, checkInput, splitSemi, suggest } from "@/lib/material";
import { saveMaterial } from "./materialActions";
import s from "./system.module.css";

type Opt = { id: string; name: string; dept?: string };

/**
 * 원료·제조물 품목 입력 — 행위를 고르면 「제안」이 바로 바뀐다(판단 칸은 사람이 고른다).
 * 「최종 사용」을 골랐거나 판단을 정했는데 사유·근거가 비어 있으면 저장하지 않는다(서버도 같은 검사).
 */
export default function MaterialForm({ role, item, depts, staff, err }: {
  role: string; item?: Record<string, string>; depts: Opt[]; staff: Opt[]; err?: string;
}) {
  const [acts, setActs] = useState<string[]>(splitSemi(item?.acts));
  const [dept, setDept] = useState(item?.dept_id || "");
  const [verdict, setVerdict] = useState(item?.verdict || "확인 필요");
  const [reason, setReason] = useState(item?.reason || "");
  const [basis, setBasis] = useState(item?.basis_ref || "");
  const [b5mode, setB5mode] = useState<string>(b5State(item?.byeolpyo5));
  const [msg, setMsg] = useState(err || "");
  const sug = suggest(acts);
  const toggle = (k: string) => setActs((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));
  const b5sel = splitSemi(item?.byeolpyo5).filter((x) => x !== "N");

  return (
    <form action={saveMaterial} className={s.form}
          onSubmit={(e) => {
            const name = String(new FormData(e.currentTarget).get("item_name") || "");
            const m = checkInput({ name, dept, acts, verdict, reason, basis });
            if (m) { e.preventDefault(); setMsg(m); }
          }}>
      <input type="hidden" name="role" value={role} />
      {item && <input type="hidden" name="item_id" value={item.item_id} />}
      <div>
        <label>품목</label>
        <input type="text" name="item_name" defaultValue={item?.item_name || ""} placeholder="예: 수돗물 · 직영 급식 · 백신" required />
      </div>
      <div>
        <label>담당 부서</label>
        <select name="dept_id" value={dept} onChange={(e) => setDept(e.target.value)} required>
          <option value="">— 고르기 —</option>
          {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div>
        <label>담당자 (제8조제1호 인력 판정에 씁니다)</label>
        <select name="owner_staff_id" defaultValue={item?.owner_staff_id || ""}>
          <option value="">— 없음 —</option>
          {staff.filter((x) => !dept || x.dept === dept).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </div>

      <fieldset className={`${s.wide} ${s.fold}`}>
        <legend><b>행위</b> — 무엇을 하는가 (여럿 고를 수 있음)</legend>
        {ACTS.map((a) => (
          <label key={a.key} className={s.inline} style={{ margin: "4px 0" }}>
            <input type="checkbox" style={{ width: "auto" }} name="acts" value={a.key} checked={acts.includes(a.key)} onChange={() => toggle(a.key)} />
            <b>{a.label}</b> <span className="muted">{a.sub}</span>
          </label>
        ))}
        <div className={s.law} style={{ marginTop: 8 }}>
          <span className="badge none">제안</span> <b>{sug.tag}</b>
          <div className="muted">{sug.basis}</div>
          <div className="muted">제안은 판단이 아닙니다 — 아래 「판단」은 사람이 사유를 적어 고릅니다.</div>
          {acts.length > 0 && (
            <button type="button" className="btn sm ghost" style={{ marginTop: 6 }}
                    onClick={() => { if (!basis.trim()) setBasis(sug.basis.split(" — ")[0]); }}>
              제안 근거를 근거 칸에 넣기
            </button>
          )}
        </div>
      </fieldset>

      <fieldset className={`${s.wide} ${s.fold}`}>
        <legend><b>별표 5 해당 여부</b> — 해당이면 시행령 제8조제3호·제4호가 더 걸립니다</legend>
        <div className={s.inline}>
          {[["unk", "확인 필요"], ["no", "별표 5 아님"], ["yes", "별표 5 해당"]].map(([k, l]) => (
            <label key={k} className={s.inline} style={{ marginRight: 14 }}>
              <input type="radio" style={{ width: "auto" }} name="b5mode" value={k} checked={b5mode === k} onChange={() => setB5mode(k)} /> {l}
            </label>
          ))}
        </div>
        {b5mode === "yes" && (
          <div style={{ marginTop: 6 }}>
            {BYEOLPYO5.map((b) => (
              <label key={b.no} className={s.inline} style={{ margin: "3px 0" }}>
                <input type="checkbox" style={{ width: "auto" }} name="b5" value={b.no} defaultChecked={b5sel.includes(b.no)} />
                제{b.no}호 <b>{b.label}</b> <span className="muted">{b.law}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div>
        <label>관계 법령</label>
        <input type="text" name="related_law" defaultValue={item?.related_law || ""} placeholder="예: 수도법 · 먹는물관리법" />
      </div>
      <div>
        <label>판단</label>
        <select name="verdict" value={verdict} onChange={(e) => setVerdict(e.target.value)}>
          {VERDICTS.map((x) => <option key={x}>{x}</option>)}
        </select>
        {verdict !== "확인 필요" && sug.verdict !== verdict && acts.length > 0 && (
          <div className="muted">제안({sug.tag})과 다릅니다 — 사유에 왜 다르게 정했는지 적습니다.</div>
        )}
      </div>
      <div>
        <label>근거 {verdict !== "확인 필요" && <b>(필수)</b>}</label>
        <input type="text" name="basis_ref" value={basis} onChange={(e) => setBasis(e.target.value)}
               placeholder="환경부 해설서 ○쪽 또는 ADOMS 해석(확인 필요)" />
      </div>
      <div className={s.wide}>
        <label>사유 (필수){acts.includes("enduse") && " — 「최종 사용」은 왜 빠지는지 반드시 적습니다"}</label>
        <textarea name="reason" value={reason} onChange={(e) => setReason(e.target.value)} required
                  placeholder="무엇을 보고 이렇게 판단했는지 · 확인 필요면 무엇을 더 봐야 하는지" />
      </div>
      {msg && <div className={`${s.wide} ${s.fix}`}>저장하지 않았습니다 — {msg}</div>}
      <div><button className="btn" type="submit">{item ? "판단 저장" : "품목 올리기"}</button></div>
    </form>
  );
}
