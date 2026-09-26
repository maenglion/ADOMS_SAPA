// [캡처 v2] 조문·의무조항 배지·하단 안내·꼬리말 삭제 · 날짜 MM-DD(09-22) — 휴대폰 화면이라 단계 막대는 넣지 않음
import Link from "next/link";
import { redirect } from "next/navigation";
import { tasks, approvals, evidences, depts, staff } from "@/lib/data";
import { deptOf, ROLE_LABEL, ROLE_STAFF } from "@/lib/roles";
import { uploadFromPhone } from "../evidence/actions";

export const dynamic = "force-dynamic";

/**
 * S18 — 휴대폰 현장 등록.
 * 현장에서 사진을 찍어 그 자리에서 올리는 화면. 앱을 따로 만들지 않는다 —
 * `capture="environment"` 한 줄이면 휴대폰에서 **뒷면 카메라가 바로 열린다**.
 *
 * 쓰는 법: 같은 와이파이에서 휴대폰으로 `http://<이 PC 주소>:3100/m?role=road` 로 들어간다.
 * 설정 화면에 주소와 QR 이 있다.
 * 09-26 사용자: 메뉴 밖 화면 합치기 — 주소와 QR 은 처리 현황(/tasks)의 「휴대폰으로 열기」 칸으로 옮겼다. 이 화면 모양은 그대로.
 */
export default async function Mobile({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  // 09-26 사용자: 「ADOMS는 점검을 실제로 하는 앱이 아니니 휴대폰 현장 등록 기능은 다 빼자」 — 처리 현황으로 보낸다(되돌리려면 이 줄을 지운다)
  redirect(`/tasks?role=${sp.role || "gm"}`);
  const role = sp.role || "road";
  const dept = deptOf(role);
  const me = ROLE_STAFF[role];

  const all = await tasks({ limit: 5000 });
  const ap = new Map((await approvals()).map((a: any) => [a.task_id, a]));
  const evs = await evidences();
  const deptName = new Map((await depts()).map((d: any) => [d.dept_id, d.dept_name]));
  const staffName = new Map((await staff()).map((s: any) => [s.staff_id, s.display_name]));

  const evByTask = new Map<string, any[]>();
  evs.forEach((e: any) => evByTask.set(e.task_id, [...(evByTask.get(e.task_id) || []), e]));

  let rows = all.map((t: any) => ({ ...t, ...(ap.get(t.task_id) || {}) }));
  if (dept) rows = rows.filter((r: any) => r.dept_id === dept);
  if (sp.mine === "1" && me) rows = rows.filter((r: any) => r.owner_staff_id === me);

  const 해야할것 = rows
    .filter((r: any) => (r.approval_status || "작성중") === "작성중" && r.status !== "점검완료")
    .sort((a: any, b: any) => (a.due_date < b.due_date ? -1 : 1));
  const 올린것 = rows.filter((r: any) => r.approval_status === "제출" || r.approval_status === "승인");

  const sel = sp.t;
  const cur = sel ? rows.find((r: any) => r.task_id === sel) : null;
  const curEv = cur ? (evByTask.get(cur.task_id) || []) : [];
  const d남음 = (due: string) => Math.round((+new Date(due) - Date.now()) / 86400000);

  return (
    <div className="mob">
      <div className="mtop">
        <b>현장 등록</b>
        <span>{ROLE_LABEL[role]}{dept ? ` · ${deptName.get(dept)}` : ""}</span>
      </div>

      {!cur ? (
        <>
          <div className="mtab">
            <Link className={`mchip ${sp.mine === "1" ? "" : "on"}`} href={`/m?role=${role}`}>부서 전체 {rows.length}</Link>
            <Link className={`mchip ${sp.mine === "1" ? "on" : ""}`} href={`/m?role=${role}&mine=1`}>내 것</Link>
          </div>

          <div className="msum">
            <div><b>{해야할것.length}</b><span>올릴 것</span></div>
            <div><b>{해야할것.filter((r: any) => r.status === "기간초과").length}</b><span>기한 지남</span></div>
            <div><b>{올린것.length}</b><span>올린 것</span></div>
          </div>

          <div className="mlist">
            {해야할것.slice(0, 40).map((r: any) => {
              const left = d남음(r.due_date);
              return (
                <Link key={r.task_id} className="mcard" href={`/m?role=${role}&t=${r.task_id}${sp.mine === "1" ? "&mine=1" : ""}`}>
                  <div className="mtitle">{r.duty_name || r.article_title || r.code36_name}</div>
                  <div className="mmeta">{r.asset_name || r.target_name}</div>
                  <div className="mmeta2">
                    <span className={`mbadge ${r.status === "기간초과" ? "bad" : left <= 14 ? "warn" : ""}`}>
                      {r.status === "기간초과" ? `${Math.abs(left)}일 지남` : `${left}일 남음`}
                    </span>
                    <span className="mdim">{String(r.due_date || "").slice(5)}</span>
                  </div>
                </Link>
              );
            })}
            {해야할것.length === 0 && <p className="mdim" style={{ padding: 20 }}>올릴 것이 없습니다.</p>}
          </div>
          {/* 09-26 사용자: 메뉴 밖 화면 합치기 — 처리 현황(PC 화면)으로 돌아가는 길 */}
          <Link className="mback" href={`/tasks?role=${role}`}>← 처리 현황(PC 화면)</Link>
        </>
      ) : (
        <>
          <Link className="mback" href={`/m?role=${role}${sp.mine === "1" ? "&mine=1" : ""}`}>← 목록</Link>

          <div className="mdetail">
            <div className="mtitle big">{cur.duty_name || cur.article_title || cur.code36_name}</div>
            <div className="mmeta2" style={{ marginTop: 8 }}>
              <span className="mbadge">{cur.period_label}</span>
              <span className={`mbadge ${cur.status === "기간초과" ? "bad" : ""}`}>기한 {String(cur.due_date || "").slice(5)}</span>
            </div>
            <div className="mmeta" style={{ marginTop: 8 }}>
              {cur.asset_name || cur.target_name} · {staffName.get(cur.owner_staff_id) || "-"}
            </div>
            {cur.evidence_kind && (
              <div className="mhint"><b>증빙</b> {cur.evidence_kind.split(/[,·(]/)[0]}</div>
            )}
          </div>

          {curEv.length > 0 && (
            <div className="mdetail">
              <b>올라온 것 {curEv.length}</b>
              {curEv.map((e: any) => (
                <div key={e.evidence_id} className="mev">
                  {e.file_url && (e.file_type || "").startsWith("image/")
                    ? <img src={e.file_url} alt={e.file_name} />
                    : <span className="mbadge">{e.evidence_kind}</span>}
                  <div>
                    <div>{e.file_name}</div>
                    <div className="mdim">{e.uploaded_at} · {staffName.get(e.uploaded_by) || e.uploaded_by}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form action={uploadFromPhone} className="mform">
            <input type="hidden" name="role" value={role} />
            <input type="hidden" name="task_id" value={cur.task_id} />

            <label className="mbtn cam">
              📷 사진 찍어 올리기
              <input type="file" name="photos" accept="image/*" capture="environment" multiple />
            </label>

            <label className="mbtn file">
              📎 파일 고르기 (사진·PDF)
              <input type="file" name="photos" accept="image/*,application/pdf" multiple />
            </label>

            <textarea name="note" rows={3} placeholder="현장 메모(선택)" />

            <button className="mbtn go" type="submit">등록하고 제출</button>
          </form>
        </>
      )}
    </div>
  );
}
