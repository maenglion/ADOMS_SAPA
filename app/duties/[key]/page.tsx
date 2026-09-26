import { UsLayout } from "@/components/us/Parts";
import MenuSide from "@/components/us/MenuSide";
import Link from "next/link";
import { dutyByKey, forms, tasks, duties, evidences, assetById, assignmentFor, assignmentsFor, mappingFor, staff, depts } from "@/lib/data";
import StaffPicker from "@/components/StaffPicker";
import { verdictKo, cleanBasis } from "@/lib/labels";
import { saveAssignment } from "./actions";
import WhyPath from "@/components/WhyPath";
import { duty36Label } from "@/lib/duty36";
import { buildWhy } from "@/lib/why";
import { AreaBadge, Badges, StatusBadge, Bar } from "@/components/bits";
import { secureAxisOrUnset } from "@/lib/axes";
import Steps, { Facts, type Step } from "@/components/Steps";
import { isDemoMode } from "@/lib/mode";

export const dynamic = "force-dynamic";

/** 이행 유형(T01~T10)마다 실제로 무엇을 내는지 — 담당자가 제일 먼저 묻는 것. */
const EVIDENCE_HINT: Record<string, string[]> = {
  T01: ["○○ 계획서(연간·반기)", "계획 수립 결재문서", "계획 시행 공문"],
  T02: ["선임·임명 통보서", "자격증 사본", "선임 신고 접수증"],
  T03: ["교육일지(일시·장소·대상·내용)", "참석자 서명부", "교육 자료·사진"],
  T04: ["점검 결과표(법정 서식)", "현장 사진", "지적사항 조치 결과"],
  T05: ["기준 적합 확인서", "설계도서·시방서 해당 부분", "준공·검사 조서"],
  T06: ["작업일지", "작업 전 안전점검(TBM) 기록", "보호구 지급 대장"],
  T07: ["물질·제품 관리대장", "MSDS 비치 확인", "보관·폐기 기록"],
  T08: ["작업환경측정 결과표", "건강진단 결과 통보서", "개선 조치 기록"],
  T09: ["비상대응 매뉴얼", "훈련 계획·결과보고서", "훈련 사진"],
  T10: ["보고 공문·접수증", "게시 사진", "기록 보존 대장"],
};

