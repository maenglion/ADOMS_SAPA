/**
 * [400 · 교육자료 버전] 묶음 A — 이행현황 좌측 메뉴(명세 02 공통 전제).
 * 연녹색 둥근 판 안에 진녹색 머리 3개: 중대산업재해 › 사업장 / 중대시민재해 › 공중이용시설·공중교통수단 · 원료·제조물 / 도급·용역·위탁 › 도급·용역·위탁.
 * 지금 보는 항목 앞에 ◉.
 */
import GroupSide from "@/components/us/GroupSide";

// 09-26 사용자: 메뉴 밖 화면 합치기 — 처리 현황(tasks) · 연간 일정(cal) 을 「메인」 판에 올림(머리 메뉴 이행현황과 같은 순서)
export type SideKey = "main" | "tasks" | "cal" | "ws" | "fc" | "mt" | "ct";

// 09-25 사용자: 의무이행 좌측과 같은 모양 · 같은 꺽쇠(접었다 펴기) — 공용 GroupSide
export default function StatusSide({ on, role, className }: { on: SideKey; role: string; className?: string }) {
  const r = `role=${role}`;
  return (
    <GroupSide className={className} groups={[
      // 09-25 사용자: 머리 메뉴 「이행현황」의 첫 항목 「메인(대시보드)」도 좌측에
      { head: "메인", items: [
        // 09-26 사용자: 좌측 「메인」 밑 이름을 「메인(대시보드)」 → 「대시보드」로(머리 메뉴도 같게)
        { href: `/?${r}`, label: "대시보드", on: on === "main" },
        // 09-26 사용자: 메뉴 밖 화면 합치기 — 처리 현황 · 연간 일정
        { href: `/tasks?${r}`, label: "처리 현황(내 할 일)", on: on === "tasks" },
        { href: `/calendar?${r}`, label: "연간 일정", on: on === "cal" },
      ] },
      { head: "중대산업재해", items: [{ href: `/status/industrial?${r}`, label: "사업장", on: on === "ws" }] },
      { head: "중대시민재해", items: [
        { href: `/status/civil?t=fc&${r}`, label: "공중이용시설·공중교통수단", on: on === "fc" },
        { href: `/status/civil?t=mt&${r}`, label: "원료·제조물", on: on === "mt" },
      ] },
      { head: "도급·용역·위탁", items: [{ href: `/status/contract?${r}`, label: "도급·용역·위탁", on: on === "ct" }] },
    ]} />
  );
}
