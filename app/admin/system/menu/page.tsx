// 09-25 사용자: 시스템 관리 › 메뉴 관리 — 머리 메뉴 항목의 이름 바꾸기 · 숨기기 · 순서 · 역할별 노출.
//  정의 원천은 lib/menu.ts(US_GROUPS) 그대로, 바꾼 것은 표 sys_menu 에 쌓는다(lib/menu_store.ts). 머리 메뉴와 좌측 메뉴에 함께 적용.
//  역할별 노출은 더 숨기기만 한다 — 권한표(lib/perm.ts)가 막은 칸은 「–」(켤 수 없음). 주소 차단은 권한표를 따른다.
import Link from "next/link";
import { UsLayout } from "@/components/us/Parts";
import AdminSide from "../../_side";
import { Note } from "../../_ui";
import { US_GROUPS, gKey, iKey, isLocked, LOCKED_GROUP, usGroupsFor } from "@/lib/menu";
import { menuSettingsRow } from "@/lib/menu_store";
import { ALL_ROLES, RULES, canAccess, normRole, PERM_ENFORCE, USER_KIND, MATRIX_NOTE } from "@/lib/perm";
import { ROLE_LABEL } from "@/lib/roles";
import { staff } from "@/lib/data";
import { saveMenu, resetMenu } from "../actions";

export const dynamic = "force-dynamic";

/** 표 머리용 짧은 이름 */
const SHORT: Record<string, string> = {
  ceo: "경영책임자", gm: "총괄", mgr: "관리자", road_head: "부서장\n도로", road: "실무자\n도로", water_head: "부서장\n상수도", water: "실무자\n상수도",
};

/** SCR-003 권한 매트릭스를 우리 메뉴 기준으로 옮긴 표(보기 전용) */
const MATRIX: { menu: string; path: string; basis: string }[] = [
  { menu: "이행현황 — 대시보드", path: "/", basis: "메인 행 — 모두" },
  { menu: "이행현황 — 상세(중대산업재해 · 중대시민재해 · 도급·용역·위탁)", path: "/status/industrial", basis: "메인 행 — 사업장, 부서는 메인만" },
  { menu: "관리대상 현황", path: "/targets/basic", basis: "막지 않음(매트릭스가 보기를 가르지 않음)" },
  { menu: "법 의무사항", path: "/law/ws", basis: "막지 않음" },
  { menu: "의무이행(실적증빙)", path: "/perform/ws", basis: "막지 않음" },
  { menu: "이행점검 및 조치", path: "/check/ws", basis: "⑤ 전 권한" },
  { menu: "기관장 예방활동", path: "/ceo", basis: "매트릭스 전 칸 빈칸 — 막지 않음" },
  { menu: "통계 및 사례", path: "/stats/occur", basis: "전 권한" },
  { menu: "게시판(공지사항 · 자료실)", path: "/board/notice", basis: "전 권한" },
  { menu: "관리자 — 담당자 관리대상 지정 · 기본정보 · 관계 법령 · 자동 확인 작업 기록", path: "/admin/assign", basis: "① 담당자/관리대상 지정 · 관리자 메뉴는 총괄·관리자만" },
  { menu: "관리자 — 담당자 권한지정", path: "/admin/role", basis: "시스템 관리자(사용자 등록/권한 부여)" },
  { menu: "관리자 — 시스템 관리(메뉴 · 코드 · 메일)", path: "/admin/system/menu", basis: "시스템 관리자" },
];

