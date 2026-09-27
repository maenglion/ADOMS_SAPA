# ADOMS visible menu smoke verification

## 검사 기준

- 메뉴 목록: `lib/menu.ts`의 `usGroupsFor(role)` 결과에서 clickable `href`만 동적 수집
- 역할: `gm`, `ceo`, `mgr`, `road`, `road_head`, `water`, `water_head`
- 검사: HTTP 오류, JSON 응답, blank page, ADOMS 공통 Shell 누락, 사용자에게 노출된 내부 오류 문자열, HTML이 참조하는 JavaScript/CSS asset 응답
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

기준 URL: `https://adoms-runtime.netlify.app`
기준 commit: `9fc6b33`

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

- 확인한 JavaScript/CSS asset: 66개, 실패 0
- 깨진 화면: 없음
- HTTP 500/502/503/504: 0
- raw internal/error page: 0
- blank page: 0
- 잘못된 role menu: 0
- 동시에 열린 dropdown: 0
- 실제 클릭: 핵심 READ 화면에서 `법 의무사항 → 사업장` 이동 후 일반 `/law/ws` 화면 render PASS
- 역할 전환: `ceo → road`에서 URL, selector, modal 역할명이 일치하고 `road` 법 메뉴는 대상별 의무사항 3개만 표시

초기 Production 검사에서는 Railway process memory에 남은 이전 배포 HTML과 Netlify의 새 immutable chunk가 불일치해 JavaScript 4개가 404였고, 보이는 화면이 hydrate되지 않아 GNB와 역할 변경이 동작하지 않았다. 응답 cache key에 source revision을 포함하고, Railway가 렌더링한 핵심 화면의 `/_next/static/*`는 같은 Railway build에서 전달하되 해당 asset이 없으면 Netlify 자체 build asset으로 fallback하도록 수정했다. 수정 후 핵심 화면과 일반 화면 양쪽에서 client interaction을 확인했다.
