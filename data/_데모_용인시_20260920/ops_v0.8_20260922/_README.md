# ops_v0.8_20260922 — 운영 예시 자료 v0.8 (2026-09-22)

앞 판을 덮지 않는다. 앱은 표마다 새 판부터 찾는다.

| 파일 | 행 | 내용 |
|---|---:|---|
| `incident_report.csv` | 9 | 재해 보고 3단계(최초·직후·수시) — 같은 생성기 |
| `incident_response.csv` | 28 | 재해 발생 직후 대응(긴급 조치 체크·경영책임자 받음·지시) — 생성기 build_incident_response_v08.py · 시행령 제10조제7호다목 |
| `material_item.csv` | 6 | 원료·제조물 대장(품목·행위·별표5·판단·사유·경영책임자 확인) — 생성기 build_material_v08.py · 시행령 제8조·제9조 |

DDL: `_build/ops_v08_add.sql`(material_item · incident_response · incident_report · 최초보고 기한 설정 표). 모든 행 note 에 「예시 자료」. 원료·제조물 후보(수돗물·직영 급식·예방접종·의약품·부산물비료)는 사람이 판단할 때까지 「확인 필요」.
