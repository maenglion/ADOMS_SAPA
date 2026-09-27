// [캡처 v2] 설명 문단 삭제 · 상태 카드 → 단계 막대(누르면 거름) · 표 9칸→6칸 15행 · 알림은 접기(09-22)
import Link from "next/link";
import ExportButton from "@/components/ExportButton";
import { tasks, approvals, depts, staff, notifications } from "@/lib/data";
import { deptOf, ROLE_STAFF } from "@/lib/roles";
import { StatusBadge } from "@/components/bits";
import Steps, { type Step } from "@/components/Steps";
import { markRead } from "../status/actions";
// 09-26 사용자: 메뉴 밖 화면 합치기 — 이행현황 레이아웃 + 좌측(StatusSide) · 옛 /qr 은 「휴대폰으로 열기」 칸으로
import { UsLayout } from "@/components/us/Parts";
import StatusSide from "../status/_parts/StatusSide";
import { withDbReadTrace } from "@/lib/db";
// 09-26 사용자: 「ADOMS는 점검을 실제로 하는 앱이 아니니 휴대폰 현장 등록 기능은 다 빼자」 — PhoneBox(QR) 뺌

export const dynamic = "force-dynamic";

const APPROVAL = ["작성중", "제출", "승인", "반려"];

export default async function Tasks({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return withDbReadTrace("/tasks", () => renderTasks({ searchParams }));
}

async function renderTasks({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const dept = sp.dept ?? deptOf(role);
  const mine = sp.mine === "1";
  const side = <StatusSide on="tasks" role={role} />; // 09-26 사용자: 메뉴 밖 화면 합치기 — 좌측 = 머리 메뉴 이행현황


  // 알림 — 나에게 온 안 읽은 조치 지시를 맨 앞에(「읽음 확인」을 누르면 이행현황 메시지 발신 목록의 읽음 수가 오른다, 09-24)
  const me = ROLE_STAFF[role] || "";
  const [all, approvalRows, deptRows, staffRows, notis0] = await Promise.all([
    tasks({ limit: 5000 }), approvals(), depts(), staff(), notifications(mine ? me : undefined),
  ]);
  const ap = new Map(approvalRows.map((a: any) => [a.task_id, a]));
  const deptName = new Map(deptRows.map((d: any) => [d.dept_id, d.dept_name]));
  const staffName = new Map(staffRows.map((s: any) => [s.staff_id, s.display_name]));
  const needRead = (n: any) => n.to_staff_id === me && n.notif_type === "조치 지시" && !n.read_at;
  const notis = [...notis0.filter(needRead), ...notis0.filter((n: any) => !needRead(n))];
  const here = `/tasks?${new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]).toString()}`;

  let base = all.map((t: any) => ({ ...t, ...(ap.get(t.task_id) || {}) }));
  if (dept) base = base.filter((r: any) => r.dept_id === dept);
  if (mine) base = base.filter((r: any) => r.owner_staff_id === ROLE_STAFF[role]);
  // [캡처 v2] 의무조항 거르기 — 조항별 이행 현황표에서 누르고 들어온다(09-24)
  if (sp.code) base = base.filter((r: any) => String(r.code36 || "").split(";")[0].trim() === sp.code);

  let rows = base;
  if (sp.status) rows = rows.filter((r: any) => r.status === sp.status);
  if (sp.approval) rows = rows.filter((r: any) => r.approval_status === sp.approval);

  // 숫자는 필터를 걸기 전(base)으로 센다(09-21 정정).
  const cnt = (s: string) => base.filter((r: any) => r.status === s).length;
  const acnt = (s: string) => base.filter((r: any) => (r.approval_status || "작성중") === s).length;
  const q = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams({ role });
    if (dept) p.set("dept", dept);
    if (mine) p.set("mine", "1");
    if (sp.status) p.set("status", sp.status);
    if (sp.approval) p.set("approval", sp.approval);
    if (sp.code) p.set("code", sp.code);
    if (sp.all) p.set("all", sp.all);
    Object.entries(o).forEach(([k, v]) => (v === undefined ? p.delete(k) : p.set(k, v)));
    return `/tasks?${p.toString()}`;
  };
  const LIM = sp.all ? 300 : 15;

  // [캡처 v2] 이행 단계 — 누르면 그 상태만
  const st = (s: string, tone: Step["state"]): Step => ({
    label: s, n: cnt(s), state: sp.status === s ? "on" : cnt(s) ? tone : "",
    href: q({ status: sp.status === s ? undefined : s }),
  });
  const steps: Step[] = [st("이행대기", ""), st("기간초과", "warn"), st("이행완료", "done"), st("조치필요", "warn"), st("점검완료", "done")];

  return (
    <UsLayout side={side}>
      <h1 className="v2h">처리 현황</h1>{/* [캡처 v2] 메뉴 이름과 맞춤(09-23) */}
      <div className="chips">
        <span className="badge">{dept ? deptName.get(dept) || dept : "전 기관"}</span>
        {sp.code && <Link className="badge" href={q({ code: undefined })} title="조항 거르기 지우기">{sp.code} ✕</Link>}
        <span className="badge none">{rows.length.toLocaleString()}건</span>
        <ExportButton what="tasks" />
      </div>

      <Steps items={steps} />

      <div className="chips">
        {APPROVAL.map((a) => (
          <Link key={a} className={`chip ${sp.approval === a ? "on" : ""}`} href={q({ approval: sp.approval === a ? undefined : a })}>
            {a} <b>{acnt(a)}</b>
          </Link>
        ))}
        <span style={{ flex: 1 }} />
        <Link className={`chip ${mine ? "on" : ""}`} href={mine ? q({ mine: undefined }) : q({ mine: "1" })}>내가 담당</Link>
        <Link className={`chip ${!dept ? "on" : ""}`} href={q({ dept: dept ? undefined : "" })}>전 기관</Link>
        {(sp.status || sp.approval) && <Link className="chip" href={q({ status: undefined, approval: undefined })}>조건 지우기</Link>}
      </div>

      <table className="v2t" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>의무</th>
            <th>대상</th>
            <th>부서</th>
            <th className="dt">기한</th>
            <th className="cd">이행</th>
            <th className="cd">결재</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, LIM).map((r: any) => (
            <tr key={r.task_id}>
              <td title={`${r.code36} ${r.code36_name} · ${r.law} ${r.unit_label_ko} · ${r.period_label}`}>
                <Link href={`/duties/${r.duty_key}?role=${role}`}>{r.duty_name || r.article_title || r.code36_name}</Link>
              </td>
              <td title={r.asset_name || r.target_name}>{r.asset_name || r.target_name}</td>
              <td title={staffName.get(r.owner_staff_id) || ""}>{r.dept_name}</td>
              <td className="dt" title={r.status === "기간초과" ? `${Math.abs(r.days_left || 0)}일 경과` : ""}>{String(r.due_date || "").slice(5)}</td>
              <td className="cd"><StatusBadge s={r.status} /></td>
              <td className="cd"><span className={`badge ${r.approval_status === "승인" ? "ok" : r.approval_status === "반려" ? "bad" : "none"}`}>{r.approval_status || "작성중"}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > LIM && <Link className="more" href={q({ all: "1" })}>전체 {rows.length.toLocaleString()}건 →</Link>}

      {notis.length > 0 && (
        <details className="card fold" style={{ marginTop: 14 }} open={notis.some(needRead)}>
          <summary>알림 <span className="muted">{notis.length.toLocaleString()}</span>{notis.some(needRead) && <span className="badge warn" style={{ marginLeft: 8 }}>읽음 확인할 조치 지시 {notis.filter(needRead).length}</span>}</summary>
          <table className="v2t">
            <tbody>
              {notis.slice(0, 10).map((n: any) => (
                <tr key={n.notif_id}>
                  <td className="dt">{String(n.sent_at || "").slice(5, 10)}</td>
                  <td><span className={`badge ${n.notif_type === "기한초과" ? "bad" : "warn"}`}>{n.notif_type}</span></td>
                  <td title={n.message}>{n.message}</td>
                  <td className="dt">
                    {n.read_at
                      ? <span className="muted" title="읽음 확인한 때">{String(n.read_at).slice(5, 10)} 읽음</span>
                      : n.to_staff_id === me && n.notif_type === "조치 지시"
                        ? (
                          <form action={markRead}>
                            <input type="hidden" name="role" value={role} />
                            <input type="hidden" name="notif_id" value={n.notif_id} />
                            <input type="hidden" name="back" value={here} />
                            <button className="btn sm" type="submit">읽음 확인</button>
                          </form>
                        )
                        : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

    </UsLayout>
  );
}
