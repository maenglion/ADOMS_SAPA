# ops_v0.7_20260921 — 운영 예시 자료 v0.7 (2026-09-21)

앞 판(v0.1~v0.6)을 덮지 않는다. 앱은 표마다 **새 판부터** 찾는다 — `contract`는 v0.5 대신,
`order_received`·`training_course`는 v0.6 대신 이 판을 읽는다. 옮겨 온 행의 원래 칸 값은 생성기가 끝에서 전부 다시 대조했다(assert).

## 표 (행·칸 수는 2026-09-21 실측)

| 파일 | 행 | 칸 | 내용 | 생성기(`_build/`) |
|---|---:|---:|---|---|
| `system_record.csv` | 17 | 26 | 시행령 제4조제1·3·5·7·8호 점검·평가·보고 기록(경영책임자 보고받음 칸 포함) | build_system_records_v07.py |
| `eval_criteria.csv` | 21 | 8 | 제5호 나목 평가 기준표 — 안전보건관리책임자 9 · 관리감독자 7 · 안전보건총괄책임자 5 항목(배점은 예시) | build_system_records_v07.py |
| `worker_voice.csv` | 9 | 21 | v0.2 5행 값 그대로 + 처리 단계·개선방안·경영책임자 보고 칸 13개 + 예시 4행 | build_system_records_v07.py |
| `contract.csv` | 71 | 53 | v0.5 71건 + 칸 23개(위탁 유형·적용 틀·실질 지배 판단·작업 위험도·합격선·도급 5단계·안전보건 관리비) | build_contracts_orders_v07.py |
| `contract_eval_item.csv` | 10 | 14 | 수급인 안전관리능력 평가 10항목(우수 5·보통 3·미흡 1 · 기본 가중치) | build_contracts_orders_v07.py |
| `order_received.csv` | 19 | 31 | v0.6 17건 + `doc_nature`(서면 행정처분 · 지도·권고·조언) + 지도·권고 예시 2건 | build_contracts_orders_v07.py |
| `training_course.csv` | 13 | 12 | v0.6 11행 + 재해 구분 `area`(I·F·M) + 과정 2개(철도안전교육 · 유해화학물질 안전교육) | build_training_v07.py |

## 근거 조문 (생성기 머리말에서 법령DB 원문과 대조한 것)

- 중대재해처벌법 시행령 제4조제1호(목표·경영방침) · 제3호(단서: 위험성평가 결과 보고) · 제5호 가·나목 · 제7호(단서: 산업안전보건위원회·협의체) · 제8호 가·나·다목
- 평가 기준 항목: 산업안전보건법 제15조제1항 제1~9호 · 같은 법 시행령 제15조제1항 제1~7호 · 제53조제1항 제1~5호
- 법 제5조(단서 「실질적으로 지배·운영·관리하는 책임이 있는 경우」) · 법 제9조제3항 · 시행령 제4조제9호 가·나·다목 · 제10조제8호 가·나목
- 교육 재해 구분: 시행령 제5조·제9조·제11조 각 제2항제3호·제4호 / 추가 과정 — 철도안전법 제24조제1항·시행규칙 제41조의2, 화학물질관리법 제33조제1항·시행규칙 제37조제1항·별표 6의3
- 참고 자료(법적 효력 없음): 서울시 안내서 p.37~40(도급 5단계) · p.139~141(평가 10항목) · Q&A p.256~274(위탁 유형), 교육자료 p.71(행정지도·권고는 개선·시정명령이 아님)

## 예시 자료 표시

- 사람은 기존 `staff_id`만 쓴다. `contract_eval_item`을 뺀 모든 표는 행마다 `note`에 「예시 자료」(또는 「예시 데이터」)가 있다.
- `contract_eval_item`에는 `note` 칸이 없다 — 서울시 안내서 평가 항목 정의를 옮긴 기준표이고, 출처는 `source`·`basis`·`basis_unit_id` 칸에 있다.
- 실질 지배 판단·공중이용시설 해당 여부는 **제안값**이다. 확인한 사람·날짜(`control_confirmed_at`·`control_confirmed_by`)는 비워 두었다 — 판단은 사람이 한다.
- `eval_criteria`의 배점은 기관이 정하는 값이다(여기 값은 예시).

## 이 판과 함께 늘어난 칸

DDL은 `_build/ops_v07_add.sql` — 새 표 6개와 기존 표 칸 추가.

- CSV가 있는 것: `system_record` · `eval_criteria` · `contract_eval_item`(새 표) · contract 23 · worker_voice 13 · order_received `doc_nature` · training_course `area`
- 화면만 쓰는 새 표: `contract_eval_score`(10항목 평가 기록) · `contract_eval_setting`(합격선·가중치 설정) · `training_check`(교육 실시 점검 기록)
- 화면만 쓰는 새 칸: `system_record`·`worker_voice`의 `report_proxy` · order_received `order_area`·`basis_clause` · safety_budget `area` ·
  inspection_batch 위탁 점검 7칸(`rule_basis`·`insp_method`·`outsource_org`·`report_received_at`·`report_received_by`·`report_recorded_by`·`report_proxy`) ·
  action `action_basis`·`prev_action_type` · inspection `action_need` · evidence `file_type` · compliance_task `resubmit_round`·`resubmit_note`

누적 DDL과 필드 대장은 `_build/export_schema.py`가 `_스키마/`에 다시 만든다.
