/** 선임·지정 7항목 — 근거 법령과 시행령 제4조의 어느 호에 닿는지. */
export const ORG_ITEMS = [
  { item: "안전보건관리규정",   short: "관리규정",   scope: "기관", verb: "제정", law: "산업안전보건법 제25조", clause: "" },
  { item: "안전보건관리책임자", short: "관리책임자", scope: "기관", verb: "지정", law: "산업안전보건법 제15조", clause: "5" },
  { item: "안전관리자",         short: "안전관리자", scope: "부서", verb: "선임", law: "산업안전보건법 제17조", clause: "6" },
  { item: "보건관리자",         short: "보건관리자", scope: "부서", verb: "선임", law: "산업안전보건법 제18조", clause: "6" },
  { item: "산업보건의",         short: "산업보건의", scope: "기관", verb: "위촉", law: "산업안전보건법 제22조", clause: "6" },
  { item: "산업안전보건위원회", short: "위원회",     scope: "기관", verb: "구성", law: "산업안전보건법 제24조", clause: "7" },
  { item: "관리감독자",         short: "관리감독자", scope: "부서", verb: "지정", law: "산업안전보건법 제16조", clause: "5" },
] as const;