export default async function MenuAdmin({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const role = sp.role || "gm";
  const pv = normRole(sp.pv || "road");
  const { set, at, by, n } = await menuSettingsRow();
  const who = at ? (await staff()).find((x: any) => x.staff_id === by)?.display_name || by : "";
  const preview = usGroupsFor(pv, set);

  return (
    <UsLayout side={<AdminSide page="system/menu" />}>
      <div className="us-head usb2-head">
        <h1 className="us-h1"><span className="usb2-pre">시스템 관리</span> 메뉴 관리</h1>
      </div>
      {sp.ok === "save" && <Note>저장했습니다. 머리 메뉴와 좌측 메뉴에 바로 적용됩니다.</Note>}
      {sp.ok === "reset" && <Note>기본값으로 되돌렸습니다.</Note>}
      <p className="us-muted sysm-lead">
        메뉴 이름 · 순서 · 숨김과 역할별 노출을 정합니다. 역할별 노출은 <b>더 숨기기만</b> 합니다 — 권한표가 막은 칸(–)은 켤 수 없고,
        주소로 들어오는 것은 권한표가 막습니다. 시스템 관리 항목은 숨길 수 없습니다.
        {at && <> 마지막 저장 {at} · {who} (저장 {n}회)</>}
        {!PERM_ENFORCE && <b className="sysm-warn"> 지금 권한 제어가 꺼져 있습니다 — 역할별 노출과 권한표가 적용되지 않습니다.</b>}
      </p>

      {/* ── 권한표(메뉴 × 역할) ── */}
      <details className="sysm-box" open={sp.mx === "1"}>
        <summary className="usb2-h2">권한표(메뉴 × 역할) — 화면설계서 사용자 권한 구분 기준</summary>
        <table className="us-tbl sysm-tbl">
          <thead><tr><th>메뉴</th>{ALL_ROLES.map((r) => <th key={r} title={USER_KIND[r]}>{SHORT[r].split("\n").map((x, i) => <div key={i}>{x}</div>)}</th>)}<th>근거</th></tr></thead>
          <tbody>
            {MATRIX.map((m) => (
              <tr key={m.menu}>
                <td>{m.menu}</td>
                {ALL_ROLES.map((r) => <td key={r} className="c">{canAccess(r, m.path) ? <span className="sysm-ok">○</span> : <span className="sysm-no">✕</span>}</td>)}
                <td className="us-muted">{m.basis}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="us-muted sysm-note">사용자 유형: 경영책임자 = 경영책임자 · 중대재해 담당부서 = 총괄 · 사업소, 실/국 = 관리자 · 사업장, 부서 = 부서장·실무자. {MATRIX_NOTE}
          막는 규칙 {RULES.length}개.</p>
      </details>

      {/* ── 메뉴 설정 ── */}
      <form action={saveMenu}>
        <input type="hidden" name="role" value={role} /><input type="hidden" name="pv" value={pv} />
        {US_GROUPS.map((g, gi) => {
          const gk = gKey(g.label);
          const gs = set.groups?.[gk] || {};
          return (
            <section key={gk} className="sysm-grp">
              <div className="sysm-grp-h">
                <label>묶음 <b>{gk}</b></label>
                <label>표시 이름 <input type="text" name={`g${gi}_label`} defaultValue={gs.label || ""} placeholder={gk} /></label>
                <label>순서 <input type="number" name={`g${gi}_order`} defaultValue={gs.order ?? (gi + 1) * 10} className="sysm-num" /></label>
                {gk !== LOCKED_GROUP
                  ? <label className="sysm-chk"><input type="checkbox" name={`g${gi}_hide`} value="Y" defaultChecked={!!gs.hide} /> 묶음 숨김</label>
                  : <span className="us-muted">숨길 수 없음(시스템 관리)</span>}
              </div>
              <table className="us-tbl sysm-tbl">
                <thead>
                  <tr><th>기본 이름</th><th>표시 이름</th><th>순서</th><th>숨김</th>
                    {ALL_ROLES.map((r) => <th key={r} title={`${ROLE_LABEL[r]} — 체크 = 보임`}>{SHORT[r].split("\n").map((x, i) => <div key={i}>{x}</div>)}</th>)}</tr>
                </thead>
                <tbody>
                  {g.items.map((m, ii) => {
                    const p = `i${gi}_${ii}`;
                    const it = set.items?.[iKey(g.label, m)] || {};
                    const lock = isLocked(m.href);
                    const seen = m.heading || lock ? [] : ALL_ROLES.filter((r) => canAccess(r, m.href));
                    return (
                      <tr key={p} className={m.heading ? "sysm-head" : ""}>
                        <td>{m.heading ? <b>▸ {m.label}</b> : m.label}{!m.heading && <div className="us-muted sysm-href">{m.href}</div>}
                          {seen.length > 0 && <input type="hidden" name={`${p}_seen`} value={`|${seen.join("|")}|`} />}</td>
                        <td><input type="text" name={`${p}_label`} defaultValue={it.label || ""} placeholder={m.label} /></td>
                        <td><input type="number" name={`${p}_order`} defaultValue={it.order ?? (ii + 1) * 10} className="sysm-num" /></td>
                        <td className="c">{lock ? <span className="us-muted" title="숨길 수 없음">–</span>
                          : <input type="checkbox" name={`${p}_hide`} value="Y" defaultChecked={!!it.hide} aria-label="숨김" />}</td>
                        {ALL_ROLES.map((r) => (
                          <td key={r} className="c">
                            {m.heading ? "" : lock || !canAccess(r, m.href)
                              ? <span className="us-muted" title={canAccess(r, m.href) ? "숨길 수 없음" : "권한표상 볼 수 없음"}>{canAccess(r, m.href) ? "○" : "–"}</span>
                              : <input type="checkbox" name={`${p}_r`} value={r} defaultChecked={!(it.off || []).includes(r)} aria-label={`${ROLE_LABEL[r]} 보임`} />}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          );
        })}
        <div className="sysm-bar">
          <button className="us-btn" type="submit">저장</button>
        </div>
      </form>
      <form action={resetMenu} className="sysm-bar">
        <input type="hidden" name="role" value={role} />
        <button className="usb2-obtn" type="submit">기본값으로 되돌리기</button>
        <span className="us-muted">이름 · 순서 · 숨김 · 역할별 노출을 모두 처음 정의대로 돌립니다(바꾼 기록은 남습니다).</span>
      </form>

      {/* ── 역할별 미리보기 ── */}
      <section className="sysm-box">
        <h2 className="usb2-h2">역할별 머리 메뉴 미리보기</h2>
        <div className="sysm-pv-pick">
          {ALL_ROLES.map((r) => (
            <Link key={r} href={`/admin/system/menu?pv=${r}`} className={`usb2-obtn${r === pv ? " sysm-on" : ""}`}>{ROLE_LABEL[r]}</Link>
          ))}
        </div>
        <div className="sysm-pv">
          {preview.map((g) => (
            <div key={g.label} className="sysm-pv-g">
              <div className="sysm-pv-h">{g.label.replace(/\n/g, "")}</div>
              {g.items.map((m, i) => m.heading
                ? <div key={"h" + i} className="sysm-pv-sub">{m.label}</div>
                : <div key={m.href} className="sysm-pv-i">{m.label}</div>)}
            </div>
          ))}
        </div>
      </section>
    </UsLayout>
  );
}
