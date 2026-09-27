# ADOMS visible menu smoke verification

## 검사 기준

- 메뉴 목록: `lib/menu.ts`의 `usGroupsFor(role)` 결과에서 clickable `href`만 동적 수집
- 역할: `gm`, `ceo`, `mgr`, `road`, `road_head`, `water`, `water_head`
- 검사: HTTP 오류, JSON 응답, blank page, ADOMS 공통 Shell 누락, 사용자에게 노출된 내부 오류 문자열
- 브라우저 동작: 실제 GNB button과 dropdown item을 사용해 단일 dropdown, 역할 query 전달, role별 메뉴 갱신을 별도 확인

## 로컬 production build 기준 결과

| 역할 | 대상 | PASS | FAIL |
|---|---:|---:|---:|
| ceo | 39 | 39 | 0 |
| gm | 59 | 59 | 0 |
| mgr | 48 | 48 | 0 |
| road_head | 39 | 39 | 0 |
| road | 35 | 35 | 0 |
| water_head | 39 | 39 | 0 |
| water | 35 | 35 | 0 |
| 합계 | 294 | 294 | 0 |

- 깨진 화면: 없음
- HTTP 500/502/503/504: 0
- raw internal/error page: 0
- blank page: 0
- 잘못된 role menu: 0
- 동시에 열린 dropdown: 0

## Production 최종 결과

배포 후 추가한다.
