# ADOMS 앱 3400 — 시작하기

용인특례시 중대재해 안전보건체계 통합관리 시연 앱(Next.js 15 · App Router · TypeScript · 서버 컴포넌트).
옛 안내 `README.md`(09-21)는 포트·화면 목록이 옛것이다. 자세한 것은 전달 패키지 최상위 `README.md`.

```bash
npm ci
cp .env.example .env.local        # ADOMS_OPS_DIR 에 데이터 판 폴더의 절대 경로
npx next build
npx next start -p 3400 -H 0.0.0.0
```

- 데이터: 코드 밖 폴더(`us_*`·`ops_*`·`lawtext_*`·`law_sync`·`_agent`)를 `ADOMS_OPS_DIR` 로 가리킨다. 09-26 결정으로 저장소 안 `data\` 에 함께 넣었고 `tsconfig.json` `exclude` 에 `"data"` 를 넣어 두었다. `.env.local` 의 `ADOMS_OPS_DIR` 은 절대 경로를 권한다(「오늘 개정 확인」이 파이썬을 띄울 때 작업 폴더를 바꾼다).
- 화면 입력: `.data\overlay.json`(덮개) · 올린 파일 `.data\uploads\` — 09-26 결정: 예시 운영 기록이라 git 에 함께 올린다.
- 역할: 주소 `?role=ceo|gm|mgr|road_head|road|water_head|water`(로그인 없음).
- 데이터 읽기·쓰기는 `lib/data.ts`·`lib/write.ts` 한 곳으로만 한다(화면은 표를 직접 읽거나 고치지 않는다).
- 권한 규칙 `lib/perm.ts` · 메뉴 `lib/menu.ts` · 업무 흐름 `lib/flow.ts` · 이행점검 판정 `app/check/_lib.ts`.
