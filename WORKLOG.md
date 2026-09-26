# ADOMS SAPA Work Log

## 2026-09-26

### [1] 최초 Git baseline 보존 원칙
- 상태: 결정
- 배경: `C:\SAPA-FRONT\repo`는 정민하가 전달한 ADOMS SAPA 시연 앱의 최초 동결본이다.
- 결정: 현재 폴더를 최초 동결 기준선으로 GitHub에 보존하고, baseline commit 전에는 리팩터링·구조 개선·파일 이동을 하지 않는다. 이후 변경은 commit diff로 추적한다.
- 이유: 전달받은 원본 상태와 이후 개발 변경을 명확하게 구분하고 필요할 때 최초 상태를 재현하기 위해서다.
- 영향 범위: 저장소 전체, 향후 변경 및 commit 운영 방식
- 실제 변경: baseline 안전성 검사와 FREEZE 문서 정합성 보정까지 완료했다. 최초 baseline commit은 아직 수행하지 않았다.
- 검증: Git 포함 후보의 ignore 규칙, 대용량 파일, 비밀값, 데이터 포함 범위 및 배포 설정을 점검했다.
- 관련 파일: `.gitignore`, `data/FREEZE.md`, `data/FREEZE_MANIFEST.csv`
- 관련 commit: pending

### [2] FREEZE manifest를 Git 포함 목록과 일치시킴
- 상태: 완료
- 배경: `*.log` 제외 규칙 때문에 `law_sync`의 `_console.log` 3개가 Git에서는 제외되지만 기존 `FREEZE_MANIFEST.csv`에는 포함되어 있었다.
- 결정: `*.log` 제외 원칙을 유지하고 로그를 강제로 포함하지 않는다. Git에 실제 포함되는 동결 데이터만 manifest의 정본 구성으로 선언한다.
- 이유: 실행 로그를 소스 기준선에 포함하지 않으면서도 manifest와 Git checkout 결과를 정확히 일치시키기 위해서다.
- 영향 범위: 데이터 동결 목록과 동결 설명 문서
- 실제 변경: `_console.log` 3개를 manifest에서 제외하고 `FREEZE_MANIFEST.csv`와 `FREEZE.md`의 파일 수와 설명을 Git 포함 기준으로 갱신했다. 원본 로그 파일과 데이터 내용은 수정하지 않았다.
- 검증: manifest 2,519개 전 파일의 크기와 SHA-256이 일치했다. manifest와 Git 포함 대상의 양방향 불일치는 0개이며, 제외된 로그 3개는 `*.log` 규칙으로 계속 무시된다.
- 관련 파일: `data/FREEZE_MANIFEST.csv`, `data/FREEZE.md`, `.gitignore`
- 관련 commit: pending

### [3] 초기 배포 구조
- 상태: 결정
- 배경: 현재 앱은 Next.js 15, React 19, TypeScript로 구성된 단일 코드베이스이며 화면, Server Actions, Route Handlers가 같은 저장소에 있다.
- 결정: GitHub는 소스와 기준선을 관리하고 Railway에서 현재 Next.js 앱을 실행한다. 현 단계에서는 별도 backend 서비스를 만들지 않으며 PostgreSQL은 Railway에 둔다.
- 이유: 최초 배포 단계에서 서비스 수와 운영 복잡도를 늘리지 않고 현재 애플리케이션 구조를 유지하기 위해서다.
- 영향 범위: 배포 구성, 애플리케이션 경계, 데이터베이스 위치
- 실제 변경: 배포 구조 변경은 아직 수행하지 않았다. Railway용 포트, 데이터 경로, 영속 스토리지 및 Node/Python 런타임 설정도 아직 적용하지 않았다.
- 검증: 현재 `package.json`의 build/start 명령과 Railway 배포 시 필요한 설정 항목을 점검했다.
- 관련 파일: `package.json`, `next.config.ts`, `lib/data.ts`, `lib/write.ts`, `lib/storage.ts`, `lib/lawsync.ts`
- 관련 commit: pending

### [4] 최초 baseline의 CSV 및 overlay 데이터 보존
- 상태: 결정
- 배경: 현재 시연 동작은 `data/`의 CSV 데이터 판과 `.data/overlay.json` 및 업로드 파일을 사용해 재현할 수 있다.
- 결정: 최초 baseline에는 `data/`와 `.data/`를 보존한다. PostgreSQL 이관이 검증된 이후 runtime 데이터의 기준을 DB로 이전한다.
- 이유: DB 이관 전에 현재 시연 상태와 입력 결과를 잃지 않고 동일하게 재현하기 위해서다.
- 영향 범위: `data/`, `.data/`, 데이터 접근·쓰기·파일 저장 경로, 향후 PostgreSQL 이관
- 실제 변경: `data/`와 `.data/`는 Git 포함 대상으로 유지했다. PostgreSQL 이관은 아직 수행하지 않았다.
- 검증: 동결 대상 2,519개 파일이 manifest와 일치하며 전 파일의 SHA-256 검증을 통과했다.
- 관련 파일: `data/`, `.data/`, `lib/data.ts`, `lib/write.ts`, `lib/storage.ts`
- 관련 commit: pending

