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

### [15] PostgreSQL baseline data import dry-run
- 상태: 보류
- 배경: Railway PostgreSQL의 빈 `adoms2` schema에 현재 CSV 및 overlay 기반 화면 결과를 같은 의미로 옮기기 전에, 실제 앱의 판 선택과 병합 규칙을 재현한 적재 계획을 검증해야 했다.
- 결정: `us_*` 내림차순 후 `ops_*` 내림차순에서 table별 최초 CSV 한 개만 사용하고, 91개 물리 table만 대상으로 한다. `task_approval_patch`는 `compliance_task`에 병합하며 overlay는 현재 읽기 순서대로 반영한다. 빈 문자열과 TEXT 값은 그대로 보존하고 충돌이나 근거 없는 column 변환이 있으면 실제 적재를 중단한다.
- 이유: 과거 판 누적, 빈 문자열 변환, 고아 patch 또는 감사 로그의 임의 column 대응으로 현재 화면 의미가 달라지는 것을 방지하기 위해서다.
- 영향 범위: 향후 Railway PostgreSQL baseline data 적재, CSV/overlay와 DB 결과 동등성, 감사 로그 mapping 결정
- 실제 변경: dry-run 전용 `db/import/import_baseline.mjs`, 계획서와 91개 table manifest를 추가했다. Railway 접속과 INSERT는 수행하지 않았고 앱 코드, migration SQL, 원본 CSV 및 `.data`는 수정하지 않았다.
- 검증: 선택 seed 24,668행, overlay INSERT 후보 354행, 적용 가능한 overlay PATCH 49건, 최종 예상 25,022행, 활성 PK 중복 0건, DB/source table mapping 누락 0건을 확인했다. 최신 `compliance_task`에 없는 `TSK-000782` overlay patch와 `audit_log` column 대응이 미결이라 실제 적재는 보류한다.
- 관련 파일: `db/import/import_baseline.mjs`, `db/import/IMPORT_PLAN.md`, `db/import/import_manifest.csv`, `WORKLOG.md`
- 관련 commit: pending

### [16] Baseline import 차단 원인 해소 결정 및 재검증
- 상태: 완료
- 배경: 최초 dry-run에서 삭제된 과제 `TSK-000782`의 오래된 overlay patch 1건과 `audit_log`의 `target`, `what` 보존 위치가 확정되지 않아 실제 적재가 차단됐다.
- 결정: `TSK-000782` patch는 현재 운영 데이터에 적용하거나 다른 ID로 연결하지 않고 원문과 출처를 migration provenance에 보존한다. 감사 로그는 `changed_at`, `changed_by`를 canonical로 유지하고 `target TEXT`, `what TEXT`만 추가한다. overlay 감사로그 241행은 truncate하지 않고 전부 적재 대상으로 유지하며 화면 정렬과 100행 제한은 향후 DB adapter에서 재현한다.
- 이유: 삭제된 업무를 되살리거나 과거 patch를 다른 업무에 오적용하지 않으면서 이력 원문은 보존하고, 감사로그 field를 합치거나 버리지 않고 현재 의미를 그대로 유지하기 위해서다.
- 영향 범위: Railway PostgreSQL의 후속 schema migration, baseline import, migration provenance, 향후 DB adapter의 감사로그 alias·정렬·limit
- 실제 변경: `db/migrations/0004_import_compat.sql` 초안을 추가하고 dry-run import가 확정 orphan을 운영 UPDATE에서 제외해 `db/import/migration_provenance.json`에 보존하도록 변경했다. 감사로그는 6개 overlay field를 확정 mapping으로 변환한다. Railway migration 실행과 data INSERT, 앱 코드 변경은 수행하지 않았다.
- 검증: dry-run은 `READY`다. seed 24,668행, overlay INSERT 354행, overlay PATCH 49건, orphan 제외 1건, provenance 보존 1건, 최종 예상 25,022행이다. 감사로그 241/241행을 무손실 mapping했고 PK 중복 0건, 미해결 patch 0건, DB/source table mapping 누락 0건, source column 누락 table 0개를 확인했다.
- 관련 파일: `db/migrations/0004_import_compat.sql`, `db/import/import_baseline.mjs`, `db/import/IMPORT_PLAN.md`, `db/import/import_manifest.csv`, `db/import/migration_provenance.json`, `db/import/BLOCKER_RESOLUTION.md`, `WORKLOG.md`
- 관련 commit: pending

