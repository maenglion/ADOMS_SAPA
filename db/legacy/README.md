# DB 이관 자료 — CSV 판 + 덮개 → 관계형 DB(Supabase/PostgreSQL)

지금 앱(3400)은 DB 없이 돈다. **읽기** = 데이터 판 폴더의 CSV(`seed\<표>.csv`), **쓰기** = 앱 폴더의 덮개 파일(`.data\overlay.json`).
Supabase 환경변수를 채우면 같은 코드가 스키마 `adoms2` 로 읽고 쓰게 되어 있지만(`lib/data.ts` `useDb`), **그 모드는 일부만 만들어져 있다**(아래 「알려진 틈」).
이 폴더는 CSV·덮개를 DB 로 옮기는 데 필요한 목록과 기존 SQL 을 모은 것이다. 자동 생성 도구: `..\_도구\a2_analyze_tables.py`.

## 파일

| 파일 | 내용 |
|---|---|
| `tables.csv` | 앱이 쓰는 표·뷰 **98개** — 원천(어느 판 / 덮개) · seed 행 수 · 덮개가 더한 행·고친 행 · 키 칸과 그 근거 · 기존 SQL 에 있나 · 판 이력 · 부르는 함수 · 쓰는 화면·코드 · 비고 |
| `columns.csv` | 표 × 칸 **1,310줄** — 예시값 · 추정 타입(값으로 추정) · 기존 SQL 타입 · 원천(seed/overlay/코드) · 뜻·채움률(필드대장) |
| `db_calls.csv` | Supabase 모드(`useDb`)에서 `fromDb(` 로 부르는 뷰·표와 질의 모양 |
| `ERD.mmd` | 운영 표 관계(mermaid erDiagram). 선 이름 「SQL 선언」 = 기존 DDL 의 references · 「추정(…)」 = 칸 이름으로 읽은 것(DB 제약 아님 — 확인 필요) |
| `sql_기존\_스키마\ops_cumulative.sql` | 누적 DDL(09-22 자동 생성) — 표 53개 · v0.1~v0.8 에서 생긴 칸 전부 · 칸마다 뜻과 생긴 판 주석 |
| `sql_기존\_스키마\(명세)운영DB_필드대장_*.csv/.html` | 필드대장(표·칸·자료형·생긴 판·뜻·채움률·예시값·행수·쓰는 화면) — 09-21·09-22 판 |
| `sql_기존\ops_v0.1_20260920\` | 첫 판 DDL(`01_schema.sql`) · 뷰(`02_views.sql`, 뷰 6개 — 나머지 뷰 6개는 `_build_추가SQL\` 에 · `ops_cumulative.sql` 에는 뷰가 없다) · 적재(`03_load.sql`) · 적재 안내 |
| `sql_기존\_build_추가SQL\` | 판마다 더한 DDL(`ops_v0.2_add.sql` ~ `ops_v08_add.sql`) — `ops_cumulative.sql` 에 모두 들어 있다 |
| `_analyze_summary.json` | 생성 도구 요약(표 수·새 표 목록·관계선 수·못 푼 부름) |

## 한눈에

- 표·뷰 98개 = 기존 SQL 에 있는 표 53 + 뷰 4(앱이 부르는 것) + **기존 SQL 에 없는 표 41**.
- **새로 만들어야 하는 표 41개**(`tables.csv` 「기존SQL」 = 없음): 교육자료 버전(400)에서 생긴 `us*` 계열과 시스템 관리 표.
  - 관리대상 기본정보 `usb1_*`(basic · contract · contract_duty · hazard_place · transport · work_site · workplace · ws_mgmt)
  - 담당자·관리대상 지정 `usb2_*`(assign · basic · law · role · timing)
  - 의무이행 기록 `usc_record`(사업장) · `usd_record`(공중이용시설·공중교통수단) · `use_record`·`use_plan`·`use_site`(원료·제조물)
  - 기관장·게시판·이행점검 `usf_*`(ceo_activity · ceo_log · file · judge · letter · letter_read · notice · round)
  - 통계·사례 `usg_*`(case · stat_occur · ws_industry) · 이행현황 조치 지시 `usa_order`
  - 시스템 관리 `sys_menu` · `sys_code` · `sys_mail_log` · 증빙 나누기 `evidence_split`
  - 그 밖 `budget_exec` · `civil_record` · `org_profile` · `law_sync_applied` · `law_sync_decision`
  - `accident_case`·`accident_stat` 은 ops_v1.6 판에 있지만 **앱 코드가 부르지 않는다**(같은 행 수의 `usg_case`·`usg_stat_occur` 를 쓴다) — 옮길지 확인 필요.
- 새 표의 칸은 CSV 헤더·덮개 행·코드의 쓰기 객체(`appendRow({...})`)에서 모았다. 행이 하나도 없는 표(`sys_*`, `evidence_split`, `budget_exec` 등)는 타입을 「미정(값 없음)」으로 두었다 — 칸 이름과 코드로 정한다.
- 관계선 91개(기존 DDL 선언 49 · 칸 이름 추정 42). 관계가 하나도 안 잡힌 표는 `ERD.mmd` 맨 위 주석에 적었다.

## 원천 규칙 — 앱이 표 하나를 읽는 법

```
① seed: 데이터 폴더의 us_* 판을 새것부터 → ops_* 판을 새것부터 훑어 처음 만나는 seed\<표>.csv 하나   (lib/data.ts opsDirs · seed)
② 덮개 added: overlay.tables[<표>]  (새 줄이 앞 — appendRow 는 앞에 끼운다)
③ 덮개 patches: overlay.patches[<표>][<키 값>] = 바뀐 칸만           (patchRow — 같은 키에 여러 번 고치면 칸끼리 합쳐 둔다)