### [5] Graph/RDF 적용 시점
- 상태: 보류
- 배경: 현재 시연 앱은 GraphDB를 사용하지 않으며 현재 배포에 RDF 계층이 필요하지 않다. 기존 ADOMS RDF/N-Quads 자산은 별도 기준 자산으로 존재한다.
- 결정: 현재 배포 단계에서는 RDF/Fuseki를 구현하지 않는다. 향후 ontology 또는 residual 기능이 필요해질 때 Fuseki 기반 RDF 계층을 연결할 수 있는 가능성만 보존한다. 기존 RDF/N-Quads 자산은 별도 기준 자산으로 보존한다.
- 이유: 초기 배포의 필수 범위를 넘어서는 인프라를 추가하지 않으면서 향후 확장 경로는 닫지 않기 위해서다.
- 영향 범위: 데이터 아키텍처, ontology 연계, 향후 GraphDB/Fuseki 구성
- 실제 변경: GraphDB, RDF 및 Fuseki 관련 구현이나 배포 변경은 수행하지 않았다.
- 검증: 현재 앱 코드와 배포 구조에 GraphDB 런타임 의존성이 없음을 기준으로 결정했다.
- 관련 파일: 없음
- 관련 commit: pending

### [6] residual 구조 도입 시점
- 상태: 보류
- 배경: 현재 시연 앱 배포에는 residual 처리가 선행조건이 아니며, 판단에 필요한 운영·실험 데이터도 먼저 축적되어야 한다.
- 결정: 운영·실험 데이터가 쌓인 뒤 residual 구조를 추가한다. ontology 확장은 residual 처리의 가능한 경로 중 하나로 둔다.
- 이유: 검증 데이터 없이 구조를 선행 구현하지 않고 실제 데이터와 운영 요구를 기준으로 설계하기 위해서다.
- 영향 범위: 향후 판정 로직, 분석 계층, ontology 연계
- 실제 변경: residual 관련 코드·DB·배포 구조는 추가하지 않았다.
- 검증: 현재 배포 범위의 선행조건에서 residual을 제외했다.
- 관련 파일: 없음
- 관련 commit: pending

### [7] 고객별 화면 확장 방식
- 상태: 결정
- 배경: 고객별 요구가 생길 수 있지만 고객마다 영구 branch를 운영하면 공통 기능과 데이터 계약의 변경을 동기화하기 어렵다.
- 결정: 고객별 영구 branch로 분리하지 않는다. 공통 코드와 데이터 계약을 유지하고, 필요하면 같은 저장소 안에서 고객별 `app` 또는 `config` 구조로 확장한다.
- 이유: 공통 기능의 단일 기준을 유지하면서 고객별 차이를 명시적인 구성으로 관리하기 위해서다.
- 영향 범위: 저장소 구조, 화면 구성, 고객별 설정, branch 운영 방식
- 실제 변경: 고객별 디렉터리나 설정 구조는 아직 추가하지 않았다.
- 검증: 향후 고객별 요구가 확정될 때 공통 데이터 계약과 변경 격리 방식을 함께 검증한다.
- 관련 파일: 없음
- 관련 commit: pending

### [8] 주요 작업 및 의사결정 기록 원칙
- 상태: 완료
- 배경: 기술 구조, 데이터 이관, 배포, 판정 로직 및 운영 방식의 변경 이유와 실제 결과를 시간순으로 추적할 기준 문서가 필요하다.
- 결정: 주요 결정과 작업 결과를 `WORKLOG.md`에 계속 누적한다. 사용한 작업 주체나 도구, 대화 내용, 사소한 명령 실행은 기록하지 않는다. 결정이 바뀌면 과거 기록을 지우지 않고 새 항목에 변경 이유를 남긴다.
- 이유: 구현 상태와 결정 근거를 사실 중심으로 보존하고, 완료된 작업과 아직 수행되지 않은 결정을 명확히 구분하기 위해서다.
- 영향 범위: 향후 모든 주요 기술·데이터·배포·운영 변경
- 실제 변경: 프로젝트 루트에 `WORKLOG.md`를 생성하고 현재까지 확정된 결정과 완료 결과를 최초 기록으로 작성했다.
- 검증: 각 항목에 상태, 배경, 결정, 이유, 영향 범위, 실제 변경, 검증, 관련 파일 및 commit 상태를 구분해 기록했다.
- 관련 파일: `WORKLOG.md`
- 관련 commit: pending

