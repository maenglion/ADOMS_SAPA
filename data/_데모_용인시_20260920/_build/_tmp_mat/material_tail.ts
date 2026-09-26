export async function materialStatus(role = "gm") {
  const q = (href: string) => `${href}${href.includes("?") ? "&" : "?"}role=${role}`;
  const year = new Date().toISOString().slice(0, 4);
  const deptName = new Map<string, string>((await depts()).map((d: any) => [d.dept_id, d.dept_name]));
  const staffName = new Map<string, string>((await staff()).map((x: any) => [x.staff_id, x.display_name]));
  const who = (id?: string) => (id ? staffName.get(id) || id : "");
  const assetList = await assets({ limit: 100000 });
  const water = assetList.filter((a: any) => a.asset_kind === "지방상수도").length;

  const allT = await tasks({ limit: 100000 });
  const mT = allT.filter((t) => firstCode(t).startsWith("M") && yearOf(t.due_date) === year);
  const mByDept = new Map<string, number>();
  mT.forEach((t) => mByDept.set(t.dept_id, (mByDept.get(t.dept_id) || 0) + 1));
  const mDeptText = [...mByDept.entries()].sort((a, b) => b[1] - a[1]).map(([d, n]) => `${deptName.get(d) || d} ${n}`).join(" · ");
  const mCode = (c: string) => mT.filter((t) => firstCode(t) === c);

  const batches = (await batchList()).filter((b) => String(b.period_year) === year);
  const mBatch = (code: string) => batches.filter((b) => splitList(b.code36_list).includes(code));
  const NOTICE = "「원료 및 제조물로 인한 중대시민재해 예방에 필요한 인력 및 예산 편성 지침」(기후에너지환경부 고시 제2025-165호)";
  const GATE = "원료·제조물 해당 여부가 판단되지 않았습니다 — 해당으로 판단되면 이 항목을 갖춥니다.";
  const taskNote = (c: string, name: string) => {
    const ts = mCode(c);
    return ts.length ? ` 관계 법령 쪽 「${name}」 과제 ${ts.length}건은 이미 배정돼 있습니다(완료 ${ts.filter(done).length}).` : "";
  };
  const m08 = mBatch("M08");
  const m09 = mBatch("M09");

  /* ── 원료·제조물 대장(material_item, 2026-09-22) — 판단은 사람이 정한 것만 센다. 행위에서 나온 제안은 판정에 쓰지 않는다 ── */
  const items = (await readTable("material_item", "item_id"))
    .filter((r: any, i: number, a: any[]) => a.findIndex((x: any) => x.item_id === r.item_id) === i);
  const yes = items.filter((r: any) => r.verdict === "해당");
  const no = items.filter((r: any) => r.verdict === "비해당");
  const pending = items.filter((r: any) => r.verdict !== "해당" && r.verdict !== "비해당");
  const ceoWait = [...yes, ...no].filter((r: any) => !r.ceo_confirmed_at);
  const anyYes = yes.length > 0;
  /** 해당 없음 — 품목이 있고 모두 사람이 「비해당」으로 정했을 때만(판단 전 품목이 남으면 아니다). */
  const allNo = items.length > 0 && no.length === items.length;
  const b5Yes = yes.filter((r: any) => b5State(r.byeolpyo5) === "yes");
  const b5Unk = yes.filter((r: any) => b5State(r.byeolpyo5) === "unk");
  const nameList = (rs: any[]) => rs.map((r: any) => r.item_name).join(" · ");
  const pendNote = pending.length ? ` 판단 전 품목 ${pending.length}개(${nameList(pending)})가 남아 있어 더 늘 수 있습니다.` : "";
  const matHref = q("/system?area=M#mat");
  const NA_BASIS = `해당 없음 — 대장의 품목 ${items.length}개를 모두 「비해당」으로 판단했습니다(사유 ${no.filter((r: any) => String(r.reason || "").trim()).length}건).`;
  const naCheck = (label: string): Check => ({ label, st: "unk", basis: NA_BASIS });

  const itemCheck = (r: any): Check => {
    const sug = suggest(splitSemi(r.acts));
    const acts = splitSemi(r.acts).map((a) => ACT_LABEL[a] || a).join(" · ") || "행위 미선택";
    const dept = deptName.get(r.dept_id) || r.dept_id || "부서 미정";
    if (r.verdict === "해당" || r.verdict === "비해당") {
      const ceo = r.ceo_confirmed_at ? ` · 경영책임자 확인 ${r.ceo_confirmed_at}${r.ceo_proxy === "Y" ? "(총괄 대리 기록)" : ""}` : " · 경영책임자 확인 대기";
      return {
        label: `${r.item_name}(${dept}) — ${r.verdict}`, st: "ok",
        basis: `${acts} · 사유: ${r.reason} · 근거: ${r.basis_ref || "—"} · 판단 ${who(r.judged_by)} ${r.judged_at || ""}${ceo}`,
        ...(r.ceo_confirmed_at ? {} : { fix: "경영책임자 확인을 받습니다.", href: matHref, hrefLabel: "원료·제조물 대장" }),
      };
    }
    return {
      label: `${r.item_name}(${dept}) — 확인 필요`, st: "unk",
      basis: `${acts} · 제안: ${sug.tag} · ${r.reason || "사유 없음"}`,
    };
  };

  /** 해당 품목의 담당 부서 과제로 센다 — 없음 · 일부 · 갖춰짐. */
  const yesDepts = new Set(yes.map((r: any) => r.dept_id));
  const taskCheck = (label: string, code: string, name: string, fix: string): Check => {
    const ts = mCode(code).filter((t) => yesDepts.has(t.dept_id));
    const d = ts.filter(done).length;
    if (!ts.length) return { label, st: "none", basis: `해당 품목 부서에 「${name}」 과제가 없습니다.`, fix, href: q("/tasks"), hrefLabel: "과제" };
    if (d === ts.length) return { label, st: "ok", basis: `해당 품목 부서 「${name}」 과제 ${ts.length}건 모두 완료` };
    return { label, st: d ? "part" : "none", basis: `해당 품목 부서 「${name}」 과제 ${ts.length}건 중 완료 ${d}`, fix, href: q("/tasks"), hrefLabel: "과제" };
  };

  // 제1호 인력 — 해당 품목마다 담당 부서·담당자가 정해졌는가
  const staffed = yes.filter((r: any) => r.dept_id && r.owner_staff_id);
  const staffCheck: Check = !staffed.length
    ? { label: "해당 품목 담당자 지정", st: "none", basis: `해당 품목 ${yes.length}개에 담당자가 없습니다.`, fix: "품목마다 담당 부서와 담당자를 정합니다.", href: matHref, hrefLabel: "원료·제조물 대장" }
    : staffed.length < yes.length
      ? { label: "해당 품목 담당자 지정", st: "part", basis: `해당 품목 ${yes.length}개 중 ${staffed.length}개 담당자 지정 · 빠짐: ${nameList(yes.filter((r: any) => !r.owner_staff_id))}`, fix: "빠진 품목의 담당자를 정합니다.", href: matHref, hrefLabel: "원료·제조물 대장" }
      : { label: "해당 품목 담당자 지정", st: "ok", basis: yes.map((r: any) => `${r.item_name} — ${deptName.get(r.dept_id) || r.dept_id} ${who(r.owner_staff_id)}`).join(" · ") };

  // 제2호 예산 — 예산 화면에서 재해 구분을 「원료·제조물(M)」로 고른 올해 줄
  const buds = (await readTable("safety_budget", "budget_id")).filter((b: any) => String(b.fiscal_year) === year && String(b.area || "").trim() === "M");
  const plan = buds.reduce((a: number, b: any) => a + (Number(b.planned_amount) || 0), 0);
  const exec = buds.reduce((a: number, b: any) => a + (Number(b.executed_amount) || 0), 0);
  const budCheck: Check = !buds.length
    ? { label: "원료·제조물 몫 예산", st: "none", basis: `${year}년 예산에 재해 구분 「원료·제조물」 줄이 없습니다.`, fix: "예산 화면에서 원료·제조물 몫을 편성하고 재해 구분을 고릅니다.", href: q("/budget"), hrefLabel: "예산" }
    : { label: "원료·제조물 몫 예산", st: exec > 0 ? "ok" : "part", basis: `${year}년 ${buds.length}줄 · 편성 ${plan.toLocaleString()}원 · 집행 ${exec.toLocaleString()}원`, ...(exec > 0 ? {} : { fix: "편성한 예산을 집행하고 집행액을 적습니다.", href: q("/budget"), hrefLabel: "예산" }) };

  // 제5호 반기 점검 — 체계 기록(system_record)의 원료·제조물 제5호 줄(clause_no M8-5)
  const m5recs = (await readTable("system_record", "record_id")).filter((r: any) => r.clause_no === "M8-5")
    .map((r: any): HalfRec => ({ date: r.done_at, reported: r.ceo_reported === "Y", open: Boolean(r.action_needed) && !r.action_done_at }));
  const halfBatch = (bs: Row[], code: string, name: string): Check => bs.length
    ? { label: `${year}년 점검 회차(${name})`, st: "ok", basis: `${bs.map((b) => idKo(b.batch_id)).join(" · ")}에 들어 있습니다.` }
    : { label: `${year}년 점검 회차(${name})`, st: "none", basis: `올해 점검 회차에 ${name}(${code})이 없습니다 — 반기마다 회차에 넣어야 합니다.`, fix: "점검 회차를 만들 때 이 의무조항을 넣습니다.", href: q("/inspections"), hrefLabel: "③ 점검 계획" };

  /** 별표 5 쪽(제3·4호) — 해당 품목 중 별표 5가 있으면 판정, 모두 「별표 5 아님」이면 해당 없음, 모르면 확인 필요. */
  const b5Gate = (fallback: Check[], real: () => Check[]): { checks: Check[]; na: boolean } => {
    if (allNo) return { checks: [naCheck("별표 5 품목")], na: true };
    if (!anyYes) return { checks: fallback, na: false };
    if (b5Yes.length) return { checks: [{ label: "별표 5 품목", st: "ok", basis: b5Yes.map((r: any) => `${r.item_name} — ${b5Text(r.byeolpyo5)}`).join(" · ") }, ...real()], na: false };
    if (b5Unk.length) return { checks: [{ label: "별표 5 해당 여부", st: "unk", basis: `해당 품목 중 별표 5 여부를 정하지 않은 것: ${nameList(b5Unk)}`, fix: "대장에서 별표 5 해당 여부를 고릅니다.", href: matHref, hrefLabel: "원료·제조물 대장" }], na: false };
    return { checks: [{ label: "별표 5 품목", st: "unk", basis: `해당 품목(${nameList(yes)})이 모두 별표 5가 아닙니다 — 제3호·제4호는 해당 없음. 제1·2·5호와 제9조는 별표 5 밖에도 걸립니다.` }], na: true };
  };
  /** 제1·2·5호 · 제9조 — 해당 품목이 하나라도 있으면 판정, 모두 비해당이면 해당 없음, 아니면 확인 필요(판단 전). */
  const gate = (fallback: Check[], real: () => Check[]): { checks: Check[]; na: boolean } =>
    allNo ? { checks: [naCheck("해당 여부")], na: true } : anyYes ? { checks: real(), na: false } : { checks: fallback, na: false };

  const g1 = gate(
    [
      { label: "가목·나목 인력", st: "unk", basis: GATE + taskNote("M01", "인력배치") },
      { label: "다목 고시 인력 기준", st: "unk", basis: `${NOTICE}의 기준과 대조해야 합니다.` },
    ],
    () => [
      { ...staffCheck, label: "가목·나목 인력 — 해당 품목 담당자 지정" },
      { label: "다목 고시 인력 기준", st: "unk", basis: `${NOTICE}의 기준과 대조해야 합니다.${pendNote}` },
    ],
  );
  const g2 = gate(
    [
      { label: "가목·나목 예산", st: "unk", basis: GATE + taskNote("M02", "예산 편성·집행") },
      { label: "다목 고시 예산 기준", st: "unk", basis: `${NOTICE}의 기준과 대조해야 합니다.` },
    ],
    () => [
      { ...budCheck, label: "가목·나목 예산 — 원료·제조물 몫" },
      { label: "다목 고시 예산 기준", st: "unk", basis: `${NOTICE}의 기준과 대조해야 합니다.` },
    ],
  );
  const g3 = b5Gate(
    [{ label: "별표 5 품목 해당 여부", st: "unk",
       basis: "다루는 원료·제조물이 별표 5 목록에 드는지 먼저 가려야 합니다. 별표 5는 추가 조치 대상이고, 제1호·제2호·제5호는 원료·제조물 전반에 적용됩니다." + taskNote("M03", "별표5 대상 재해예방 조치") }],
    () => [taskCheck("가목~라목 조치(주기 점검·신고·재해 대응·원인조사 개선)", "M03", "별표5 대상 재해예방 조치", "업무처리절차에 따라 주기 점검·신고·조치를 하고 기록을 남깁니다.")],
  );
  const g4 = b5Gate(
    [{ label: "업무처리절차", st: "unk", basis: GATE + taskNote("M04", "재해예방 업무처리절차 마련·이행") }],
    () => [taskCheck("업무처리절차(제3호 가목~라목 포함)", "M04", "재해예방 업무처리절차 마련·이행", "제3호 가목~라목을 담은 업무처리절차를 마련합니다.")],
  );
  const g5 = gate(
    [{ label: "반기 점검", st: "unk", basis: GATE }],
    () => [halfCheck("제1호·제2호 반기 점검(경영책임자 보고받음)", m5recs, "제1호 인력·제2호 예산을 이번 반기에 점검하고 경영책임자에게 보고합니다.", q("/system?area=M#m5"), "제5호")],
  );
  const g6 = gate(
    [{ label: `${year}년 점검 회차(원료·제조물 관계법령 의무이행)`, st: "unk",
       basis: (m08.length ? `${m08.map((b) => idKo(b.batch_id)).join(" · ")}에 들어 있습니다. ` : "올해 점검 회차에 원료·제조물 관계법령 의무이행(M08)이 없습니다. ")
         + "해당으로 판단되면 반기마다 회차에 넣어야 합니다." + taskNote("M08", "관계법령 의무이행") }],
    () => [halfBatch(m08, "M08", "원료·제조물 관계법령 의무이행")],
  );
  const g7 = gate(
    [{ label: "교육 실시 점검", st: "unk", basis: GATE + taskNote("M09", "관계법령 교육이수") }],
    () => [{ ...halfBatch(m09, "M09", "관계법령 교육이수"), basis: halfBatch(m09, "M09", "관계법령 교육이수").basis + " 관계 법령에 법정교육이 없는 품목에는 새 교육 점검을 만들지 않습니다(환경부 해설서 53·136쪽)." }],
  );

  const gateChecks: Check[] = items.length ? items.map(itemCheck) : [
    { label: `수돗물(상수도사업소 · 지방상수도 ${water}곳)`, st: "unk", basis: "정수장·배수지 등은 공중이용시설 쪽에서 빠지는 경우가 있어 원료·제조물 쪽에서 걸릴 수 있습니다 — 판단이 필요합니다." },
    { label: "직영 급식(집단급식소)", st: "unk", basis: "시가 직접 운영하는 급식이 있는지 확인해야 합니다." },
    { label: "예방접종·의약품 투여(보건소)", st: "unk", basis: "보관·관리 결함으로 변질된 의약품을 투여하면 해당될 수 있다는 해석이 있습니다 — 판단이 필요합니다." },
    { label: "부산물비료 등 생산·배부(농업기술센터)", st: "unk", basis: "생산해 농가에 배부하는 제품이 있는지 확인해야 합니다." },
  ];

  const clauses: Clause[] = [
    {
      no: 0, ref: "먼저 — 해당 여부 판단", anchor: "m0", name: "용인시가 원료·제조물을 생산·제조·판매·유통하는가",
      text: "법 제9조제1항은 실질적으로 지배·운영·관리하는 사업장에서 생산·제조·판매·유통 중인 원료나 제조물에 적용됩니다. 환경부 해설서는 최종 사용자가 사서 쓰는 경우만 적용 대상이 아니라고 보고(20·131쪽), 제조물의 구성성분이 아니어도 자기 생산 공정에 투입하는 원료는 포함한다고 봅니다(108쪽 — 발전소가 탱크에 저장해 쓰는 황산·암모니아). 주민 등에게 무상 제공·투여·배부하는 것이 해당되는지는 ADOMS 해석이며 확인이 필요합니다(해설서의 병원 의약품 사례는 별표 5 의약품 취급과 관리상 결함을 근거로 들었습니다, 131쪽). 해설서는 행정 해석이라 법원을 구속하지 않습니다.",
      checks: gateChecks,
      go: [{ href: matHref, label: "원료·제조물 대장" }, { href: q("/targets"), label: "관리대상" }, { href: q("/duties"), label: "② 의무 파악" }],
    },
    {
      no: 1, ref: "시행령 제8조제1호", anchor: "m1", name: "원료·제조물 재해예방 인력",
      text: "가. 관계 법령에 따른 안전·보건 관리 업무의 수행 나. 유해·위험요인의 점검과 위험징후 발생 시 대응 다. 기후에너지환경부장관 고시 사항 — 이를 이행하는 데 필요한 인력을 갖추어 업무를 수행하도록 할 것",
      checks: g1.checks,
    },
    {
      no: 2, ref: "시행령 제8조제2호", anchor: "m2", name: "원료·제조물 재해예방 예산",
      text: "가. 관계 법령에 따른 인력·시설 및 장비 등의 확보·유지 나. 유해·위험요인의 점검과 위험징후 발생 시 대응 다. 기후에너지환경부장관 고시 사항 — 필요한 예산을 편성·집행할 것",
      checks: g2.checks,
      go: [{ href: q("/budget"), label: "예산" }],
    },
    {
      no: 3, ref: "시행령 제8조제3호", anchor: "m3", name: "별표 5 원료·제조물 추가 조치",
      text: "별표 5에서 정하는 원료 또는 제조물로 인한 중대시민재해를 예방하기 위해 가. 유해·위험요인의 주기적인 점검 나. 발견된 유해·위험요인의 신고 및 조치 다. 발생 시 보고, 신고 및 조치 라. 원인조사에 따른 개선조치를 할 것",
      checks: g3.checks,
    },
    {
      no: 4, ref: "시행령 제8조제4호", anchor: "m4", name: "업무처리절차 마련",
      text: "제3호 각 목의 조치를 포함한 업무처리절차의 마련(소상공인은 제외)",
      checks: g4.checks,
    },
    {
      no: 5, ref: "시행령 제8조제5호", anchor: "m5", name: "제1호·제2호 반기 점검과 조치",
      text: "제1호 및 제2호의 사항을 반기 1회 이상 점검하고, 점검 결과에 따라 인력을 배치하거나 예산을 추가로 편성·집행하는 등 필요한 조치를 할 것",
      checks: g5.checks,
    },
    {
      no: 6, ref: "시행령 제9조제2항제1호·제2호", anchor: "m9-1", name: "관계 법령 의무이행 반기 점검·미이행 조치",
      text: "관계 법령에 따른 의무를 이행했는지를 반기 1회 이상 점검(위탁 점검 포함)하고 결과를 보고받을 것 · 미이행이 확인되면 인력 배치·예산 추가 편성 등 필요한 조치를 할 것",
      checks: g6.checks,
      go: [{ href: q("/inspections"), label: "③ 점검 계획" }],
    },
    {
      no: 7, ref: "시행령 제9조제2항제3호·제4호", anchor: "m9-3", name: "법정 교육 실시 반기 점검·미실시 조치",
      text: "관계 법령에 따라 의무적으로 실시해야 하는 교육이 실시되는지 반기 1회 이상 점검하고 결과를 보고받을 것 · 실시되지 않은 교육은 지체 없이 이행 지시·예산 확보 등 조치를 할 것",
      checks: g7.checks,
    },
  ];
  /** 해당 없음 칸 — 상태 칸(St)에는 「확인 필요」 자리를 두고, 개수에서는 뺀다. 화면은 na 로 「해당 없음」을 보인다. */
  const na = [false, g1.na, g2.na, g3.na, g4.na, g5.na, g6.na, g7.na];
  // 「먼저 — 해당 여부 판단」은 판단 전 품목이 하나라도 남으면 확인 필요다(끌어내리지 않고 드러낸다).
  const sts: St[] = clauses.map((c, i) => (i === 0 ? (gateChecks.some((k) => k.st === "unk") ? "unk" : "ok") : overall(c.checks)));
  const cnt = (x: St) => sts.filter((v, i) => v === x && !na[i]).length;
  const unkN = clauses.reduce((a, c, i) => a + (na[i] ? 0 : c.checks.filter((k) => k.st === "unk").length), 0);
  const naN = na.filter(Boolean).length;
  return {
    clauses, sts, cnt, unkN, year, mTaskN: mT.length, mDeptText,
    na, naN, items, yesN: yes.length, noN: no.length, pendingN: pending.length, ceoWait, allNo,
  };
}