### [17] Railway import 호환 migration 적용 및 baseline import rollback
- 상태: 보류
- 배경: dry-run이 `READY`인 baseline을 Railway PostgreSQL에 적재하기 전에 `audit_log.target`, `audit_log.what`을 추가하고, 전체 적재와 내용 검증을 하나의 transaction으로 수행하려 했다.
- 결정: `0004_import_compat.sql` 적용 결과는 유지한다. baseline import 실패에 대해 스키마나 데이터를 임의 보정하지 않고 transaction rollback 상태를 보존하며, importer가 identity column을 INSERT 대상에서 제외하도록 수정·재검증되기 전에는 재적재와 앱 전환을 수행하지 않는다.
- 이유: PostgreSQL catalog에서 `audit_log.log_id`는 `is_identity = YES`, `is_generated = NEVER`인 `NOT NULL` column인데 importer가 `is_generated`만 확인해 `log_id`에 `NULL`을 전달하면서 SQLSTATE `23502`가 발생했다. migration SQL이나 원본 데이터의 문제가 아니라 importer의 server-generated column 판별 누락이다.
- 영향 범위: Railway PostgreSQL `adoms2.audit_log`, baseline import script, import 검증, 향후 PostgreSQL adapter 전환
- 실제 변경: `0004_import_compat.sql`을 별도 transaction으로 적용해 `audit_log.target TEXT`, `audit_log.what TEXT`를 추가했다. 이어진 baseline import는 첫 `audit_log` INSERT 오류로 중단하고 전체 transaction을 rollback했다. seed/data는 커밋되지 않았고 앱은 계속 CSV + overlay mode다.
- 검증: 0004 적용 후 TABLE 91, VIEW 4, PK 52, 활성 FK 0, 전체 0행을 확인했다. import 실패 후 다시 직접 실측하여 TABLE 91, VIEW 4, PK 52, 활성 FK 0, 전체 0행, 비어 있지 않은 table 0개를 확인했다. `TSK-000782`를 포함한 어떠한 baseline 행도 DB에 남지 않았다.
- 관련 파일: `db/migrations/0004_import_compat.sql`, `db/import/import_baseline.mjs`, `db/import/IMPORT_VERIFY.md`, `db/import/import_verify.csv`, `WORKLOG.md`
- 관련 commit: pending

### [18] Identity column 처리 수정 및 baseline import 재시도 rollback
- 상태: 보류
- 배경: 첫 baseline import가 `audit_log.log_id` identity column에 명시적 `NULL`을 전달해 실패했으므로, Railway catalog의 identity column 전수와 source 식별값 보존 필요성을 먼저 확인했다.
- 결정: importer는 `information_schema.columns.is_identity`와 `identity_generation`을 읽어 INSERT column을 결정한다. source row에 identity 값이 전혀 없으면 DB 생성용 surrogate로서 제외한다. source 값이 일부만 있거나 `ALWAYS` identity에 값이 있으면 임의 생성·제외하지 않고 차단한다. `BY DEFAULT` identity에 모든 source 값이 있으면 기존 식별값을 보존한다.
- 이유: 명시적 `NULL`로 identity 생성을 막지 않으면서도 기존 식별값과 참조관계를 임의 재발번으로 훼손하지 않기 위해서다. 실측된 유일한 identity는 `adoms2.audit_log.log_id`이고, 241개 `overlay.log` source row에 값이 없으며 다른 source가 이를 참조하지 않는 단순 surrogate key다. `usf_ceo_log.log_id`는 별도 table의 text 업무 식별자이므로 이 결정 대상이 아니다.
- 영향 범위: baseline import column 선택, identity 식별값 보존, audit log 적재, Railway PostgreSQL data import
- 실제 변경: importer가 live catalog의 identity 속성과 source 값 존재 수를 비교하도록 수정했다. `audit_log.log_id`는 INSERT 목록에서 제외하고 PostgreSQL이 생성하도록 했다. 첫 실패 보고서는 별도 파일로 보존했다. 수정 후 실제 import를 단일 transaction으로 재시도했으나 장시간 처리 중 외부 DB 연결이 종료되어 commit되지 않았다.
- 검증: 수정 후 dry-run은 `READY`이며 final 25,022행, PK 중복 0, source mapping 누락 0, source column 누락 table 0을 유지했다. live preflight도 `audit_log.log_id`, `BY DEFAULT`, source 값 0/241, `EXCLUDE_FROM_INSERT`로 판정했다. 연결 종료 후 새 연결로 TABLE 91, 전체 0행, 비어 있지 않은 table 0개를 직접 확인해 transaction rollback을 검증했다. 앱은 계속 CSV + overlay mode다.
- 관련 파일: `db/import/import_baseline.mjs`, `db/import/IDENTITY_AUDIT.md`, `db/import/IMPORT_VERIFY.md`, `db/import/IMPORT_VERIFY_FAILED_20260926.md`, `db/import/import_verify.csv`, `WORKLOG.md`
- 관련 commit: pending

