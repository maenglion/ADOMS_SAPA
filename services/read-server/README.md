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