export default async function DutyDetail({ params, searchParams }:
  { params: Promise<{ key: string }>; searchParams: Promise<Record<string, string>> }) {
  const { key } = await params;
  const sp = await searchParams;
  const role = sp.role || "gm";
  const demo = await isDemoMode();
  const d = await dutyByKey(key);
  if (!d) return <p>의무를 찾지 못했습니다. <Link href={`/duties?role=${role}`}>← 목록</Link></p>;

  const [allForms, allTasks, allDuties, allEv] = await Promise.all([
    forms(), tasks({ limit: 5000 }), duties({ limit: 100000 }), evidences(),
  ]);
  const form = d.schedule_id ? allForms.find((f: any) => f.form_id === d.schedule_id) : null;
  const myTasks = allTasks.filter((t: any) => t.duty_key === key);
  const done = myTasks.filter((t: any) => t.status === "이행완료" || t.status === "점검완료").length;
  const taskIds = new Set(myTasks.map((t: any) => t.task_id));
  const myEv = allEv.filter((e: any) => taskIds.has(e.task_id)).slice(0, 6);

  // 같은 법령 안에서 이 조문이 어디에 있는가 — 법 → 문서 → 조 → 세부
  const sameDoc = allDuties.filter((x: any) => x.doc === d.doc);
  const artNo = (u: string) => (u || "").split("제")[1]?.split("조")[0];
  const sameArticleRaw = sameDoc.filter((x: any) => artNo(x.unit_label_ko) === artNo(d.unit_label_ko));
  // 같은 조문·같은 이름이 분류만 달라 여러 줄로 나오지 않게 접는다(어느 분류들인지는 함께 보여 준다).
  const foldedMap = new Map<string, any>();
  sameArticleRaw.forEach((x: any) => {
    const k = `${x.unit_label_ko}|${x.duty_name || x.article_title}`;
    const hit = foldedMap.get(k);
    if (hit) { if (!hit.codes.includes(x.code36)) hit.codes.push(x.code36); }
    else foldedMap.set(k, { ...x, codes: [x.code36] });
  });
  const sameArticle = [...foldedMap.values()];

  // 법 제4조 축 이름(「제1호 …」)은 중대산업재해용이라 중대시민재해에 맞지 않았다 → 의무조항 36 표준 근거로(09-22).
  const axis = duty36Label(d.code36) || secureAxisOrUnset(d.code36);

  // 설명 경로 — 자산에서 들어왔으면(?asset=) 그 자산 고리를 넣는다.
  const asset = sp.asset ? await assetById(sp.asset) : null;
  const [assignment, mapping] = await Promise.all([
    assignmentFor(key, asset?.asset_id),
    asset ? mappingFor(asset.asset_id, d.target_code) : Promise.resolve(null),
  ]);
  const why = buildWhy({ duty: d, asset, mapping, assignment, role });
  const [allAsg, stl, dl] = await Promise.all([assignmentsFor(key), staff(), depts()]);
  const deptName = new Map(dl.map((x: any) => [x.dept_id, x.dept_name]));
  const staffOpts = stl.map((x: any) => ({ staff_id: x.staff_id, display_name: x.display_name,
    dept_name: deptName.get(x.dept_id) || x.dept_id, duty_role: x.duty_role || "" }));
  const nameOf = (id?: string) => stl.find((x: any) => x.staff_id === id)?.display_name || "";
  const asgCnt = (v: string) => allAsg.filter((a: any) => (a.applicability || "확인필요") === v).length;
  const hint = EVIDENCE_HINT[(d.impl_type || "").slice(0, 3)] || [];

  // [캡처 v2] 업무이행 단계 — 이 의무의 과제가 어느 단계에 몇 건 있는가(09-22 사용자 지시: 절차를 맨 위에)
  const cnt = (f: (t: any) => boolean) => myTasks.filter(f).length;
  const nWait = cnt((t) => t.status === "이행대기" || t.status === "기간초과");
  const nDone = cnt((t) => t.status === "이행완료");
  const nChecked = cnt((t) => t.status === "점검완료");
  const nFix = cnt((t) => t.status === "조치필요");
  const nAppr = cnt((t) => t.approval_status === "승인");
  const nLate = cnt((t) => t.status === "기간초과");
  const steps: Step[] = [
    { label: "배정", n: allAsg.length, state: "done", href: "#assign" },
    { label: "이행", n: nWait, state: nWait ? "on" : "done", href: `/tasks?role=${role}&duty=${key}` },
    { label: "증빙", n: nDone, state: nDone ? "on" : "", href: `/evidence?role=${role}&duty=${key}` },
    { label: "판정", n: nChecked, state: nChecked ? "done" : "", href: `/review?role=${role}` },
    { label: "조치", n: nFix, state: nFix ? "warn" : "", href: `/actions?role=${role}` },
    { label: "결재", n: nAppr, state: nAppr ? "done" : "", href: `/inspections?role=${role}&view=approve` },
  ];
  const pct = myTasks.length ? Math.round(((nChecked + nDone) / myTasks.length) * 100) : 0;
  const owner = nameOf(assignment?.owner_staff_id);
  const deputy = nameOf(assignment?.deputy_staff_id);
  const nextDue = myTasks.filter((t: any) => t.status === "이행대기" || t.status === "기간초과")
    .map((t: any) => t.due_date).sort()[0];

  return (
    <UsLayout side={<MenuSide group="법 의무사항" />}>   {/* 09-25: 좌측 = 머리 메뉴 법 의무사항과 같은 구성 */}
      <div className="crumb"><Link href={`/duties?role=${role}&axis=code`}>의무</Link> › <Link href={`/duties/list?role=${role}&code=${d.code36}`}>{d.code36} {d.code36_name}</Link></div>
      <h1 className="v2h">{d.duty_name || d.article_title}</h1>
      <div className="chips">
        <AreaBadge area={d.area} />
        <span className="badge">{d.law} {d.unit_label_ko}</span>
        <span className="badge none">{d.target_name}</span>
      </div>

      <Steps items={steps} />

      <Facts items={[
        { k: "이행률", v: <><b>{pct}%</b> <span className="muted">{myTasks.length}건</span></> },
        { k: "다음 기한", v: nextDue ? <b className={nLate ? "tone-bad" : ""}>{nextDue.slice(5)}</b> : "-" },
        { k: "주기", v: assignment?.cycle || d.cycle_text?.slice(0, 12) || "-" },
        { k: "담당", v: owner ? <>{owner}{deputy ? <span className="muted"> · {deputy}</span> : null}</> : "-" },
        { k: "증빙", v: (d.evidence_kind || "-").split(/[,·(]/)[0].slice(0, 14) },
      ]} />

      <div className="grid g2" style={{ marginTop: 12 }}>
        <div className="card">
          <h3>과제 <span className="muted">{myTasks.length}</span></h3>
          <table className="v2t">
            <thead><tr><th>부서</th><th>대상</th><th className="dt">기한</th><th className="cd">상태</th></tr></thead>
            <tbody>
              {myTasks.length === 0 && <tr><td colSpan={4} className="muted">없음</td></tr>}
              {myTasks.slice(0, 8).map((t: any) => (
                <tr key={t.task_id}>
                  <td>{t.dept_name || t.dept_id}</td>
                  <td title={t.asset_name || t.target_name}>{t.asset_name || t.target_name}</td>
                  <td className="dt">{(t.due_date || "").slice(5)}</td>
                  <td className="cd"><StatusBadge s={t.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {myTasks.length > 8 && <Link className="more" href={`/tasks?role=${role}&duty=${key}`}>전체 {myTasks.length}건 →</Link>}
        </div>

        <div className="card">
          <h3>증빙 <span className="muted">{myEv.length}</span></h3>
          {myEv.length === 0 ? <p className="muted">아직 없음</p> : (
            <table className="v2t"><tbody>
              {myEv.map((e: any) => (
                <tr key={e.evidence_id}><td title={e.file_name}>{e.file_name}</td><td className="dt">{(e.uploaded_at || "").slice(5, 10)}</td></tr>
              ))}
            </tbody></table>
          )}
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link className="btn" href={`/evidence?role=${role}&duty=${key}`}>증빙 등록</Link>
            {form && <Link className="btn ghost" href={`/forms/${form.form_id}?back=${encodeURIComponent(`/duties/${key}?role=${role}`)}`}>법정 서식</Link>}
          </div>
        </div>
      </div>

      {assignment && (
        <details className="card fold" id="assign" style={{ marginTop: 12 }}>
          <summary>담당 · 해당 여부 <span className="badge none">{assignment.applicability || "확인필요"}</span></summary>
          <form action={saveAssignment} className="asg-form">
            <input type="hidden" name="role" value={role} />
            <input type="hidden" name="assign_id" value={assignment.assign_id} />
            <input type="hidden" name="duty_key" value={key} />
            <div><label>부서</label><div>{deptName.get(assignment.dept_id) || assignment.dept_id}</div></div>
            <div><label>정담당</label><StaffPicker name="owner_staff_id" staff={staffOpts} defaultValue={assignment.owner_staff_id} label="정담당" /></div>
            <div><label>부담당</label><StaffPicker name="deputy_staff_id" staff={staffOpts} defaultValue={assignment.deputy_staff_id} label="부담당" allowEmpty /></div>
            <div><label>주기</label>
              <select name="cycle" defaultValue={assignment.cycle || ""}>
                {[...new Set(["", "상시", "수시", "분기 1회", "반기 1회", "연1회", assignment.cycle || ""])].map((c) => <option key={c} value={c}>{c || "—"}</option>)}
              </select></div>
            <div className="asg-app"><label>해당 여부</label>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                {["해당", "비해당", "확인필요"].map((v) => (
                  <label key={v} style={{ fontWeight: 400 }}>
                    <input type="radio" name="applicability" value={v} defaultChecked={(assignment.applicability || "확인필요") === v} /> {v}
                  </label>
                ))}
              </div></div>
            <div className="asg-note"><label>사유</label>
              <input type="text" name="applicability_note" defaultValue={assignment.applicability_note || ""} placeholder="비해당이면 필수" style={{ width: "100%" }} /></div>
            <div><button className="btn" type="submit">저장</button></div>
          </form>
        </details>
      )}

      <details className="card fold" style={{ marginTop: 12 }}>
        <summary>조문 보기 <span className="muted">{d.law} {d.unit_label_ko}</span></summary>
        <p style={{ whiteSpace: "pre-wrap" }}>{d.source_text || "(원문 없음)"}</p>
        {sameArticle.length > 1 && (
          <p className="muted">같은 조 {sameArticle.length - 1}건: {sameArticle
            .filter((x: any) => (x.unit_label_ko !== d.unit_label_ko) || ((x.duty_name || x.article_title) !== (d.duty_name || d.article_title)))
            .slice(0, 6).map((x: any, i: number) => (
              <span key={x.duty_key}>{i ? " · " : ""}<Link href={`/duties/${x.duty_key}?role=${role}`}>{x.unit_label_ko}</Link></span>
            ))}</p>
        )}
      </details>

      <details className="card fold" style={{ marginTop: 12 }}>
        <summary>왜 우리에게 걸리나</summary>
        <WhyPath steps={why} title={asset ? `「${asset.asset_name}」` : ""} />
      </details>
    </UsLayout>
  );
}