### [19] Railway 내부 baseline import 전환 및 데이터 계보 확정
- 상태: 진행
- 배경: 로컬에서 Railway public connection으로 수행한 실제 적재가 identity 처리 누락과 장시간 연결 종료로 각각 rollback됐다. GraphDB A-Box와 3400 앱 데이터의 직접 변환 관계도 함께 명확히 할 필요가 있었다.
- 결정: 실제 baseline 적재는 Railway 내부의 1회성 임시 실행 환경에서 private `DATABASE_URL`을 사용한다. INSERT는 PostgreSQL parameter 한도를 고려한 batch로 전송하되 전체 적재와 commit 전 검증은 하나의 transaction으로 유지한다. 성공 후 새 연결로 독립 재검증하며, 자동 재실행하지 않는다.
- 이유: public proxy의 장시간 연결 불안정을 피하면서도 부분 적재를 남기지 않고, 현재 앱이 실제 사용하는 frozen CSV와 overlay만을 재현하기 위해서다.
- 영향 범위: baseline importer 실행 위치, DB 연결 방식, INSERT 전송 단위, transaction 및 재검증, migration provenance
- 실제 변경: importer가 private `DATABASE_URL`만 사용하도록 변경하고 batch 상한을 500행으로 확장했다. `pg` runtime dependency와 Node 범위를 명시했다. PostgreSQL baseline의 직접 정본은 현재 frozen 앱 CSV와 `.data/overlay.json`이며 최신 GraphDB 전체의 관계형 복제본이 아니라는 계보를 provenance에 추가했다. GraphDB A-Box 현재 판은 `R-20260926-06`, 앱 base는 `R-20260917-02`, 앱 lawtext는 `R-20260920-10`이며 3400 경로에는 N-Quads에서 CSV로 역변환하는 단계가 없다.
- 검증: 변경 후 dry-run은 seed 24,668행, overlay INSERT 354행, overlay PATCH 49건, 최종 25,022행, PK 중복 0, source mapping 누락 0으로 `READY`다. 실제 내부 적재와 최종 소요시간 기록은 아직 진행 전이다.
- 관련 파일: `db/import/import_baseline.mjs`, `db/import/migration_provenance.json`, `package.json`, `package-lock.json`, `WORKLOG.md`
- 관련 commit: pending

### [20] 23:00 데모 PostgreSQL baseline 기준점 및 정본·GraphDB 동기화 범위 확정
- 상태: 결정
- 배경: PostgreSQL 적재 기준을 정하기 위해 현재 앱 CSV가 GraphDB/N-Quads에서 생성됐는지, 최신 정본과 같은 시점의 데이터인지 확인했다. 현재 3400 데모 앱은 특정 시점의 CSV + overlay snapshot으로 실행되며, 원본 정본 DB와 GraphDB가 서로 진행상황을 확인하며 관리되는 별도 작업 흐름과 동일한 최신판을 만드는 목적이 아니다.
- 결정: PostgreSQL `adoms2` baseline의 직접 source of truth를 현재 3400 데모 앱이 실제 선택하는 frozen CSV + overlay로 고정한다. 최신 정본을 PostgreSQL에 재투영하거나 GraphDB A-Box를 관계형으로 변환하지 않으며, N-Quads를 CSV로 역변환하지 않는다. 앱 snapshot과 최신 GraphDB 사이의 release 차이는 이번 migration에서 해소하지 않고, 정본 DB와 GraphDB의 release·그래프 관리는 기존 원본 작업 흐름의 책임으로 둔다. 향후 동기화가 필요하면 현재 baseline migration과 분리된 별도 작업으로 설계한다.
- 이유: 이번 migration의 목적은 현재 데모 실행환경의 재현성과 배포 가능성을 확보하는 것이다. 최신 정본·GraphDB 동기화까지 포함하면 현재 앱이 사용하지 않는 데이터와 구조를 다루는 별도의 데이터 통합 프로젝트가 되며, 확인된 release 차이는 migration 오류가 아니라 데모 snapshot의 설계상 상태다.
- 영향 범위: PostgreSQL baseline 데이터 범위, GraphDB와의 정합성 판정, 향후 adapter 전환, 데이터 통합 작업의 경계. GraphDB에는 있으나 PostgreSQL에는 없는 최신 법령·조항·관계, 최신 정본에는 있으나 현재 데모 화면에는 없는 데이터, 서로 다른 release timestamp는 이번 baseline의 정상 상태로 본다.
- 실제 변경: 작업 우선순위를 ① 현재 앱 CSV + overlay의 PostgreSQL 적재 완료, ② 기존 앱 출력과 PostgreSQL 출력의 동등성 검증, ③ PostgreSQL adapter 연결, ④ 데모 화면 정상 동작 확인, ⑤ UI 수정사항을 모아 순차 반영하는 순서로 고정했다. 정본·GraphDB 구조 분석은 현재 migration의 실제 blocker가 발생할 때만 다시 수행한다. 데이터나 앱 코드는 변경하지 않았다.
- 검증: 앱 base는 `R-20260917-02`, 앱 lawtext는 `R-20260920-10`, GraphDB A-Box는 `R-20260926-06`이다. `ops_*`와 `us_*` 데이터는 base·mgmt 키 및 데모용 조사·예시 자료에서 별도 build script로 생성된다. 3400 앱 코드에는 GraphDB/SPARQL 호출이 없고 앱 데이터 생성 경로에는 N-Quads → CSV 변환이 없다. GraphDB A-Box와 앱 데이터는 공통 정본 계열에서 서로 다른 경로와 release 시점으로 생성됐으며, 현재 앱은 CSV + overlay mode로 정상 동작한다.
- 관련 파일: `data/_데모_용인시_20260920/_CURRENT.json`, `data/_데모_용인시_20260920/_build/build_demo_db.py`, `data/_데모_용인시_20260920/_build/build_ops_tables.py`, `data/_데모_용인시_20260920/_build/build_us_*.py`, `db/import/migration_provenance.json`, `db/import/import_baseline.mjs`, `WORKLOG.md`
- 관련 commit: pending