읽을 때: rows = [...added, ...seed]  →  키 칸이 patches 에 있으면 { ...row, ...patch }     (lib/data.ts readTable)
```

- **판은 덮어쓰지 않는다.** 새 판에는 바뀐 표만 들어 있다. 이관 때는 `tables.csv` 「원천」의 **그 판 CSV 하나만** 넣는다(옛 판 CSV 를 함께 넣으면 옛 행이 되살아난다).
- 판 이력(어느 판에 같은 표가 있었나)은 `tables.csv` 「판_이력」 칸.
- CSV 는 UTF-8(BOM 있음)·따옴표 안 줄바꿈 있음. 첫 칸 이름이 BOM 때문에 깨지지 않게 읽는다.
- 화면에 올리기 전 `scrubRow` 가 예시 자료 표시(「예시 자료(시연용)」「(가상)」 등)를 걷는다 — **원본 값에는 그 표시가 들어 있다.** 옮길 때 그대로 두면 화면은 같다.

### 표마다 다른 겹치기(`tables.csv` 「비고」)

| 표 | 겹치는 순서 |
|---|---|
| `compliance_task` | seed → `task_approval_patch`(같은 task_id 의 결재 칸) → 덮개 `taskPatch`(옛 자리) |
| `evidence` | 덮개 `evidence[]`(옛 자리) + seed |
| `inspection` | 덮개 `inspection[]`(옛 자리) + `tables.inspection` + seed, `patches.inspection` |
| `duty_class` | 덮개 `tables.duty_class` + seed, `patches.duty_class`(키 `duty_key`) · `retired = Y` 는 숨김 |
| `asset` | 덮개 `tables.asset` + seed, `patches.asset`(키 `asset_id`) · `deleted = Y` 는 숨김(지우지 않음) |
| `usf_judge` · `sys_code` · `sys_menu` | 추가만 하는 이력 표 — 가장 최근 줄이 현재값 |

## 덮개(`overlay.json`) 구조 — 동결 사본 `..\repo\.data\overlay.json`

```jsonc
{
  "taskPatch":  { "<task_id>": { 바뀐 칸… } },        // 옛 자리 — compliance_task 고침(13건)
  "evidence":   [ { evidence 한 줄 } ],               // 옛 자리 — 등록한 증빙(7건)
  "inspection": [ { inspection 한 줄 } ],             // 옛 자리 — 과제 판정(10건)
  "log":        [ { at, action, target, by, note } ], // 감사 기록 — 최근 300줄만(지금 241줄)
  "tables":  { "<표>": [ 새 행… ] },                  // appendRow — 표 19개
  "patches": { "<표>": { "<키 값>": { 바뀐 칸… } } }  // patchRow — 표 8개
}
```

- 키 칸은 덮개에 적혀 있지 않다 — 부르는 코드가 정한다(`patchRow(표, 키칸, 키값, …)` · `readTable(표, 키칸)`). `tables.csv` 「키_칸」에 모아 두었다.
- `log` 는 `audit_log` 표 자리다(칸 이름 `by` ↔ 기존 DDL `actor`).
- 덮개를 지우면 화면은 처음 판 상태로 돌아간다(`resetOverlay`).

## 이관 순서(제안)

1. 스키마 `adoms2` 를 만들고 `sql_기존\_스키마\ops_cumulative.sql` 을 돌린다(표 53개).
   - 첫 판 `01_schema.sql` 에 있던 `check` 제약(예: `inspection.result in ('적합','부적합','보류')`)이 지금 값과 맞는지 먼저 본다 — 앱은 그 뒤 「보완필요」 등을 쓴다.
2. `tables.csv` 에서 「기존SQL = 없음」인 41개를 `columns.csv` 로 만든다. 추정 타입은 확인하고 정한다(`data`·`files` 칸은 JSON 글자 → jsonb 후보 · 날짜와 일시가 섞인 칸이 있다).
   - 추가만 하는 이력 표(`sys_code`·`sys_menu`·`usf_judge`)는 대리 PK(일련번호)를 두고, 현재값은 「키별 가장 최근 줄」 뷰로 만든다.
3. 뷰를 만든다 — 앱이 부르는 것은 `v_duty_detail` · `v_duty_todo` · `v_task_approval` · `v_contract_duty`(`db_calls.csv`). `02_views.sql`·`_build_추가SQL\*.sql` 의 뷰는 만든 판의 칸 기준이라 지금 칸과 맞는지 확인한다.
4. seed 적재 — 표마다 `tables.csv` 「원천」 판의 CSV 하나. 외래키 순서: `org_dept` → `staff` → `asset` → `asset_target_map` → `duty_class` → `duty_assignment` → `compliance_task` → 나머지(ERD 참고).
5. `task_approval_patch` 를 `compliance_task` 에 합친다(같은 task_id 칸 덮기).
6. 덮개 합치기 — `tables` 는 INSERT, `patches` 는 키로 UPDATE, 옛 자리(`taskPatch`·`evidence`·`inspection`)는 위 표대로, `log` 는 `audit_log` 로.
   - `repo\scripts\export_overlay.mjs` 는 옛 자리(`evidence`·`taskPatch`·`log`)만 SQL 로 바꾼다 — `tables`·`patches` 는 따로 해야 한다.
7. 올린 파일 — `..\repo\.data\uploads\` 를 Storage 버킷(`evidence`)에 올리고, 행 안의 주소 `/api/file/<파일이름>` 을 Storage 주소로 바꾼다(`evidence.file_url` · `us*_record.files` JSON · `usf_*` 첨부 칸).
8. 표가 아닌 파일 원천 — DB 로 옮길지 따로 정한다: 조문 원문 `lawtext_v1.0_20260924\`(JSON 파일 678개) · 법령 개정 확인 결과 `law_sync\runs\` · 법정 서식 HTML `ops_v0.9_20260923\forms\`.

## 알려진 틈(Supabase 모드)

- `useDb` 에서도 **파일을 읽는 곳이 남아 있다**: `dutyClassRows()`(의무 표) · `assetSeed()`(자산) 등은 모드와 관계없이 `seed()` 로 CSV 를 읽는다. 조문 원문·서식·법령 개정 결과도 파일이다. 지금 DB 모드로 바꾸면 **CSV 와 DB 를 섞어 읽는다.**
- `readTable` 의 DB 경로는 `select=*&limit=5000` 한 번이다. Supabase(PostgREST)의 한 번에 돌려주는 최대 행 수 기본값(1000)도 걸린다 — 1000행이 넘는 표(`compliance_task` 2,465 · `duty_assignment` 4,400 · `task_approval_patch` 2,465 · `evidence` 1,128 · `duty_class` 11,075)는 잘린다. 페이지 나눠 읽기가 필요하다.
- 쓰기는 anon 키로 표에 바로 POST/PATCH 한다 — RLS(행 수준 보안) 정책 없이 열면 누구나 쓴다. 본 구축 때 로그인·RLS·서버 쪽 API 로 바꾼다.
- `patchRow` DB 경로는 키 칸 하나(`키=eq.값`)로만 찾는다 — 복합 키 표(`asset_target_map`)는 확인 필요.
