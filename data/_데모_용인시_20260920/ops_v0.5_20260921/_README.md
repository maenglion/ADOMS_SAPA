# ops_v0.5_20260921 — 운영 예시 자료 v0.5 (2026-09-21)

앞 판(v0.1~v0.4)을 덮지 않는다. 앱은 표마다 **새 판부터** 찾는다(같은 이름 표가 v0.5에 있으면 v0.5를 읽는다).

## 표

| 파일 | 행 | 내용 |
|---|---:|---|
| `contract.csv` | 71 | v0.4 + 칸 10개(담당 연락처·착공일·주요 수행업무·업무수행장소 등) — 생성기 build_contracts_v05.py |
| `contract_compliance.csv` | 284 | 도급 관리의무 4항목 × 71계약 준수여부 |
| `contract_hazard_map.csv` | 305 | 위험요인 ↔ 18항목 코드 연결 |
| `contract_mgmt_item.csv` | 4 | 관리의무 4항목(시행령 제4조제9호 가·나·다 · 법 제5조) |
| `hazard_code.csv` | 18 | 유해·위험요인 18항목 |
| `safety_manual.csv` | 6 | 시행령 제4조제3·5·7·8·9호 절차·매뉴얼 — 생성기 build_system_v05.py |
| `safety_org_role.csv` | 46 | 선임·지정 7항목 × 부서 |
| `safety_policy.csv` | 3 | 경영방침·목표(시행령 제4조제1호) |

`forms/` — 법정 서식 132개(별표·별지 서식을 HTML로 바꾼 것, schedule_to_html.py).

## 이 판과 함께 늘어난 칸(화면이 쓰는 것)

DDL은 `_build/ops_v05_add.sql` — inspection.round_no · action 조치 요구·보완 제출 칸 · inspection_batch 상신·결재 칸 · notification 발신 칸 · duty_assignment 확인 칸.
누적 DDL과 필드 대장은 `_build/export_schema.py`가 `_스키마/`에 다시 만든다.

모든 사람 이름은 가상 인물이며 행마다 `note`에 「예시 자료」가 있다.
