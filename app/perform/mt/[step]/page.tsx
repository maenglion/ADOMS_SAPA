// [400 · 교육자료 버전] SCR-075~087 의무이행(실적증빙) — 원료·제조물(중대시민재해) 6단계
//   staff SCR-075·076 · budget SCR-077·078·079 · proc SCR-080·081 · recur SCR-082·083 · order SCR-084·085 · law SCR-086·087
// 본문 = PageHead(「법 의무이행 조치」 + 사업장명 – 해당년도) + 명세의 인라인 입력 표(저장 → use_record) + 이미지 뷰어 + 증빙자료 예시 + 단계 이동.
import { notFound } from "next/navigation";
import { UsLayout, Side, PageHead, StepNav } from "@/components/us/Parts";
import { STEPS, type TrackKey } from "@/lib/us/tracks";
import { recsOf, sites, pickSite, plansOf, docPlans, people, budgetPlan, mDuties, YEAR } from "../model";
import type { View } from "../_ui/parts";
import { StaffStep, BudgetStep, ProcStep, RecurStep, OrderStep } from "../_ui/steps";
import { LawStep } from "../_ui/law";
import { ClauseSummary } from "../../_merge";   // 09-26 사용자: 메뉴 밖 화면 합치기 — 체계 수립 호별 현황

export const dynamic = "force-dynamic";

/** 하단 단계 이동 — 명세 이미지의 문구(단계마다 조금씩 다르다). 「목록으로」는 법 의무사항(원료·제조물).
 *  09-25 사용자: 명세 원문 오기는 고친다 — 「예산·편성·집행」→「예산 편성·집행」 · 「안전·보건·목표 및 안전인력 확보」→「안전인력 확보」 ·
 *  「개선-시정사항」→「개선·시정 사항」 · 「관계법령 의무이행 조치」→ 단계 제목 「관계 법령 의무이행 조치」. */
const NAV: Record<string, { prev: [string, string]; next: [string, string] }> = {
  staff: { prev: ["목록으로", "@list"], next: ["2단계 : 중대시민재해 예방 예산 편성·집행", "budget"] },
  budget: { prev: ["1단계 : 안전인력 확보", "staff"], next: ["3단계 : 재해예방업무처리 절차 마련·이행", "proc"] },
  proc: { prev: ["2단계 : 중대시민재해 예방 예산 편성·집행", "budget"], next: ["4단계 : 재해 발생시 재발방지대책 수립 및 이행", "recur"] },
  recur: { prev: ["3단계 : 재해예방업무처리 절차 마련·이행", "proc"], next: ["5단계 : 중앙행정기관, 지자체 개선·시정 사항 이행", "order"] },
  order: { prev: ["4단계 : 재해 발생시 재발방지대책 수립 및 이행", "recur"], next: ["6단계 : 관계 법령 의무이행 조치", "law"] },
  law: { prev: ["5단계 : 중앙행정기관, 지자체 개선·시정 사항 이행", "order"], next: ["목록으로", "@list"] },
};

export default async function PerformMtStep({ params, searchParams }: {
  params: Promise<{ step: string }>; searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { step } = await params;
  const raw = await searchParams;
  const sp: Record<string, string> = Object.fromEntries(Object.entries(raw).filter(([, x]) => x != null).map(([k, x]) => [k, String(x)]));
  const st = STEPS.mt.find((s) => s.key === step);
  if (!st) notFound();

  const role = sp.role || "gm";
  const list = await sites();
  const site = pickSite(list, sp.site, role);
  const base = `/perform/mt/${step}?role=${role}&site=${site.site_id}`;
  const v: View = { role, site, step, sites: list, sp, href: (extra = "") => `${base}${extra}` };
  const href = (t: TrackKey, s?: string) =>
    t === "mt" ? `/perform/mt/${s || STEPS.mt[0].key}?role=${role}&site=${site.site_id}` : `/perform/${t}${s ? `/${s}` : ""}?role=${role}`;
  const go = (k: string) => (k === "@list" ? `/law/mt?role=${role}` : `/perform/mt/${k}?role=${role}&site=${site.site_id}`);
  const nav = NAV[step];

  const recs = await recsOf(site.site_id, step);
  // 명세: 1~3단계 머리는 「사업장명 – 해당년도」, ②~④는 「사업장명 : 부서명 – 해당년도」
  const meta = st.group === 1
    ? `${site.site_name} – 해당년도 : ${YEAR}년`
    : `${site.site_name} : ${site.dept_name} – 해당년도 : ${YEAR}년`;

  let body: React.ReactNode = null;
  if (step === "staff") body = <StaffStep v={v} recs={recs} people={await people()} plans={await plansOf(site.site_id, "staff", "row")} />;
  if (step === "budget") body = <BudgetStep v={v} recs={recs} plan={await budgetPlan(site.dept_id)} />;
  if (step === "proc") {
    body = <ProcStep v={v} recs={recs} plans={await plansOf(site.site_id, "proc", "row")} docs={await docPlans(site.site_id)} />;
  }
  if (step === "recur") body = <RecurStep v={v} recs={recs} />;
  if (step === "order") body = <OrderStep v={v} recs={recs} />;
  if (step === "law") body = <LawStep v={v} recs={recs} all={await mDuties()} />;

  return (
    <UsLayout side={<Side panel="의무사항(실적증빙)" track="mt" step={step} href={href} />}>
      <PageHead
        sub="법 의무이행 조치" title={st.title} meta={meta}
        right={
          <form method="get" className="use-sitepick">
            <input type="hidden" name="role" value={role} />
            <label>사업장
              <select name="site" defaultValue={site.site_id}>
                {list.map((s) => <option key={s.site_id} value={s.site_id}>{s.site_name} ({s.dept_name})</option>)}
              </select>
            </label>
            <button className="us-btn-s">보기</button>
          </form>
        }
      />
      {/* 09-26 사용자: 메뉴 밖 화면 합치기 — 첫 화면에 체계 수립의 「호별 현황」 요약(해당 여부 판단 · 반기 점검은 전체 보기에서) */}
      {step === STEPS.mt[0].key && <ClauseSummary track="mt" role={role} stepHref={(k) => `/perform/mt/${k}?role=${role}&site=${site.site_id}`} />}
      {body}
      <StepNav prev={{ href: go(nav.prev[1]), label: nav.prev[0] }} next={{ href: go(nav.next[1]), label: nav.next[0] }} />
    </UsLayout>
  );
}