### [9] 초기 웹 배포 대상 Netlify로 변경
- 상태: 결정
- 배경: 현재 앱은 Next.js 단일 코드베이스이며 React 화면과 Server Actions, Route Handlers가 함께 있다.
- 결정: 최초 웹 배포는 GitHub 저장소를 Netlify에 연결하여 현재 Next.js 앱 전체를 실행한다. Railway는 우선 PostgreSQL 용도로 사용한다. 별도 backend 서비스 분리는 현재 수행하지 않는다.
- 이유: 현재 구조를 최소 변경으로 원격 재현하고, 프론트와 서버 로직을 조기에 분리하면서 발생할 수 있는 회귀를 피하기 위해서다.
- 영향 범위: 웹 배포, 서버 실행 위치, Railway 구성
- 실제 변경: 아직 배포 전.
- 검증: `package.json` 및 `package-lock.json`이 baseline에 포함되어 있으며 `node_modules`와 Next.js build output은 Git 제외 상태다.
- 관련 파일: `package.json`, `package-lock.json`, `next.config.ts`
- 관련 commit: pending

### [10] 최초 웹 배포 및 PostgreSQL 준비 상태
- 상태: 완료
- 배경: 최초 웹 배포 대상 변경 결정 이후 실제 배포와 데이터베이스 준비 상태를 기록할 필요가 있다.
- 결정: 웹 앱은 Netlify에서 실행하고 Railway PostgreSQL은 이후 데이터 이관 대상으로 유지한다.
- 이유: 현재 Next.js 단일 코드베이스를 먼저 원격 재현하고, 스키마와 데이터는 감사 결과를 기준으로 별도 이관하기 위해서다.
- 영향 범위: Netlify 웹 배포, Railway PostgreSQL, 런타임 환경변수, 향후 데이터 이관
- 실제 변경: Netlify 최초 배포를 완료했고 Railway PostgreSQL을 생성했다. Netlify에 `DATABASE_URL` 환경변수를 설정했다. PostgreSQL에는 아직 schema와 data를 적재하지 않았으며 현재 앱 코드도 `DATABASE_URL`을 사용하지 않는다.
- 검증: 배포 완료 상태와 환경변수 설정 상태를 확인했다. 데이터베이스 접속 및 schema/data 생성·적재 검증은 수행하지 않았다.
- 관련 파일: `WORKLOG.md`
- 관련 commit: pending

### [11] PostgreSQL 호환 migration 초안 작성
- 상태: 완료
- 배경: schema audit에서 확정한 95개 물리 객체를 현재 CSV/overlay 의미와 출력값을 유지한 채 PostgreSQL로 옮길 초안이 필요하다.
- 결정: 91개 표와 필수 뷰 4개의 migration 초안을 작성한다. 사용자 데이터 칼럼은 빈 문자열과 문자열 출력 계약을 보존하도록 1차에서 nullable `TEXT` 중심으로 두며, 실행 DDL 근거가 있는 기존 PK만 활성화한다. 확인된 FK 51개는 빈 문자열·orphan 정책이 정해질 때까지 비활성 후보로 남긴다.
- 이유: 타입·NULL·default·FK 강제로 현재 화면 결과나 쓰기 동작이 달라지는 것을 막고, 실행 전에 미결 사항을 명시적으로 검증하기 위해서다.
- 영향 범위: 향후 Railway PostgreSQL schema, 데이터 적재 순서, PK/FK 활성화, CSV/DB 결과 동등성
- 실제 변경: `db/migrations/0001_tables.sql`, `0002_constraints.sql`, `0003_views.sql`과 결정 기록 `db/MIGRATION_DECISIONS.md`를 추가했다. DB 접속과 SQL 실행 및 데이터 적재는 하지 않았다.
- 검증: CREATE TABLE/VIEW 수, PK 및 FK 후보 수, UNKNOWN→TEXT 반영 수, 참조 칼럼 존재 여부와 SQL 구문 구조를 정적으로 검사한다.
- 관련 파일: `db/migrations/0001_tables.sql`, `db/migrations/0002_constraints.sql`, `db/migrations/0003_views.sql`, `db/MIGRATION_DECISIONS.md`, `WORKLOG.md`
- 관련 commit: pending

