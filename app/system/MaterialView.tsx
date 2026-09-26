// [캡처 v2] 중대시민재해(원료·제조물) — 단계 막대(해당 판단부터) + 요약 칸 + 한 줄 품목 표. 해설서 인용·절차 설명 문단은 뺐다(2026-09-22).
import Link from "next/link";
import Steps, { Facts } from "@/components/Steps";
import { materialStatus } from "@/lib/system";
import { depts, staff } from "@/lib/data";
import { ceoConfirm } from "@/lib/roles";
import { ACT_LABEL, b5Text, splitSemi, suggest } from "@/lib/material";
import { ymd } from "@/lib/day";
import ClauseCards, { clauseSteps } from "./ClauseCards";
import MaterialForm from "./MaterialForm";
import { confirmMaterial, recordMaterialHalf } from "./materialActions";
import s from "./system.module.css";
import FileAttach from "@/components/FileAttach"; // [캡처 v2] K03

const TODAY = ymd();

/** ① 체계 수립 — 중대시민재해(원료·제조물) · 시행령 제8조 · 제9조. 해당 여부 판단이 먼저다. */
export default async function MaterialView({ role, sp = {} }: { role: string; sp?: Record<string, string> }) {
  const q = (href: string) => `${href}${href.includes("?") ? "&" : "?"}role=${role}`;
  const m = await materialStatus(role);
  const dl = (await depts()).filter((d: any) => d.dept_id !== "D99");
  const deptName = new Map<string, string>(dl.map((d: any) => [d.dept_id, d.dept_name]));
  const st = await staff();
  const staffName = new Map<string, string>(st.map((x: any) => [x.staff_id, x.display_name]));
  const who = (id?: string) => (id ? staffName.get(id) || id : "—");
  const deptOpts = dl.map((d: any) => ({ id: d.dept_id, name: d.dept_name }));
  const staffOpts = st.filter((x: any) => String(x.staff_id).startsWith("S")).map((x: any) => ({ id: x.staff_id, name: x.display_name, dept: x.dept_id }));
  const canConfirm = ceoConfirm(role).ok;
  const err = sp.merr || "";
  const edit = sp.medit || "";
  const editing = m.items.find((r: any) => r.item_id === edit);
  const VTONE: Record<string, string> = { 해당: "warn", 비해당: "ok", "확인 필요": "none" };
  const undecided = m.items.filter((r: any) => r.verdict !== "해당" && r.verdict !== "비해당").length;

  const steps = clauseSteps([
    { label: "해당 판단", nos: [0], href: "#mat" },
    { label: "인력·예산", nos: [1, 2], href: "#m1" },
    { label: "별표 5", nos: [3, 4], href: "#m3" },
    { label: "반기 점검", nos: [5], href: "#m5" },
    { label: "관계 법령", nos: [6, 7], href: "#m9-1" },
  ], m.clauses, m.sts, m.na);

  return (
    <>
      <div className="chips"><span className="badge">법 제9조제1항</span><span className="badge">시행령 제8조·제9조</span><span className="badge none">반기 1회</span></div>
      <Steps items={steps} />

      <Facts items={[
        { k: "품목", v: <b>{m.items.length}</b> },
        { k: "해당", v: m.yesN },
        { k: "비해당", v: m.noN },
        { k: "판단 전", v: <b className={undecided ? "tone-bad" : ""}>{undecided}</b> },
        { k: "갖춰짐", v: `${m.cnt("ok")}/${m.clauses.length}` },
        { k: "관련 과제", v: m.mTaskN.toLocaleString() },
      ]} />

      <h2 id="mat">해당 여부 · 품목 대장</h2>
      {sp.msaved && <div className="card" style={{ borderColor: "#9cc1b3" }}>저장했습니다.</div>}
      {err && !edit && !sp.madd && <div className={`card ${s.fix}`}>저장 안 됨 — {err}</div>}
      <table className="v2t">
        <thead>
          <tr><th>품목</th><th>제안</th><th>판단</th><th>별표 5</th><th>확인</th><th></th></tr>
        </thead>
        <tbody>
          {m.items.map((r: any) => {
            const acts = splitSemi(r.acts);
            const sug = suggest(acts);
            const decided = r.verdict === "해당" || r.verdict === "비해당";
            const tip = [deptName.get(r.dept_id) || r.dept_id || "부서 미정", r.owner_staff_id ? who(r.owner_staff_id) : "", r.related_law].filter(Boolean).join(" · ");
            return (
              <tr key={r.item_id} id={`mat-${r.item_id}`}>
                <td title={tip}><b>{r.item_name}</b></td>
                <td title={acts.map((a) => ACT_LABEL[a] || a).join(" · ")}>{sug.tag}</td>
                <td title={`${r.reason || ""}${r.basis_ref ? ` · 근거: ${r.basis_ref}` : ""}${decided ? ` · ${who(r.judged_by)} ${r.judged_at || ""}` : ""}`}>
                  <span className={`badge ${VTONE[r.verdict] || "none"}`}>{r.verdict || "확인 필요"}</span></td>
                <td>{r.verdict === "비해당" ? "—" : b5Text(r.byeolpyo5)}</td>
                <td>{r.ceo_confirmed_at ? <span className="badge ok" title={r.ceo_proxy === "Y" ? "총괄 대리" : ""}>{String(r.ceo_confirmed_at).slice(5)}</span>
                  : decided && canConfirm ? (
                    <form action={confirmMaterial}>
                      <input type="hidden" name="role" value={role} />
                      <input type="hidden" name="item_id" value={r.item_id} />
                      <button className="btn sm" type="submit">{role === "ceo" ? "확인" : "대리 확인"}</button>
                    </form>
                  ) : <span className="muted">{decided ? "대기" : "—"}</span>}
                </td>
                <td><Link className="btn sm ghost" href={q(`/system?area=M&medit=${r.item_id}#medit`)}>고치기</Link></td>
              </tr>
            );
          })}
          {!m.items.length && <tr><td colSpan={6} className="muted">품목 없음</td></tr>}
        </tbody>
      </table>

      {editing && (
        <div className="card" id="medit" style={{ marginTop: 12 }}>
          <h3>판단 고치기 — {editing.item_name}</h3>
          <MaterialForm key={editing.item_id} role={role} item={editing} depts={deptOpts} staff={staffOpts} err={err} />
        </div>
      )}
      <details className="card fold" id="madd" open={Boolean(sp.madd)} style={{ marginTop: 8 }}>
        <summary>품목 올리기</summary>
        <MaterialForm role={role} depts={deptOpts} staff={staffOpts} err={sp.madd ? err : ""} />
      </details>

      <h2>각 호</h2>
      <ClauseCards clauses={m.clauses.slice(1)} sts={m.sts.slice(1)} na={m.na.slice(1)} />

      {m.yesN > 0 && (
        <details className="card fold" id="m5rec" style={{ marginTop: 12 }}>
          <summary>제8조제5호 반기 점검 기록</summary>
          <form action={recordMaterialHalf} className={s.form}>
            <input type="hidden" name="role" value={role} />
            <div><label>점검일</label><input type="date" name="done_at" defaultValue={TODAY} /></div>
            <div className={s.wide}><label>점검 내용</label><textarea name="content" required /></div>
            <div className={s.wide}><label>필요한 조치</label><input type="text" name="action_needed" /></div>
            <FileAttach />
            {canConfirm && (
              <div className={s.rep}>
                <label><input type="checkbox" name="ceo_reported" value="Y" style={{ width: "auto" }} /> 경영책임자 보고받음{role === "ceo" ? "" : "(대리)"}</label>
              </div>
            )}
            <div><button className="btn" type="submit">점검 기록</button></div>
          </form>
        </details>
      )}

      <div style={{ marginTop: 16 }}>
        <Link className="btn ghost" href={q("/targets")}>관리대상 보기 →</Link>
      </div>
    </>
  );
}
