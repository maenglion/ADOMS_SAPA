// [캡처 v2] 체계 수립 — 제목 + 탭 + 단계 막대 + 요약 칸 + 한 줄 표. 설명 문단·근거 설명은 뺐다(2026-09-22).
import Link from "next/link";
import FlowBar from "@/components/FlowBar";
import Steps, { Facts } from "@/components/Steps";
import { systemStatus } from "@/lib/system";
import { registerRole } from "./actions";
import { ORG_ITEMS } from "./items";
import s from "./system.module.css";
import CivilView from "./CivilView";
import MaterialView from "./MaterialView";
import ClauseCards, { clauseSteps } from "./ClauseCards";
import { ymd } from "@/lib/day";
import FileAttach from "@/components/FileAttach"; // [캡처 v2] K03
import { UsLayout, PerformSide } from "@/components/us/Parts";   // 09-26 사용자: 메뉴 밖 화면 합치기
import { MergedTitle } from "../perform/_merge";

export const dynamic = "force-dynamic";
const TODAY = ymd();

const AREAS = [
  { key: "I", label: "중대산업재해" },
  { key: "F", label: "중대시민재해(공중이용시설·공중교통수단)" },
  { key: "M", label: "중대시민재해(원료·제조물)" },
] as const;

/** ① 체계 수립 — 재해 구분 탭 3개. 기본(I)은 시행령 제4조 각 호. */
export default async function SystemPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const area = sp.area === "F" || sp.area === "M" ? sp.area : "I";
  const q = (href: string) => `${href}${href.includes("?") ? "&" : "?"}role=${role}`;

  // 09-26 사용자: 메뉴 밖 화면 합치기 — 체계 수립(호별 현황)은 의무이행(실적증빙) 각 대상 첫 화면의 「호별 현황」 요약에서 연다.
  //   이 화면은 그 대상의 의무이행 레이아웃 + 좌측(탭의 대상 묶음을 펼침) 안에서 열리고, 제목 줄에 「← 받는 화면으로」.
  //   자료(선임·지정 · 경영방침 · 절차·매뉴얼 · 체계 기록)는 그대로 — 의무이행 단계 기록과 따로 쌓인다.
  const track = area === "F" ? "fc" : area === "M" ? "mt" : "ws";
  const back = { ws: "사업장", fc: "공중이용시설·공중교통수단", mt: "원료·제조물" }[track];
  const side = <PerformSide track={track} />;
  const head = (
    <>
      <FlowBar step="system" role={role} />
      <MergedTitle title="체계 수립 — 호별 현황" back={`/perform/${track}?role=${role}`} backLabel={`${back} 의무이행으로`} />
      <div className={s.tabs} role="tablist">
        {AREAS.map((a) => (
          <Link key={a.key} role="tab" aria-selected={area === a.key} className={`${s.tab} ${area === a.key ? s.tabOn : ""}`}
                href={q(a.key === "I" ? "/system" : `/system?area=${a.key}`)}>
            <b>{a.label}</b>
          </Link>
        ))}
      </div>
    </>
  );
  if (area === "F") return <UsLayout side={side}>{head}<CivilView role={role} by={sp.by || "kind"} /></UsLayout>;
  if (area === "M") return <UsLayout side={side}>{head}<MaterialView role={role} sp={sp} /></UsLayout>;

  const { clauses, sts, cnt, unkN, dl, deptName, st, policy, manual, got, who, evalDoc, m9covers, mok } = await systemStatus(role);
  const staffOpts = st.filter((x: any) => String(x.staff_id).startsWith("S"));

  const steps = clauseSteps([
    { label: "방침", nos: [1], href: q("/system/record?clause=1") },
    { label: "조직", nos: [2, 6], href: "#matrix" },
    { label: "절차", nos: [3, 7, 8, 9], href: "#manual" },
    { label: "예산", nos: [4], href: q("/budget") },
    { label: "평가", nos: [5], href: q("/system/record?clause=5") },
  ], clauses, sts);

  return (
    <UsLayout side={side}>
      {head}
      <div className="chips"><span className="badge">시행령 제4조</span></div>
      <Steps items={steps} />

      <Facts items={[
        { k: "갖춰짐", v: <b>{cnt("ok")}/{clauses.length}</b> },
        { k: "일부", v: cnt("part") },
        { k: "없음", v: <b className={cnt("none") ? "tone-bad" : ""}>{cnt("none")}</b> },
        { k: "확인 필요", v: unkN },
      ]} />

      <h2>각 호</h2>
      <ClauseCards clauses={clauses} sts={sts} />

      <h2 id="matrix">선임·지정 현황</h2>
      <div className="tbl-wrap">
        <table className="v2t">
          <thead>
            <tr>
              <th>구분</th>
              {ORG_ITEMS.map((it) => (
                <th key={it.item} className={s.cell} title={it.law}>{it.short}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[{ dept_id: "", dept_name: "기관 전체" }, ...dl].map((d: any) => (
              <tr key={d.dept_id || "ALL"}>
                <td><b>{d.dept_name}</b></td>
                {ORG_ITEMS.map((it) => {
                  const applies = (it.scope === "기관") === (d.dept_id === "");
                  if (!applies) return <td key={it.item} className={`${s.cell} ${s.na}`}>─</td>;
                  const r = got(it.item, d.dept_id);
                  const on = r?.designated === "Y";
                  const tip = r
                    ? `${it.item} · ${r.status}${r.designated_at ? ` ${r.designated_at}` : ""}${r.method ? ` · ${r.method}` : ""}${r.staff_id ? ` · 담당 ${who(r.staff_id)}` : ""}${r.doc_name ? ` · ${r.doc_name}` : ""} · ${r.law_basis}`
                    : `${it.item} · 기록 없음`;
                  return (
                    <td key={it.item} className={s.cell} title={tip}>
                      <span className={on ? s.on : s.off}>{on ? "●" : "○"}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="card fold" id="register" style={{ marginTop: 12 }}>
        <summary>지정 등록</summary>
        <form action={registerRole} className={s.form}>
          <input type="hidden" name="role" value={role} />
          <div>
            <label>항목</label>
            <select name="role_item" required defaultValue="보건관리자">
              {ORG_ITEMS.map((it) => <option key={it.item} value={it.item}>{it.item}</option>)}
            </select>
          </div>
          <div>
            <label>부서</label>
            <select name="dept_id" defaultValue="">
              <option value="">— 기관 전체 —</option>
              {dl.map((d: any) => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)}
            </select>
          </div>
          <div><label>지정일</label><input type="date" name="designated_at" defaultValue={TODAY} /></div>
          <div>
            <label>방법</label>
            <select name="method" defaultValue="직접">
              {["직접", "겸직", "위탁(보건관리전문기관)", "위탁(안전관리전문기관)"].map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label>담당</label>
            <select name="staff_id" defaultValue="">
              <option value="">—</option>
              {staffOpts.map((x: any) => <option key={x.staff_id} value={x.staff_id}>{x.display_name} · {deptName.get(x.dept_id) || x.dept_id}</option>)}
            </select>
          </div>
          <div><label>근거 문서</label><input type="text" name="doc_name" style={{ width: "100%" }} /></div>
          <FileAttach />
          <div><button className="btn" type="submit">등록</button></div>
        </form>
      </details>

      <h2 id="policy">경영방침 · 목표</h2>
      <table className="v2t">
        <thead><tr><th>구분</th><th>문서</th><th className="dt">제정</th><th className="dt">개정</th><th>게시</th><th>담당</th></tr></thead>
        <tbody>
          {policy.map((p: any) => (
            <tr key={p.policy_id}>
              <td><span className="badge">{p.policy_kind}</span></td>
              <td title={p.summary}><b>{p.title}</b></td>
              <td className="dt">{String(p.enacted_at || "").slice(5)}</td>
              <td className="dt">{p.revised_at ? String(p.revised_at).slice(5) : "—"}</td>
              <td title={p.posted_where || ""}>{p.posted === "Y" ? <span className="badge ok">게시</span> : <span className="badge warn">미게시</span>}</td>
              <td>{who(p.owner_staff_id)}</td>
            </tr>
          ))}
          {!policy.length && <tr><td colSpan={6} className="muted">없음</td></tr>}
        </tbody>
      </table>

      <h2 id="manual">절차 · 매뉴얼</h2>
      <table className="v2t">
        <thead><tr><th>호</th><th>문서</th><th>빠진 목</th><th className="dt">개정</th><th className="dt">점검</th><th>담당</th></tr></thead>
        <tbody>
          {manual.map((m: any) => (
            <tr key={m.manual_id}>
              <td><Link href={`#c${m.clause_no}`}>제{m.clause_no}호</Link></td>
              <td title={`${m.title} · 담은 목 ${m.covers || "—"}`}><b>{m.title}</b></td>
              <td>{m.missing ? <span className="badge bad">{m.missing}목</span> : <span className="muted">—</span>}</td>
              <td className="dt">{String(m.revised_at || m.enacted_at || "").slice(5) || "—"}</td>
              <td className="dt">{m.last_check_at ? String(m.last_check_at).slice(5) : "—"}</td>
              <td>{who(m.owner_staff_id)}</td>
            </tr>
          ))}
          {!evalDoc && (
            <tr>
              <td><Link href="#c5">제5호</Link></td>
              <td>업무수행 평가 기준</td>
              <td><span className="badge bad">문서 없음</span></td>
              <td colSpan={3} />
            </tr>
          )}
          {!mok(m9covers, "다") && (
            <tr>
              <td><Link href="#c9">제9호</Link></td>
              <td>공사기간·건조기간 기준</td>
              <td><span className="badge none">확인 필요</span></td>
              <td colSpan={3} />
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link className="btn ghost" href={q("/system/record")}>체계 기록</Link>
        <Link className="btn" href={q("/duties")}>② 의무 확인 →</Link>
      </div>
    </UsLayout>
  );
}