### [21] Railway 내부 PostgreSQL baseline 적재 완료
- 상태: 완료
- 배경: 로컬에서 Railway public connection으로 수행한 두 번의 실제 적재는 `audit_log.log_id` identity 처리 누락과 외부 연결 종료로 각각 전체 rollback됐다. 이후 Railway 내부 private 연결을 사용하는 1회성 실행으로 전환했으며, commit 전 검증 과정에서 PK metadata 반환형과 patch 후 overlay INSERT 존재 판정 문제도 발견되어 모두 rollback 상태에서 검증 로직만 보정했다.
- 결정: 현재 frozen 앱 CSV + overlay 25,022행을 `adoms2`의 관계형 baseline으로 확정한다. INSERT는 batch로 전송하되 전체 적재와 commit 전 검증은 단일 transaction으로 유지한다. `usc_record`, `usd_record`처럼 물리 PK가 없는 table의 overlay INSERT 존재는 앱 patch가 사용하는 안정 키 `rec_id`로 확인한다. 성공 후에는 새 연결에서 독립 재검증하고, 1회성 서비스의 GitHub 자동 배포를 비활성화한다. 앱의 PostgreSQL adapter 전환은 별도 후속 작업으로 둔다.
- 이유: public proxy의 장시간 연결 불안정을 피하고 부분 적재를 방지하면서, overlay INSERT 후 PATCH로 값이 변경되는 행을 원본 전체값이 아니라 현재 앱의 식별 계약으로 정확히 검증하기 위해서다.
- 영향 범위: Railway PostgreSQL `adoms2` baseline data, baseline importer 검증, 임시 import service 운영, 향후 PostgreSQL adapter 전환
- 실제 변경: Railway GitHub 연동 저장소 접근 범위를 `maenglion/ADOMS_SAPA` 하나로 제한했다. 비어 있고 서비스·환경변수 참조가 없던 `enclosed-stashbox`, `lightweight-chest`를 삭제했다. 임시 서비스 `sapa-baseline-import-once`에서 private `DATABASE_URL`로 baseline을 적재했고, 완료 후 branch 자동 배포를 비활성화했으며 restart policy는 `Never`를 유지했다. PostgreSQL에는 seed 24,668행과 overlay INSERT 354행이 반영되어 총 25,022행이 됐고 overlay PATCH 49건도 최종값에 반영됐다. `TSK-000782`는 운영 데이터에서 제외하고 provenance 1건으로 보존했다. 앱은 아직 CSV + overlay mode이며 PostgreSQL adapter나 Netlify DB mode 전환은 수행하지 않았다.
- 검증: 실행 직전 TABLE 91, 총 0행, 활성 FK 0, `audit_log.target`·`what` 존재를 확인했다. commit 전 전체 검증과 commit 후 새 연결 독립 검증이 모두 통과했다. 최종 실측은 총 25,022행, table별 expected=actual 91/91, canonical checksum 91/91, PK 중복 0, overlay INSERT 354/354, overlay PATCH 49/49, orphan 제외·provenance 보존 1/1, audit log 무손실 241/241, view SELECT 4/4, 활성 FK 0, source mapping 누락 0이다. 실제 import transaction과 commit 전 검증은 1.864초, 새 연결 독립 검증까지 포함한 총 소요시간은 3.078초였다.
- 관련 파일: `db/import/import_baseline.mjs`, `db/import/IMPORT_VERIFY.md`, `db/import/import_verify.csv`, `db/import/migration_provenance.json`, `WORKLOG.md`
- 관련 commit: `439d0e5`, `3a6dbc3`, `66e2feb`, `6ee5338`, `2af798d` (최종 기록 commit은 pending)
