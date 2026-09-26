# ops_v0.6_20260921 — 운영 예시 자료 v0.6 (2026-09-21)

앞 판(v0.1~v0.5)을 덮지 않는다. 앱은 표마다 **새 판부터** 찾는다(같은 이름 표가 v0.6에 있으면 v0.6을 읽는다).
이 판의 CSV는 발행된 판이라 고치지 않는다. 시연 중 입력은 앱의 덮개(`.data/overlay.json`)에만 쌓인다.

## 표 (행·칸 수는 2026-09-21 실측)

| 파일 | 행 | 칸 | 내용 | 생성기(`_build/`) |
|---|---:|---:|---|---|
| `annual_schedule.csv` | 12 | 11 | 연간 운영 일정(법이 날짜를 정하지 않은 것만 · 서울시 안내서 예시) | build_schedule_v06.py |
| `civil_safety_plan.csv` | 1,564 | 21 | 시설·연도별 안전계획(2025·2026) — 계획 근거·경영책임자 확인·가·나·다목 포함 여부 | build_civil_system_v06.py |
| `civil_manual.csv` | 85 | 17 | 시민재해 업무처리절차·매뉴얼·반기 점검·교육 이수 점검·대피훈련 기록 | build_civil_system_v06.py |
| `hazard_report.csv` | 40 | 49 | 유해·위험요인 신고 한 건의 전 단계(접수 → 피해방지조치 → 1차 판단 → 경미 종결 / 심각 보고·긴급점검·개선 지시·보수·보강) | build_hazard_drill_v06.py |
| `hazard_step.csv` | 167 | 7 | 신고 처리 기록(단계마다 한 줄) | build_hazard_drill_v06.py |
| `drill_plan.csv` | 15 | 45 | 대피훈련 계획·준비·임무카드·실시·결과·갈음 확인 | build_hazard_drill_v06.py |
| `drill_eval.csv` | 11 | 19 | 대피훈련 평가표 100점(12항목) | build_hazard_drill_v06.py |
| `incident.csv` | 10 | 39 | v0.2 2행 값 그대로 + 칸 27개(원인 조사 → 대책 수립 → 이행 → 효과 확인) + 예시 8행 | build_recurrence_v06.py |
| `incident_nil_check.csv` | 14 | 7 | 반기 「재해 발생 이력 없음」 확인 | build_recurrence_v06.py `--nil-seed` |
| `order_received.csv` | 17 | 30 | v0.2 6행 값 그대로 + 칸 19개(담당 지정 → 착수 → 완료 → 보고 → 종결 · 기한 연장) + 예시 11행 | build_recurrence_v06.py |
| `safety_budget.csv` | 77 | 14 | v0.2 70행 보존 + 칸 5개(고정 6행 항목·가/나/밖 용도·근거·위험요인) + 나목 예시 행 | build_budget_training_v06.py |
| `training_course.csv` | 11 | 11 | 법정 교육 과정(이름·근거·대상·주기·시간·적용 부서·유해위험 작업 여부) | build_budget_training_v06.py |
| `training_record.csv` | 87 | 14 | v0.2 28행 보존 + 칸 5개(과정·기간·기한·이수 상태·비고) + 예시 행 | build_budget_training_v06.py |

## 근거 조문 (생성기 머리말에서 법령DB 원문과 대조한 것)

- 중대재해처벌법 법 제4조제1항제2호·제3호, 제9조제1항·제2항 각 제2호·제3호 — 재발방지 대책, 개선·시정명령 이행
- 시행령 제4조제4호 가·나목 — 예산 편성·집행(다목 고시는 아직 없어 어떤 예산도 다목으로 분류하지 않았다)
- 시행령 제5조제2항제3호·제4호 — 유해·위험 작업 교육 반기 점검, 미실시 교육 이행 지시
- 시행령 제10조제4호(단서: 시설물안전법 제6조·철도안전법 제6조 계획 + 경영책임자 확인·보고) · 제5호 · 제7호 가·나·라목(단서: 철도안전법 제7조) · 제8호 가·나목 · 제11조제2항
- 시설물안전법 제24조제1항 · 시행령 제19조 — 보수·보강 착수 1년·완료 2년(현행 원문. 서울시 안내서의 「2년·3년」은 옛 판 문구)
- 교육 과정: 산업안전보건법 제29조·제32조, 시행규칙 제26조·제29조·별표 4·별표 5, 승강기 안전관리법 제29조, 어린이놀이시설 안전관리법 제20조, 시설물안전법 시행규칙 제10조

## 예시 자료 표시

- 사람 이름은 가상 인물이고 담당은 기존 `staff_id`만 쓴다. 시설은 `asset.csv`의 실제 시설(용인경전철은 자산 대장 밖 `LRT-EVERLINE`).
- 행마다 `note`에 「예시 자료」가 있다. 예외 1행: `annual_schedule`의 SCH-02는 note가 「전년도 실적」이다(`kind`가 「서울시 운영 예시」).
- 명령 문서 번호는 「(가상)」을 붙였다. 옮겨 온 v0.2 행은 값을 고치지 않고 어긋난 점을 `check_note`에 적었다.
- 일부러 비워 둔 곳(화면에서 「할 일」로 보이게)은 생성기 머리말에 적혀 있다.

## 이 판과 함께 늘어난 칸

DDL은 `_build/ops_v06_add.sql` — 새 표 9개(`create table if not exists`)와 기존 표 칸 추가(`add column if not exists`):
incident 29 · order_received 21(v0.2 DDL에 없던 `note` 포함) · safety_budget 5 · training_record 10.
CSV에는 없고 화면이 `appendRow`·`patchRow`로 쓰는 칸도 넣었다 — `civil_safety_plan.confirm_proxy·confirmed_by`,
`incident.history·reopen_count`, `training_record.instructed_at·instructed_by·instruct_due·instruct_basis·done_by`(DDL 주석에 「화면이 씀」).
누적 DDL과 필드 대장은 `_build/export_schema.py`가 `_스키마/`에 다시 만든다.
