// [400 · 교육자료 버전] SCR-057~074 의무이행(실적증빙) — 공중이용시설·공중교통수단 트랙 8단계(묶음 D)
//   staff SCR-057·058 · budget SCR-059 · inspect SCR-060 · plan SCR-061·062 · proc SCR-063~065
//   recur SCR-066·067 · order SCR-068·069 · law SCR-070~074
// 좌측 = Side(의무사항(실적증빙)) · 본문 = PageHead(우상단 대상 셀렉터) + 입력 표(저장 = usd_record) + 뷰어 + 증빙자료 예시 + 단계 이동
import { notFound } from "next/navigation";
import { UsLayout, Side, PageHead, StepNav } from "@/components/us/Parts";
import { STEPS, type TrackKey } from "@/lib/us/tracks";
import { depts, type Row } from "@/lib/data";
import { records, targetOptions, pickTarget, BASE, YEAR } from "../_lib/model";
import { makeHref, Msg, type Ctx } from "../_parts/ui";
import { TargetSelect, type Opt } from "../_parts/client";
import { StaffScreen, BudgetScreen, InspectScreen, PlanScreen } from "../_parts/s1";
import { ProcScreen, RecurScreen, OrderScreen } from "../_parts/s2";
import { LawScreen } from "../_parts/s3";
import { Modals } from "../_parts/modals";
import { ClauseSummary, RecordLink, FC_REC_STEP, FC_REC_WHAT, recNoOf } from "../../_merge";   // 09-26 사용자: 메뉴 밖 화면 합치기 — 체계 수립·기록

export const dynamic = "force-dynamic";

/**
 * 하단 단계 이동 글자 — 명세 화면마다 적힌 원문(띄어쓰기 포함).
 * 명세에 적혀 있지 않은 곳(1~3단계)은 같은 모양으로 만들었다.
 * 09-25 사용자: 명세 원문 오기는 고친다 — 「지자채」→「지자체」 · 「개선-시정사항」→「개선·시정 사항」 ·
 *   SCR-066 이전 단계 라벨(현재 화면 제목과 같던 것)→ 5단계 제목 · 「관계법령 의무이행 조치」→ 단계 제목 「관계 법령 의무이행 조치」.
 */
const NAV: Record<string, { prev?: string; next?: string }> = {
  staff: { next: "2단계 : 안전예산 편성·집행" },
  budget: { prev: "1단계 : 안전인력 확보", next: "3단계 : 안전점검 계획 수립·수행" },
  inspect: { prev: "2단계 : 안전예산 편성·집행", next: "4단계 : 안전계획 수립·이행 수행" },
  plan: { prev: "3단계 : 안전점검 계획 수립·수행", next: "5단계 : 재해예방업무처리 절차 마련·이행" },   // 09-26 사용자: 「n단계 :」 하나로
  proc: { prev: "4단계 : 안전계획 수립·이행 수행", next: "6단계 : 재해 발생시 재발방지대책 수립 및 이행" },
  // 명세 SCR-066 이전 단계 라벨은 현재 화면 제목과 같았다(원문 오기, 부록 B-5) — 09-25 사용자: 고친다. 링크는 5단계로 간다
  recur: { prev: "5단계 : 재해예방업무처리 절차 마련·이행", next: "7단계 : 중앙행정기관, 지자체 개선·시정 사항 이행" },
  order: { prev: "6단계 : 재해 발생시 재발방지대책 수립 및 이행", next: "8단계 : 관계 법령 의무이행 조치" },
  law: { prev: "7단계 : 중앙행정기관, 지자체 개선·시정 사항 이행", next: "목록으로" },
};
/** 제목 위 「법 의무이행 조치」와 부제가 있는 화면(명세 SCR-063·066·068·070). */
const WITH_SUB = new Set(["proc", "recur", "order", "law"]);