### [12] Railway PostgreSQL schema 적용 보류
- 상태: 보류
- 배경: 빈 Railway PostgreSQL에 schema migration만 단일 transaction으로 적용하고 물리 객체 및 데이터 부재를 직접 검증할 예정이었다.
- 결정: 연결 정보가 완전한 PostgreSQL URI로 확인되기 전에는 migration을 실행하지 않는다. 사용자명·비밀번호·데이터베이스명을 임의로 추정하지 않는다.
- 이유: 현재 Netlify의 `DATABASE_URL` 값은 `host:port` 형식으로만 설정되어 URI scheme, 사용자명, 비밀번호 및 데이터베이스명이 없어 안전한 DB 연결을 만들 수 없다.
- 영향 범위: Railway PostgreSQL schema 적용, DB catalog 실측 검증, 이후 데이터 이관
- 실제 변경: 연결 사전검증 단계에서 중단했다. `0001_tables.sql`, `0002_constraints.sql`, `0003_views.sql`은 모두 미실행이며 migration 원본과 앱 코드, CSV 및 `.data`는 수정하지 않았다. schema 적용 여부와 table/view/PK/FK 수치는 미측정이며 data도 적재하지 않았다.
- 검증: 환경변수 존재 여부와 값의 연결 URI 형식을 확인했다. DB 연결, transaction 시작, schema 생성 및 row count 검증은 수행되지 않았다.
- 관련 파일: `db/SCHEMA_DEPLOY_VERIFY.md`, `WORKLOG.md`
- 관련 commit: pending

### [13] Railway PostgreSQL schema 적용 재시도 보류
- 상태: 보류
- 배경: Netlify의 `DATABASE_URL`을 Railway 외부 접속용 전체 URI로 수정했다는 확인 후 기존 schema 적용 계획을 다시 수행했다.
- 결정: 실제 저장된 연결값이 완전한 PostgreSQL URI로 확인되지 않으면 migration을 실행하지 않는다. 이전 실패 기록은 유지하고 재시도 결과를 별도 항목으로 누적한다.
- 이유: Netlify `adoms-runtime` 프로젝트의 Production `DATABASE_URL`을 새로 불러와 재검증했으나 값이 여전히 27자의 `host:port` 형식이었고 scheme, 사용자명, 비밀번호 및 데이터베이스 경로가 없었다.
- 영향 범위: Railway PostgreSQL 연결, schema 적용, DB catalog와 row count 실측
- 실제 변경: 연결 사전검증에서 다시 중단했다. 세 migration, transaction, schema 변경 및 data 적재는 수행하지 않았다. 앱 코드, migration SQL, CSV 및 `.data`도 수정하지 않았다.
- 검증: 페이지를 새로 불러온 뒤 Production 환경변수 형식을 재확인했다. TABLE, VIEW, PK, FK 및 row count는 DB 미접속으로 모두 미측정이다.
- 관련 파일: `db/SCHEMA_DEPLOY_VERIFY.md`, `WORKLOG.md`
- 관련 commit: pending

### [14] Railway PostgreSQL schema 적용 및 실측 완료
- 상태: 완료
- 배경: Railway 내부 접속용 `DATABASE_URL`과 외부 접속용 `DATABASE_PUBLIC_URL`이 구분되어 설정된 뒤 외부 URL로 schema 적용을 재시도했다.
- 결정: 외부 실행 환경에서는 `DATABASE_PUBLIC_URL`로 접속하고, migration 세 파일을 단일 transaction과 오류 즉시 중단 조건으로 적용한다. FK 후보 51개는 비활성 상태를 유지하며 seed/data는 적재하지 않는다.
- 이유: `DATABASE_URL`의 `railway.internal` 호스트는 Railway 내부 네트워크 전용이고, 현재 실행 위치에서는 외부 접속용 URL이 필요하기 때문이다.
- 영향 범위: Railway PostgreSQL `adoms2` schema, 향후 data migration 및 애플리케이션 DB 전환
- 실제 변경: 빈 Railway PostgreSQL에 `0001_tables.sql`, `0002_constraints.sql`, `0003_views.sql`을 순서대로 한 transaction에서 적용했다. `adoms2` schema에 table 91개와 view 4개가 생성됐다. data는 적재하지 않았다. 앱 코드, migration SQL, CSV 및 `.data`는 수정하지 않았다.
- 검증: TABLE 91, VIEW 4, PK 52, 활성 FK 0, 중복 이름 0을 DB catalog에서 확인했다. view 4개는 모두 참조 검증을 통과했고, table 91개의 실제 row count와 전체 합계가 모두 0이었다.
- 관련 파일: `db/migrations/0001_tables.sql`, `db/migrations/0002_constraints.sql`, `db/migrations/0003_views.sql`, `db/SCHEMA_DEPLOY_VERIFY.md`, `WORKLOG.md`
- 관련 commit: pending
