# ADOMS SAPA READ server

이 서비스는 같은 저장소의 검증된 Next.js 서버 렌더링과 PostgreSQL READ adapter를 Railway 내부에서 실행한다. 별도 데이터 정본이나 영속 상태를 만들지 않는다.

허용하는 화면 단위 GET endpoint는 `/`, `/actions`, `/duties/list`, `/evidence`, `/tasks`뿐이다. 그 밖의 경로와 모든 쓰기 요청은 서비스 경계에서 거부한다. Netlify는 `ADOMS_DATA_BACKEND=read-server`일 때만 이 다섯 경로를 server-to-server로 전달하며, 브라우저에는 인증 token을 노출하지 않는다.

Railway 설정:

- Build command: `npm run build`
- Start command: `node services/read-server/start.mjs`
- Region: Singapore
- `ADOMS_READ_SERVER_SERVICE=1`
- `ADOMS_DATA_BACKEND=postgres`
- `DATABASE_URL=${{Postgres.DATABASE_URL}}`
- `ADOMS_READ_SERVER_TOKEN`: Netlify server 환경과 동일한 임의의 긴 값

`DATABASE_PUBLIC_URL`은 사용하지 않는다.

시연판 READ cache:

- PostgreSQL query 결과와 semantic READ 결과는 READ server process 수명 동안 재사용한다.
- 핵심 5화면의 최종 HTTP 결과는 HTML과 RSC/prefetch representation을 분리한 key로 최대 256개까지 메모리에 보존한다.
- 기준일은 Asia/Seoul 날짜를 cache key에 포함한다.
- 시작 시 dashboard, `/duties/list`, `/evidence`, `/tasks`의 총괄 화면과 `/actions`의 `gm`, `road`, `road_head`, `ceo` 역할을 prewarm한다.
- prewarm이 모두 성공해 `READY`가 기록되기 전에는 외부 화면 요청에 503 warming 응답을 반환한다.
- process restart 시 PostgreSQL에서 cache를 다시 생성한다. WRITE가 비활성인 현재 시연 범위에서는 별도 invalidation을 수행하지 않는다.