export default async function FcStepPage({ params, searchParams }: {
  params: Promise<{ step: string }>; searchParams: Promise<Record<string, string>>;
}) {
  const { step } = await params;
  const sp = await searchParams;
  const steps = STEPS.fc;
  const st = steps.find((s) => s.key === step);
  if (!st) notFound();

  const role = sp.role || "gm";
  const recs = await records();
  const seeded = new Set(recs.map((r) => r.scope));
  const { list, all } = await targetOptions(role, seeded);
  const t = pickTarget(list, all, role, sp.t);
  const dn = new Map((await depts()).map((d: Row) => [d.dept_id, d.dept_name]));

  const side = (
    <Side panel="의무사항(실적증빙)" track="fc" step={step}
      href={(tk: TrackKey, s?: string) => tk === "fc" ? `${BASE}/${s || steps[0].key}${t ? `?t=${encodeURIComponent(t.id)}` : ""}` : `/perform/${tk}${s ? `/${s}` : ""}`} />
  );
  if (!t) {
    return (
      <UsLayout side={side}>
        <PageHead title={st.title} />
        <p className="usd-note">이 역할에 지정된 공중이용시설·공중교통수단이 없습니다. 관리대상 현황에서 담당 대상을 먼저 지정하세요.</p>
      </UsLayout>
    );
  }

  const spT = { ...sp, t: t.id };
  const href = makeHref(step, spT);
  // 저장 뒤 돌아올 주소 — 팝업(modal·rid)·알림·뷰어 값은 원래 이어받지 않고, 팝업 검색 칸(lk·ln·lq)도 뺀다
  const backClean = href({ lk: undefined, ln: undefined, lq: undefined });
  const ctx: Ctx = {
    role, step, t, dept: t.dept_id, deptName: dn.get(t.dept_id) || t.dept_name, recs, sp: spT,
    nonce: String(Date.now()), list, all, peers: all.filter((x) => x.dept_id === t.dept_id).length,
    href, back: backClean,
  };

  const opts: Opt[] = list.map((x) => ({ id: x.id, group: x.group, text: `${x.name}${x.kind ? ` · ${x.kind}` : ""}${x.cls ? ` ${x.cls}` : ""}` }));
  if (!opts.find((o) => o.id === t.id)) opts.unshift({ id: t.id, group: t.group, text: t.name });
  const selector = <TargetSelect hrefBase={href({ t: undefined, pa: undefined, pb: undefined, t2: undefined, vu: undefined, vn: undefined })} value={t.id} options={opts} />;

  const meta = step === "proc"
    ? `${t.name} – 해당년도 : ${YEAR}년`
    : `${t.name} : ${ctx.deptName} – 해당년도 : ${YEAR}년`;

  const nav = NAV[step] || {};
  const i = steps.findIndex((s) => s.key === step);
  const prevStep = steps[i - 1], nextStep = steps[i + 1];
  const keepT = `?t=${encodeURIComponent(t.id)}`;
  const recNo = recNoOf(FC_REC_STEP, step);   // 09-26 사용자: 메뉴 밖 화면 합치기 — 이 단계와 같은 호의 체계 기록

  let body: React.ReactNode = null;
  if (step === "staff") body = <StaffScreen ctx={ctx} />;
  else if (step === "budget") body = <BudgetScreen ctx={ctx} />;
  else if (step === "inspect") body = <InspectScreen ctx={ctx} opts={opts} />;
  else if (step === "plan") body = <PlanScreen ctx={ctx} />;
  else if (step === "proc") body = <ProcScreen ctx={ctx} />;
  else if (step === "recur") body = <RecurScreen ctx={ctx} />;
  else if (step === "order") body = <OrderScreen ctx={ctx} />;
  else if (step === "law") body = <LawScreen ctx={ctx} />;

  return (
    <UsLayout side={side}>
      <div className="usd-page" id="top">
        <PageHead
          sub={WITH_SUB.has(step) ? "법 의무이행 조치" : undefined}
          title={st.title}
          meta={WITH_SUB.has(step) ? meta : undefined}
          right={selector}
        />
        <Msg ctx={ctx} />
        {/* 09-26 사용자: 메뉴 밖 화면 합치기 — 첫 화면에 체계 수립의 「호별 현황」 요약 · 같은 호의 체계 기록(/system/civil)으로 가는 줄 */}
        {i === 0 && <ClauseSummary track="fc" role={role} stepHref={(k) => `${BASE}/${k}${keepT}`} />}
        {recNo > 0 && <RecordLink href={`/system/civil?clause=${recNo}&role=${role}`} clause={`시행령 제10조제${recNo}호`} what={FC_REC_WHAT[recNo]} />}
        {body}
        <StepNav
          prev={prevStep && nav.prev ? { href: `${BASE}/${prevStep.key}${keepT}`, label: nav.prev } : null}
          next={nextStep && nav.next ? { href: `${BASE}/${nextStep.key}${keepT}`, label: nav.next }
            : nav.next === "목록으로" ? { href: `${BASE}/${steps[0].key}${keepT}`, label: "목록으로" } : null}
        />
        <Modals ctx={ctx} />
      </div>
    </UsLayout>
  );
}
