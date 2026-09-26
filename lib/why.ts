/**
 * 설명 경로를 만드는 곳 — 어느 화면이든 같은 기준으로 고리를 매긴다. (2026-09-21)
 *
 * 고리마다 세 등급 중 하나를 준다. 기준을 여기 한 곳에만 둔다(T10 — 같은 분류를 두 곳에 두면 갈라진다).
 *   fact  — 법령 원문. 법제처에서 받은 그대로.
 *   rule  — 정한 규칙으로 붙였다.
 *   check — 규칙에 안 걸려 추정했거나, 해당 여부를 아직 모른다.
 */
import type { Step, Strength } from "@/components/WhyPath";
import { secureAxisOrUnset } from "./axes";
import { duty36Label } from "./duty36";
import { cleanBasis } from "./labels";

type Row = Record<string, any>;

/** 판단 칸의 확신도 — 배지·근거 문구에 「추론」「확인」이 있으면 사람이 봐야 한다. */
function judged(text: string | undefined, fallback: Strength = "rule"): Strength {
  const t = text || "";
  if (/추론|추정|확인 전|확인필요|확인 필요|잠정|자동 판단/.test(t)) return "check";
  return fallback;
}

const LAYER_KO: Record<string, string> = {
  act: "법률", presidential_decree: "대통령령", ministerial_ordinance: "부령", notice: "고시",
};

export function buildWhy(opts: {
  duty: Row;
  asset?: Row | null;
  mapping?: Row | null;       // asset_target_map 한 줄
  assignment?: Row | null;    // duty_assignment 한 줄
  role?: string;
}): Step[] {
  const { duty: d, asset, mapping, assignment, role = "gm" } = opts;
  const steps: Step[] = [];

  // ① 기관 — 중대재해처벌법의 수범 주체인가
  const cond = d.yongin_mark === "조건부";
  steps.push({
    label: "기관",
    value: "용인특례시",
    sub: "경영책임자 = 시장",
    basis: "지방자치단체의 장은 중대재해처벌법의 「경영책임자등」이다(법 제2조제9호나목). "
      + (cond ? "다만 이 의무는 조건부라, 해당 시설·물질을 실제로 보유·관리할 때만 걸린다."
              : "이 의무는 용인시에 해당하는 것으로 판단됐다."),
    strength: cond ? "check" : "rule",
  });

  // ② 자산 — 어느 시설 때문인가(자산에서 들어온 경우만)
  if (asset) {
    const conf = (mapping?.confidence || "").toLowerCase();
    steps.push({
      label: "자산",
      value: asset.asset_name,
      sub: `${asset.asset_gbn || ""} · ${asset.asset_kind || ""}${asset.asset_class ? " · " + asset.asset_class : ""}`,
      basis: `이 시설은 관리대상 「${d.target_name}」에 속한다 — 근거: ${mapping?.basis || "시설 분류 규칙"}`
        + (conf ? ` (확신도 ${conf === "high" ? "높음" : conf === "medium" ? "보통" : "낮음"})` : ""),
      strength: conf === "low" ? "check" : "rule",
      href: `/targets/${asset.asset_id}?role=${role}`,
    });
  }

  // ③ 관리대상 — 법이 관리하라고 지목한 종류
  const common = d.target_code === "TG24";
  steps.push({
    label: "관리대상",
    value: d.target_name || d.target_code,
    basis: common
      ? "특정 시설이 아니라 기관 전체에 걸리는 의무다."
      : `이 관리대상을 규율하는 법령이 「${d.law}」이다.`,
    strength: judged(d.badge?.includes("관리대상") ? d.badge : "", "rule"),
    href: `/duties/list?role=${role}&target=${d.target_code}`,
  });

  // ④ 법령 — 법률 · 하위법령
  const layer = LAYER_KO[d.layer] || d.layer || "";
  steps.push({
    label: "법령",
    value: d.law,
    sub: d.doc && d.doc !== d.law ? `${d.doc} (${layer})` : layer,
    basis: d.doc && d.doc !== d.law
      ? `「${d.law}」이 위임한 ${layer} 「${d.doc}」에 이 조문이 있다.`
      : `이 법 안의 조문이다.`,
    strength: "fact",
    href: `/duties/tree?role=${role}&law=${encodeURIComponent(d.law || "")}`,
  });

  // ⑤ 조문 — 원문(사실)
  steps.push({
    label: "조문",
    value: `${d.unit_label_ko || ""}${d.article_title ? " 「" + d.article_title + "」" : ""}`,
    quote: (d.source_text || "").slice(0, 320) + ((d.source_text || "").length > 320 ? "…" : ""),
    basis: "법제처 법령 원문 그대로다.",
    strength: "fact",
  });

  // ⑥ 의무 판정 — 이 조문이 「해야 한다」인가, 누가 해야 하는가
  const subj = d.duty_subject || "";
  const subjOk = !subj || /지방자치단체|시장|관리주체|관리청|재난관리책임기관|사업주|발주자|경영책임자|기관의 장/.test(subj);
  steps.push({
    label: "의무 판정",
    value: d.verdict === "obligation" ? "의무" : d.verdict || "-",
    sub: subj ? `수범 주체: ${subj}` : undefined,
    basis: subjOk
      ? "조문의 술어가 「~하여야 한다」류라 의무로 판정했다."
      : `조문의 수범 주체가 「${subj}」이다. 용인시(기관)가 직접 지는 의무인지, `
        + "소속 직원·파견자 등 개인이 지는 의무인지 확인이 필요하다.",
    strength: subjOk ? judged(d.review_status) : "check",
  });

  // ⑦ 분류 — 중처법 의무조항 36 · 확보의무
  const basis = cleanBasis(d.assign_basis);
  steps.push({
    label: "분류",
    value: `${d.code36} ${d.code36_name}`,
    sub: duty36Label(d.code36) || secureAxisOrUnset(d.code36),
    basis: basis ? `배정 근거: ${basis}` : "배정 근거가 기록되지 않았다.",
    strength: basis ? judged(basis) : "check",
    href: `/duties/list?role=${role}&code=${d.code36}`,
  });

  // ⑧ 해당 여부 — 실제로 우리 업무인가
  if (assignment) {
    const app = assignment.applicability || "";
    steps.push({
      label: "해당 여부",
      value: app || "-",
      sub: assignment.scope ? `범위: ${assignment.scope}` : undefined,
      basis: (assignment.applicability_note || (app === "해당" ? "해당하는 것으로 확인됐다." : ""))
        + (assignment.decided_at ? ` (담당 부서 확인 ${assignment.decided_at})` : ""),
      // 사람이 확인해 닫은 것(해당·비해당)은 규칙 수준, 아직 열려 있으면 확인 필요
      strength: app === "해당" || (app === "비해당" && assignment.decided_at) ? "rule" : "check",
    });
  }

  return steps;
}
