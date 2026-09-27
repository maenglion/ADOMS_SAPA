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

### [22] PostgreSQL READ shadow adapter 구현 및 동등성 검증
- 상태: 완료
- 배경: Railway PostgreSQL `adoms2`에 91개 table, 25,022행의 baseline 적재와 table별 count·checksum 검증을 완료했지만 실제 화면은 계속 CSV + overlay를 사용하고 있었다. live source 전환 전에 같은 입력에서 PostgreSQL READ가 현재 화면 계약과 완전히 같은 결과를 내는지 독립적으로 확인할 경로가 필요했다.
- 결정: server-only PostgreSQL READ adapter와 명시적 `ADOMS_DATA_BACKEND` switch를 추가한다. 허용값은 `csv`, `postgres`이고 기본값은 `csv`다. `DATABASE_URL` 존재만으로 전환하지 않는다. 현재 CSV 반환 shape와 값·타입·NULL/빈 문자열·정렬·필터·limit을 정본 계약으로 두고, PostgreSQL은 shadow 비교 대상으로만 사용한다. live 전환 조건은 frozen golden 및 shadow mismatch 0으로 유지한다.
- 이유: Netlify에 이미 `DATABASE_URL`이 있어도 의도하지 않은 source 전환을 막고, schema 정규화나 PostgreSQL type coercion 때문에 기존 화면 결과가 달라지는 회귀를 사전에 차단하기 위해서다. 물리 DB에 없는 CSV 행 순서는 frozen READ order contract로 보존하고, DB schema에만 존재하는 nullable field는 기존 UI 반환 계약에 노출하지 않는다.
- 영향 범위: server-side READ 경로, 환경변수 계약, PostgreSQL connection reuse, audit log alias·정렬·limit, golden 및 shadow 검증. WRITE, upload/storage, schema, FK, UI와 Netlify live backend에는 영향이 없다.
- 실제 변경: `pg` pool 기반 canonical DB access layer, 91개 table·4개 view allowlist, CSV/PostgreSQL backend switch, frozen READ order·comparison contract와 1회성 shadow 검증 경로를 추가했다. `audit_log.changed_at`, `changed_by`는 adapter에서만 `at`, `by`로 alias하고 최신순 100행을 반환한다. 임시 내부 검증 실행이 끝난 뒤 production branch 연결을 해제했고 restart policy `Never`를 유지했다. 앱의 실제 backend는 계속 CSV + overlay다.
- 검증: exported READ 함수 30개와 필터 변형을 포함한 77개 case를 기준시점 `2026-09-26`, `Asia/Seoul`로 비교했다. missing rows, extra rows, value, type, ordering, NULL/빈 문자열 mismatch가 모두 0이었다. 기존 golden은 35주소×4역할, HTML 137개, `golden_values.csv` 7,373줄, key metric 159개, calculation crosscheck 68/68을 유지했다. 계산 JSON 5개는 기준본과 byte-identical이었다. TypeScript 정적 검사와 Next.js production build도 통과했다.
- 관련 파일: `.env.example`, `lib/data-backend.ts`, `lib/db.ts`, `lib/data.ts`, `lib/read-order.ts`, `scripts/read_contract_snapshot.mjs`, `scripts/verify_read_shadow.mjs`, `db/read-shadow/read_comparison_contract.json`, `db/read-shadow/read_order_contract.json`, `db/read-shadow/read_adapter_compare.json`, `db/read-shadow/read_adapter_compare.csv`, `READ_ADAPTER_VERIFY.md`, `WORKLOG.md`
- 관련 commit: `84465c3`~`bc19fe8`, `8c3b206`

### [23] Netlify PostgreSQL READ Preview 검증 및 Production 전환 보류
- 상태: 보류
- 배경: PostgreSQL baseline 25,022행과 READ shadow mismatch 0 검증을 완료한 뒤, 실제 Netlify 실행환경에서 PostgreSQL READ 경로를 먼저 검증하고 모든 회귀 수치가 0일 때만 Production을 전환하기로 했다. 기준 READ adapter commit은 `749c298c33fc6e58faa727abe5f7dd130f968be9`이다.
- 결정: Preview/branch deploy에만 `ADOMS_DATA_BACKEND=postgres`를 적용하고 Production은 `csv`로 유지한다. Preview에서 회귀 mismatch와 서버 timeout이 확인되어 Production READ cutover를 수행하지 않는다. 재시도 전에는 Preview의 데이터 계약 차이와 `/actions` timeout, 기존 Production CSV 배포의 seed 접근 상태를 해소하고 같은 검증을 다시 통과해야 한다.
- 이유: 수정된 Preview는 PostgreSQL READ로 연결되고 페이지를 렌더링했으나, 137개 read-only 요청 중 4개 `/actions` 역할별 요청이 HTTP 504였고 extracted value mismatch 178건, expected-only 280건, key metric mismatch 16건이 발생했다. zero-mismatch 성공 조건을 충족하지 못했다.
- 영향 범위: Netlify Preview/branch deploy 환경변수와 배포 검증, 향후 Production READ 전환 조건. PostgreSQL schema/data, WRITE 경로, upload/storage, CSV/overlay에는 영향이 없다.
- 실제 변경: Netlify Preview/branch deploy의 backend를 `postgres`, Production backend를 `csv`로 명시했다. Netlify에서 해석할 수 없던 Railway private DB hostname 설정을 기존 외부 접속 URI로 교정해 Preview를 재배포했다. secret 값은 기록하지 않았다. Production은 PostgreSQL로 전환하지 않았고 cutover 시각도 없다. 기존 Production CSV smoke도 golden과 일치하지 않아 별도 배포 seed 경로 문제로 기록했다.
- 검증: Preview deploy/build는 성공했고 runtime backend가 `postgres`임을 확인했다. read-only golden 요청은 133/137 HTTP 200, 4/137 HTTP 504였으며 value mismatch 178, expected-only 280, key metric mismatch 16이었다. audit log는 PostgreSQL 계약인 최신 100행을 반환했다. 검증 뒤 Railway `adoms2`의 전체 row count를 직접 재실측해 25,022행, 변경 0행을 확인했다. Production은 계속 `csv`이며 WRITE는 전환되지 않았다. rollback 방법은 Production `ADOMS_DATA_BACKEND=csv` 설정 후 재배포이고 현재는 이미 해당 상태라 rollback이 필요 없다.
- 관련 파일: `READ_CUTOVER_VERIFY.md`, `db/read-shadow/read_cutover_compare.csv`, `WORKLOG.md`
- 관련 commit: pending

## 2026-09-27

### [24] Netlify 원격 회귀 불일치의 버전 드리프트 가설
- 상태: 결정
- 배경: 로컬에서는 현재 frozen CSV와 그 자료에서 만든 PostgreSQL baseline의 READ shadow mismatch가 0이었지만, Netlify PostgreSQL Preview의 137개 GET 회귀는 HTTP 200 133건, `/actions` HTTP 504 4건, value mismatch 178건, expected-only 280건, key metric mismatch 16건이었다. 동시에 당시 Production CSV 화면도 관리대상 1, 시기도래 0, 기한 초과 0으로 golden과 달라 PostgreSQL 문제만으로 단정할 수 없었다.
- 결정: 당시 우선 가설을 앱 코드와 배포된 데이터 판 사이의 version skew/version drift로 두고, PostgreSQL adapter를 먼저 수정하지 않는다. Netlify CSV mode가 실제 선택하는 data root와 `us_*`, `ops_*`, base·mgmt·lawtext 판을 확인해 Remote CSV baseline부터 복구한다. Remote CSV mismatch가 0이 되기 전에는 PostgreSQL Preview mismatch를 최종 compatibility defect로 확정하지 않는다.
- 이유: 최신 코드가 과거 데이터에 없던 칼럼·값·구조를 기대하거나, 최신 필터·계산식과 다른 seed 판이 결합되면 화면은 렌더링되어도 숫자와 결과가 달라질 수 있다. 코드 버전, 데이터 판, PostgreSQL baseline 판을 분리해 확인해야 원인 경계를 잘못 지정하지 않는다.
- 영향 범위: Netlify 원격 회귀의 조사 순서, PostgreSQL adapter 수정 보류, 앱·데이터·DB 릴리스 식별 방식, Production READ cutover 조건
- 실제 변경: 이 단계에서는 adapter, DB, seed를 변경하지 않았다. 원격 CSV의 data root, seed 선택, deploy artifact 포함 상태를 먼저 조사하는 방향을 확정했다. 후속 조사에서 일반적인 version drift보다 직접적인 원인이 seed CSV의 deploy artifact 누락으로 확인됐으며, 이 가설 기록은 당시의 합리적 판단 과정으로 보존한다.
- 검증: 후속 조사 전 상태에서는 로컬 CSV↔PostgreSQL shadow mismatch 0과 원격 CSV·PostgreSQL 양쪽의 golden 불일치가 동시에 관측됐다. 이후 [25]에서 실제 배포 경로의 직접 원인과 해결 결과를 확정했다.
- 관련 파일: `READ_CUTOVER_VERIFY.md`, `READ_ADAPTER_VERIFY.md`, `db/read-shadow/read_cutover_compare.csv`, `WORKLOG.md`
- 관련 commit: pending

### [25] Netlify 원격 CSV baseline 복구 및 데이터 릴리스 절차 확정
- 상태: 완료
- 배경: Production이 CSV 설정인데도 기존 golden과 다른 값이 관측되어, PostgreSQL Preview 차이를 adapter 문제로 확정하기 전에 Netlify 원격 CSV 자체의 데이터 경로와 동결자료 포함 여부를 검증해야 했다.
- 결정: 동결 데이터의 `us_*` 내림차순, 이어서 `ops_*` 내림차순, table별 최초 CSV 선택 규칙을 배포 artifact에서도 유지한다. 데이터 폴더 전체가 아니라 현재 규칙이 선택한 CSV manifest만 server bundle에 포함한다. CSV 원격 baseline을 먼저 복구하고 같은 commit·같은 Netlify 조건에서 backend 변수만 바꿔 PostgreSQL과 A/B한다. 재현 가능한 앱 릴리스는 app commit, base·mgmt·ops·us·lawtext release, 선택 CSV manifest와 hash, deploy artifact 포함 상태, PostgreSQL import manifest, golden 결과를 하나의 호환 세트로 고정한다.
- 이유: 기존 Netlify 실행환경에는 저장소 밖 기본 data path가 없고 `.data/overlay.json`만 포함됐으며 frozen seed CSV는 0개 포함되어 있었다. 이 상태에서는 CSV 결과와 PostgreSQL 결과를 비교해도 배포 packaging 문제와 adapter 문제를 구분할 수 없다. Git에 파일이 존재하는 사실만으로 runtime 배포를 증명할 수 없고, 전체 137개 회귀 수행시간과 일반 사용자 한 화면 응답시간도 서로 다른 지표다.
- 영향 범위: Netlify branch deploy의 frozen CSV packaging, server-side data root 선택, 원격 CSV/PostgreSQL READ 회귀, Production cutover 조건, 향후 데이터 판 갱신과 릴리스 manifest. Production 설정, WRITE, DB schema/data, 원본 CSV·overlay, golden에는 영향이 없다.
- 실제 변경: 기본 data root가 저장소의 `data/_데모_용인시_20260920`으로 fallback하도록 공통 경로를 추가하고, 현재 선택되는 73개 seed CSV와 form 자료만 server function trace에 포함했다. 안전한 진단 경로는 backend, repo-relative data root, seed directory와 table별 source만 반환하며 credential이나 host 절대경로를 반환하지 않는다. CSV 감사로그 반환은 frozen golden 계약인 overlay 241행과 원래 순서를 유지하도록 복원했다. PostgreSQL A/B 후 branch override를 다시 `csv`로 되돌려 재배포했고 runtime backend가 `csv`임을 확인했다. Production도 계속 `csv`다.
- 검증: CSV Preview는 137/137 HTTP 200, `/actions` 4/4 HTTP 200, golden 7,373/7,373, expected-only 0, extra 0, 안정값 mismatch 0, key metrics 159/159, calculation crosscheck 68/68이다. frozen capture 시각에 종속된 `/exec` 경과시간 4건만 raw 차이로 분리했다. 로컬과 runtime의 선택 table 73개 source path 불일치는 0이다. 같은 commit의 PostgreSQL A/B는 133/137 HTTP 200, `/actions` 4/4 HTTP 504, 안정값 mismatch 26, expected-only 224로 실패했다. 현재 9개 점검 회차의 `/actions` 호출 경로는 정적 계산상 PostgreSQL query 270회를 만들며, 이 중 248회가 회차별 동일 자료를 반복 구성하는 `checkFlagged()` 경로다. 따라서 Production cutover, 최적화 전 성능 합격 처리, 5경로×10회 측정은 보류한다.
- 후속 운영 원칙: 향후 데이터 갱신은 `데이터 판 확정 → 선택 파일 manifest 생성 → Preview artifact bundle → CSV golden → PostgreSQL 반영 → READ shadow → stable 승격 → Production cutover`를 하나의 릴리스 절차로 본다. 현재 73개는 고정 규칙이 아니라 이번 릴리스의 계산 결과다. WRITE 전환 전 데모 DB는 검증된 baseline으로 재생성할 수 있지만, WRITE 전환 후에는 법령·기준표·관리대상 같은 기준/정본층을 migration·upsert로 갱신하고 사용자 입력·업무 상태·실행 기록·증빙의 운영층은 persistent ledger/state로 보존하며 baseline으로 덮어쓰지 않는다. CSV baseline 복구와 릴리스 절차 확정은 완료했지만, PostgreSQL Production READ cutover는 별도 검증 실패로 계속 보류한다.
- 관련 파일: `lib/data-root.ts`, `lib/data.ts`, `lib/forms.ts`, `lib/lawsync.ts`, `app/api/read-source/route.ts`, `next.config.ts`, `.env.example`, `READ_CUTOVER_VERIFY.md`, `db/read-shadow/remote_csv_pg_ab.csv`, `WORKLOG.md`
- 관련 commit: `798e5fb`~`d367cea` (본 기록 정리 commit은 pending)

### [26] PostgreSQL `/actions` 반복 조회 축소 및 전환 보류 유지
- 상태: 완료
- 배경: Netlify 원격 CSV baseline은 137/137 HTTP 200, 안정값 mismatch 0, metrics 159/159, calculation crosscheck 68/68로 복구됐다. 같은 환경의 PostgreSQL Preview에서는 `/actions` 4개 역할이 모두 504였고, 정적 호출 경로상 270회 READ 중 248회가 `checkFlagged()` 안에서 발생했다.
- 결정: `checkFlagged()`의 판정 로직이나 반환값을 다시 쓰지 않고, 한 요청 안에서 동일한 relation·query tuple의 결과만 재사용한다. Production은 계속 `csv`로 유지하며, PostgreSQL stable mismatch가 0이 되기 전에는 대표 5경로 성능 측정과 Production cutover를 진행하지 않는다.
- 이유: 실측 결과 `/actions`의 논리 READ 270회는 고유 tuple 16개와 중복 254회로 구성됐고, `checkFlagged()` 구간은 논리 248회, 고유 tuple 15개, 중복 233회였다. 서로 다른 key를 위한 248개 SELECT가 아니라 동일한 전체표 조회를 반복하던 패턴이므로 request-scoped memoization이 기존 의미를 보존하면서 왕복을 줄이는 최소 변경이다.
- 영향 범위: PostgreSQL server-side READ의 요청 단위 실행과 `/actions` 진단 로그. DB schema·index·data, WRITE, role logic, UI, golden, CSV·overlay에는 영향이 없다.
- 실제 변경: PostgreSQL READ에 요청 단위 exact-query cache와 route/scope 측정을 추가하고 `/actions` 및 `checkFlagged()` 범위에 적용했다. 결과 배열과 각 row의 최상위 객체는 호출마다 새로 만들어 기존 소비자의 변경 격리를 유지한다. 원격 CSV 누락의 직접 원인은 deploy artifact에 선택 seed CSV가 포함되지 않았던 것이며, 이 문제는 앞선 단계에서 선택 manifest를 server bundle에 포함해 복구 완료한 상태다.
- 검증: Preview backend가 `postgres`임을 확인했다. `/actions`는 4역할 모두 HTTP 200으로 복구됐고 물리 SQL은 요청당 270회에서 16회로 감소했다. `checkFlagged()`는 248 logical calls 중 244 cache hits, 추가 물리 SQL 4회였다. 전체 재검증은 HTTP 137/137, golden 7,373/7,373, expected-only 0, extra 0, metrics 159/159, calculation crosscheck 68/68이다. 다만 raw mismatch 32 중 시각 의존 `/exec` 4건을 제외한 stable mismatch 28건이 남아 PostgreSQL compatibility issue로 분류했다. 따라서 5경로×10회 성능 검증과 Production 전환은 계속 보류하며 Production backend는 `csv`다.
- 관련 파일: `lib/db.ts`, `lib/check_merge.ts`, `app/actions/page.tsx`, `READ_CUTOVER_VERIFY.md`, `db/read-shadow/remote_csv_pg_ab.csv`, `WORKLOG.md`
- 관련 commit: `96d78bb` (본 기록 정리 commit은 pending)

### [27] PostgreSQL READ 안정값 mismatch 28건 해소
- 상태: 완료
- 배경: `/actions` timeout을 해소한 뒤 전체 Preview 회귀는 HTTP 137/137, golden 7,373/7,373, metrics 159/159, crosscheck 68/68이었으나 안정값 mismatch 28건이 남았다. 분류는 `/actions` 2건, dashboard ordering 6건, `/duties/list` approval count 4건, `/evidence` audit-log range/order 16건이었다.
- 결정: frozen CSV + overlay runtime을 compatibility contract로 유지하고 네 그룹의 CSV·PostgreSQL READ 경로를 각각 대조한 뒤 adapter/read layer만 최소 수정한다. 시각 의존 `/exec` 4건은 안정값과 계속 분리한다. Production은 성능 검증 전까지 `csv`를 유지한다.
- 이유: PostgreSQL 값이나 정렬이 더 일반적으로 보이더라도 현재 화면의 행 순서, overlay 적용 범위, 논리 함수별 approval layer, 감사로그 범위가 기존 contract다. 물리 schema에 맞춰 화면 의미를 바꾸면 동결 앱 재현 목적을 위반한다.
- 영향 범위: PostgreSQL READ의 action overlay contract, `usb1_workplace` 순서 복원, `tasks()`의 approval-layer 분리, `audit_log` 반환 범위·순서, 검증 진단. DB schema/data, WRITE, UI, role logic, golden, CSV·overlay와 Production backend에는 영향이 없다.
- 실제 변경: `ACT-000006`의 stale READ-order override를 overlay 값 `시정`으로 교정했다. `usb1_workplace` live READ가 overlay 변경이 없을 때 raw CSV 순서를 사용하도록 했다. PostgreSQL `tasks()`는 물리적으로 병합된 `task_approval_patch` 전용 필드를 제거한 뒤 overlay `taskPatch`만 다시 적용하고, 별도 `approvals()`는 기존 병합층을 계속 사용한다. 감사로그는 `changed_at AS at`, `changed_by AS by` alias를 유지하면서 241행 전체를 import 순서로 반환한다. `/actions` request cache 전후의 `CheckFlag[]`를 role별 canonical SHA-256으로 비교할 진단을 추가했다.
- 검증: 네 영향 경로×4역할의 대상 검증은 HTTP 16/16, 추출값 1,117/1,117, mismatch 0, expected-only/extra 0/0이었다. CSV와 PostgreSQL `CheckFlag[]`는 4역할 모두 30행 및 SHA-256이 일치했다. 전체 Preview 회귀는 HTTP 137/137, golden 7,373/7,373, expected-only/extra 0/0, 안정값 mismatch 0, metrics 159/159 mismatch 0, calculation crosscheck 68/68이다. `/exec` 경과시간 4건은 raw 시각 의존 차이로 별도 유지했다. TypeScript, production build, 로컬 READ shadow 77 case도 통과했다. Production은 계속 `csv`이며 5경로 cold/warm 성능 gate와 READ cutover는 별도 후속 작업이다.
- 관련 파일: `lib/data.ts`, `lib/db.ts`, `lib/read-order.ts`, `lib/check_merge.ts`, `db/read-shadow/read_order_contract.json`, `db/read-shadow/remote_csv_pg_ab.csv`, `READ_COMPATIBILITY_VERIFY.md`, `READ_CUTOVER_VERIFY.md`, `WORKLOG.md`
- 관련 commit: `453d469` (최종 기록 commit은 pending)

### [28] PostgreSQL READ 성능 준공점검 및 Production 전환 보류
- 상태: 완료
- 배경: PostgreSQL READ 기능 준공검사는 HTTP 137/137, golden 7,373/7,373, 안정값 mismatch 0, expected-only/extra 0/0, metrics 159/159, crosscheck 68/68로 통과했다. Production cutover 전 마지막 gate로 실제 사용자 한 화면의 CSV·PostgreSQL 응답시간을 같은 Netlify branch 조건에서 비교해야 했다.
- 결정: dashboard, `/actions`, `/duties/list`, `/evidence`, `/tasks`를 대표 경로로 선정해 backend별로 cold 1회와 순차 warm 9회를 측정한다. warm 중앙값을 주 판정값으로 사용한다. PostgreSQL이 전 경로에서 현저히 느리므로 Production READ cutover를 계속 보류하고, 후속 작업은 contract를 유지한 채 PostgreSQL mode의 server 계산·materialization 비용을 줄이는 데 한정한다.
- 이유: PostgreSQL warm 중앙값은 CSV 대비 dashboard 2.46배, `/actions` 4.11배, `/duties/list` 2.47배, `/evidence` 3.13배, `/tasks` 3.03배였다. 가장 느린 `/actions`는 PostgreSQL 14.625초, CSV 3.555초였다. `/actions`의 물리 SQL 16회는 누적 connection acquisition 0.619초, SQL 2.895초, DB 합계 3.514초였지만 server data render는 13.481초여서 약 9.983초의 비DB server 구성·계산이 주 병목으로 확인됐다.
- 영향 범위: PostgreSQL READ Production cutover 판정, 후속 성능 최적화 우선순위, Netlify Preview branch 환경. 기능·데이터 contract, WRITE, DB schema/data, UI, seed, golden에는 영향이 없다.
- 실제 변경: 5개 page에 read 성능 trace 경계를 추가하고 PostgreSQL 계측을 connection acquisition, SQL, 누적 DB work, server data render로 분리했다. 동일 branch와 commit에서 backend 값만 바꿔 총 100회 읽기 요청을 측정했다. A/B 후 Preview branch는 `postgres`로 복구했고 Production은 `csv`를 유지했다. 기능·데이터 로직은 변경하지 않았다.
- 검증: CSV 50/50, PostgreSQL 50/50 HTTP 200이다. 기능 준공 수치는 기존 통과 상태를 유지한다. Production 환경값은 `csv`로 독립 확인했다. Preview 복구 배포는 별도 branch deploy로 실행했다. 상세 raw·요약 수치는 `READ_PERFORMANCE_VERIFY.md`와 `db/read-shadow/read_performance_compare.csv`에 기록했다.
- 관련 파일: `app/page.tsx`, `app/actions/page.tsx`, `app/duties/list/page.tsx`, `app/evidence/page.tsx`, `app/tasks/page.tsx`, `lib/db.ts`, `READ_PERFORMANCE_VERIFY.md`, `READ_CUTOVER_VERIFY.md`, `db/read-shadow/read_performance_compare.csv`, `WORKLOG.md`
- 관련 commit: pending

### [29] 시연판 내부 구현 보존 규칙 완화
- 상태: 결정
- 배경: PostgreSQL READ 기능 호환성은 완료됐지만 대표 경로 성능이 CSV 대비 2.46~4.11배 느려 Production cutover가 차단됐다. 기존 READ/materialization 내부 구조를 그대로 유지하는 해석은 결과와 무관한 반복 계산 제거까지 제약할 수 있었다.
- 결정: 시연판에서는 명시적으로 발행된 앱·데이터 판의 결과 계약이 동일하면 성능을 위해 내부 구현을 변경할 수 있다. request-scoped memoization, 반복 filter/sort/merge 제거, materialization 재구성, SQL batch·병렬화, preload와 Map/Set lookup을 허용한다. 기준은 “최신판을 맞춘다”가 아니라 “명시적으로 발행된 판에 맞춘다”로 고정한다.
- 이유: 시연판의 목적은 기존 내부 구현 보존이 아니라 검증된 사용자 가시 결과를 허용 가능한 속도로 안정적으로 제공하는 것이다. 앱 commit과 데이터 판이 명시된 릴리스 계약을 기준으로 해야 임의의 최신 자료 유입과 구현 차이를 혼동하지 않는다.
- 영향 범위: PostgreSQL READ 내부 구조와 성능 최적화 선택, 릴리스·golden 판정 기준. 화면 결과, 역할별 노출, 숫자, 정렬·필터·limit, golden, metrics, crosscheck는 계속 필수 계약이다.
- 실제 변경: 이번 결정에 따라 `/actions`의 동일 입력 semantic READ 결과를 한 HTTP request 안에서 재사용할 수 있도록 허용했다. 전역 cache나 요청 간 stale cache는 허용하지 않았다.
- 검증: 변경 대상 경로를 우선 검증하고 성능 목표 확인 뒤 명시적으로 발행된 기준시점의 전체 golden regression을 최종 gate로 수행하는 절차를 유지한다.
- 관련 파일: `lib/db.ts`, `READ_PERFORMANCE_VERIFY.md`, `READ_CUTOVER_VERIFY.md`, `WORKLOG.md`
- 관련 commit: `f05c9c2`

### [30] PostgreSQL READ 성능 최적화 1차
- 상태: 완료
- 배경: `/actions`는 물리 SQL이 16회로 줄었지만 270회의 logical READ 뒤에서 같은 normalized result, filter, sort, merge와 판정 결과를 반복 계산해 PostgreSQL warm 중앙값이 14.625초였다. 공통 경로도 CSV보다 느려 DB 접근 비용과 특수 CPU 병목을 분리할 필요가 있었다.
- 결정: `/actions` request 안에서만 동일 함수·동일 인자의 최종 contract 결과를 재사용하고 호출자마다 복제본을 반환한다. SQL tuple cache와 semantic result cache를 분리하며 요청이 끝나면 모두 폐기한다. Production은 계속 `csv`로 유지한다.
- 이유: SQL tuple은 이미 16개뿐이었고 잔여 약 9.983초는 DB 외 materialization 재계산이었다. 동일 입력의 최종 결과를 request 범위에서 재사용하면 freshness와 반환 의미를 바꾸지 않고 반복 작업만 제거할 수 있다.
- 영향 범위: PostgreSQL `/actions` READ 실행, READ 성능 측정과 진단. CSV backend, WRITE, DB schema/data/index, UI, role logic, seed, golden에는 영향이 없다.
- 실제 변경: 공통 READ 계층에 request-scoped semantic result cache와 겹치는 DB 구간을 합산하는 wall-clock 측정을 추가했다. `/actions`에 한정해 `tasks`, `staff`, approval/evidence/inspection 계열과 round/cell/check 파생 결과를 exact argument key로 재사용한다. 실행 함수는 `us-east-2`, PostgreSQL은 Singapore여서 공통 cross-region 비용을 별도 병목으로 기록했다.
- 검증: `/actions`의 SQL-result 계층 logical call은 270회에서 18회로 감소했고 SQL은 16회로 유지됐다. `CheckFlag[]`는 30행, SHA-256 `5c5189aee2610e7b74c0474481a8b9b91b8657284ddb0efa80911682a0d07bc1`로 동일하다. warm 중앙값은 14.625초에서 5.477초로 62.6% 감소했고 비DB server 구간은 약 9.983초에서 1.894초로 줄었다. 명시적으로 발행된 기준시점 회귀는 HTTP 137/137, golden 7,373/7,373, 안정값 mismatch 0, expected-only/extra 0/0, metrics 159/159, crosscheck 68/68로 통과했고 `/exec` raw 4건은 기존 시각 의존 분류를 유지했다. 검증용 시간 고정 설정은 완료 뒤 제거했다. 다만 PostgreSQL은 CSV보다 dashboard 2.41배, `/actions` 1.54배, `/duties/list` 2.60배, `/evidence` 2.99배, `/tasks` 3.07배 느려 Production cutover는 계속 보류한다. TypeScript 검사와 production build는 통과했다.
- 관련 파일: `lib/db.ts`, `instrumentation.ts`, `next.config.ts`, `scripts/freeze_time.cjs`, `db/read-shadow/read_performance_optimization.csv`, `READ_PERFORMANCE_VERIFY.md`, `READ_CUTOVER_VERIFY.md`, `WORKLOG.md`
- 관련 commit: `f663bea`~`f05c9c2`

### [31] 3400 시연판 PostgreSQL 이관 검증 규칙 완화
- 상태: 결정
- 배경: 원본 작업 측 요청에 따라 3400 시연판 PostgreSQL 이관의 완료 기준과 반복 최적화 단계의 검증 범위를 재정의할 필요가 생겼다. 정본·GraphDB와 현재 시연판은 서로 다른 릴리스 계보와 목적을 가지며, 매 최적화 단계마다 전체 전수 검증을 반복하면 성능 개선의 반복 속도가 과도하게 느려진다.
- 결정: 정본·GraphDB 검증은 이번 PostgreSQL 이관 작업 범위에서 제외한다. 동일 입력과 동일 기준일에서의 사용자 가시 결과 동등성을 완료 기준으로 삼는다. 내부 데이터 접근, 계산, materialization 구조는 결과 계약을 유지하는 한 성능 개선을 위해 변경할 수 있다. 반복 최적화 단계에서는 핵심 지표 159개와 계산 JSON 6개를 기준으로 검증하고 전체 전수 검증은 매 단계 반복하지 않는다. 성능 작업은 `서버 계산 중복 제거 → 공통 PostgreSQL overhead 확인 → 대표 5경로 재측정 → Production READ 전환` 순서로 진행한다.
- 이유: 이번 작업의 목적은 최신 정본이나 GraphDB의 관계형 복제본을 만드는 것이 아니라, 명시적으로 발행된 3400 시연판 입력과 기준일의 결과를 PostgreSQL에서 같은 의미와 허용 가능한 속도로 재현하는 것이다. 결과 계약을 지키면서 내부 구조 변경을 허용하고 단계별 검증 비용을 줄여야 실제 병목 개선을 신속하게 반복할 수 있다.
- 영향 범위: PostgreSQL READ 성능 최적화, 단계별 회귀검증 범위, Production READ 전환 순서. 정본·GraphDB 자산, PostgreSQL baseline 데이터, WRITE 경로, 사용자 가시 결과 계약에는 변경이 없다.
- 실제 변경: 검증 및 최적화 운영 원칙만 확정했다. 앱 코드, DB schema/data, 배포 환경, golden 자료는 변경하지 않았다.
- 검증: 후속 반복 최적화는 동일 입력·동일 기준일에서 핵심 지표 159개와 계산 JSON 6개를 우선 gate로 사용한다. 대표 경로 성능 목표를 달성한 뒤 필요한 최종 전수 검증과 Production READ 전환 여부를 별도로 판정한다.
- 관련 파일: `WORKLOG.md`
- 관련 commit: `2c3bee1`

### [32] `/actions` 명시적 READ context 적용 및 서버 계산 병목 축소
- 상태: 완료
- 배경: request-scoped semantic result 재사용으로 `/actions` PostgreSQL warm 중앙값을 14.625초에서 5.477초로 줄였지만, 동일 요청 안에서 회차별 task·approval·evidence·inspection·action·judge·이행기록의 조립과 선형 탐색이 남아 있었다. 시연판은 명시적으로 발행된 결과 계약을 유지하는 조건에서 내부 materialization 구조 변경이 허용된 상태다.
- 결정: `/actions` 요청 시작 시 필요한 기초 자료를 한 번 병렬 preload하고, canonical task dataset과 approval projection, 공통 Map/Set 색인을 가진 명시적 request context를 회차 계산에 전달한다. 전역 cache는 만들지 않는다. `applyItemApproval`은 이 경로에서 이미 읽은 task·round·judge를 입력으로 받아 별도 task join을 만들지 않는다. 서로 다른 회차의 판정 계산은 유지하되 공통 전체자료 READ·정규화·선형 탐색은 반복하지 않는다.
- 이유: 물리 SQL은 이미 16회로 축소돼 있었고 남은 개선 대상은 SQL fan-out이 아니라 같은 요청 안의 server materialization이었다. request-local context와 stable-order index는 freshness, role scope, 정렬, 필터, limit, 빈 값 의미를 바꾸지 않고 중복 계산만 제거한다.
- 영향 범위: PostgreSQL `/actions` READ 내부 실행, request-local preload/index, task approval projection, 점검 회차 cell·old aggregate 계산, 알림·judge·owner lookup. Production backend, CSV READ, WRITE, DB schema/data/index, UI, role 의미, golden, frozen data 판에는 영향이 없다.
- 실제 변경: task 원래 순서를 보존하는 base/approval task index, task별 inspection, inspection별 action, task별 최신 evidence, 부서별 owner, 회차별 judge, track·year·step·dept별 이행기록 index를 한 번 생성한다. 회차 9건은 이 context로 계산하며 base cell 7개 입력 조합과 old aggregate 9개 입력 조합만 계산한다. 알림의 task 포함 검사, 이후 judge 검색, 부서 owner 검색을 Set/Map lookup으로 교체했다. `allTasks`의 한도를 현재 canonical task dataset과 맞추고 raw approval rows를 분리해 preload 입력으로 사용했다.
- 검증: TypeScript 검사와 production build를 통과했다. CSV에서 기존 `cellsOfRound`와 context 계산을 9회차 전부 직접 비교해 mismatch 0을 확인했다. `CheckFlag[]`는 `gm`, `road`, `road_head`, `ceo` 모두 30행이며 기존 role별 SHA-256과 일치했다. PostgreSQL Preview의 `/actions` 40/40 요청이 HTTP 200이었다. 발행 기준일 `2026-09-26`으로 제한한 중간 gate는 37화면 HTTP 37/37, metrics 159/159 mismatch 0, calculation crosscheck 68/68이다. 계산 JSON `01`~`05`는 byte-identical이고 role별 `CheckFlag[]`를 여섯 번째 계산 검증으로 포함해 모두 통과했다. 검증용 시각 설정은 완료 후 제거했다.
- 성능: SQL-result logical READ는 최초 270회, 1차 18회에서 17회가 됐고 물리 SQL은 16회로 유지됐다. task 전체 materialization 1회, approval merge 1회, 공통 dataset normalization 1회다. `gm` warm 중앙값은 최초 14.625초, 1차 5.477초에서 4.650초로 감소했다. `gm` warm server 중앙값은 DB wall 2.318초, render 3.161초, 비DB server 0.843초다. 4역할 warm 36회 통합 중앙값은 4.300초다.
- 관련 파일: `app/actions/page.tsx`, `app/check/_lib.ts`, `lib/check_merge.ts`, `lib/cycle.ts`, `lib/data.ts`, `READ_PERFORMANCE_VERIFY.md`, `WORKLOG.md`
- 관련 commit: pending

## 2026-09-28

### [33] PostgreSQL 공통 READ 비용 계측, Singapore 리전 정렬 및 최종 성능 gate 보류
- 상태: 완료
- 배경: `/actions` request context 적용으로 비DB 계산을 9.983초에서 0.843초까지 줄였지만 dashboard, `/duties/list`, `/evidence`, `/tasks`에도 공통 PostgreSQL 지연이 남아 있었다. 함수와 PostgreSQL이 서로 다른 리전에 있던 상태를 먼저 제거하고 같은 실행 조건에서 CSV와 PostgreSQL을 다시 비교해야 했다.
- 결정: Railway PostgreSQL은 Singapore를 유지하고 Netlify Functions site region을 `sin`으로 변경한다. Preview와 기존 CSV Production을 재배포해 실제 runtime region `ap-southeast-1`을 확인한다. 독립 READ만 병렬화하고 Pool 재사용과 adapter normalization을 계측한다. 성능 gate가 실패했으므로 Production READ source는 `csv`로 유지하며 전체 137화면 회귀는 이번 반복에서 실행하지 않는다.
- 이유: warm 요청에서 Pool은 재사용됐고 대부분 새 physical connection이 0이었으며 adapter normalization과 비DB 계산은 수백 ms 수준이었다. 반면 query completion/row-transfer wall time은 2.571~4.884초, dashboard 변동 구간은 그 이상이었다. 리전 이름을 일치시킨 것만으로 외부 `DATABASE_URL` 경로와 대량 full-table 전송 비용이 제거되지 않았고 PostgreSQL warm 중앙값은 CSV 대비 3.15~4.93배였다.
- 영향 범위: Netlify Functions site region, PostgreSQL READ connection reuse, 대표 5경로의 독립 READ 실행 순서, 성능 계측 및 Production cutover 판정. Railway schema/data, WRITE, UI, role logic, filter/sort/limit, golden, frozen data에는 영향이 없다.
- 실제 변경: Netlify Functions region을 `sin`으로 변경하고 Preview와 Production을 재배포했다. Production은 기존 main commit과 `csv` backend를 유지한다. `pg` Pool에 TCP keep-alive를 명시하고 warm pool/physical connection 상태와 adapter row-clone 시간을 기록하도록 했다. `/tasks`, `/evidence`, `/duties/list`, dashboard의 실제 독립 READ를 병렬화하고 dashboard의 중복 transport READ를 제거했다.
- 검증: 배포 metadata에서 site와 새 함수 runtime이 `ap-southeast-1`임을 확인했다. CSV 50/50 및 PostgreSQL 50/50 요청은 모두 HTTP 200이었다. CSV/PG warm 중앙값은 dashboard 1.808/6.795초, `/actions` 1.480/7.297초, `/duties/list` 1.433/4.512초, `/evidence` 1.279/4.641초, `/tasks` 0.887/4.190초다. 발행 기준일 targeted gate는 HTTP 37/37, metrics 159/159 mismatch 0, crosscheck 68/68, 계산 JSON 6/6 SHA 동일이다. TypeScript와 production build도 통과했다. 성능이 통과 후보가 아니므로 조건부 전체 137회귀는 생략했고 Production cutover는 보류한다. 검증용 시각 설정은 제거했다.
- 관련 파일: `lib/db.ts`, `app/page.tsx`, `app/tasks/page.tsx`, `app/evidence/page.tsx`, `app/duties/list/page.tsx`, `READ_PERFORMANCE_VERIFY.md`, `db/read-shadow/read_performance_singapore.csv`, `WORKLOG.md`
- 관련 commit: pending

### [34] 2026-09-27 Railway READ server 도입 결정
- 상태: 결정
- 배경: Netlify Functions와 Railway PostgreSQL을 동일 Singapore region으로 정렬하고, PostgreSQL Pool 재사용, TCP keep-alive, 독립 READ 병렬화 및 `/actions` 서버 계산 최적화를 적용했다. 그 뒤에도 Netlify Function이 Railway PostgreSQL 외부 접속 URL을 직접 사용하는 READ는 CSV 대비 약 3.15~4.93배 느렸다. `/actions` 비DB 계산은 약 0.792초까지 감소해 애플리케이션 계산 병목은 대부분 해소됐고, 잔여 병목은 외부 DB 접속의 query completion 및 raw row transfer 경로로 좁혀졌다.
- 결정: Netlify가 PostgreSQL을 직접 읽는 구조를 Production 목표에서 제외하고, Railway 내부망에서 PostgreSQL을 읽는 경량 READ server를 추가한다. READ server는 private `DATABASE_URL`을 사용해 조회·집계·materialization을 수행하고 화면에 필요한 결과만 Netlify에 반환한다. Production READ cutover는 READ server의 결과 동등성과 성능 검증이 모두 통과한 뒤 진행한다.
- 이유: 리전 정렬과 애플리케이션 내부 최적화만으로는 외부 DB 접속 및 대량 raw row 전송 비용을 제거하지 못했다. PostgreSQL과 같은 Railway 내부망에서 필요한 결과만 구성해 전달하면 Netlify↔DB 간 반복 왕복과 불필요한 원시 행 전송을 줄일 수 있다.
- 영향 범위: PostgreSQL READ 배포 구조, Netlify server-side READ 경로, Railway 내부 서비스 구성, 이후 Production READ cutover 검증. PostgreSQL 정본 데이터, schema, WRITE 경로, CSV fallback, 사용자 가시 결과 계약에는 현재 변경이 없다.
- 실제 변경: 이번 항목에서는 구조 결정만 기록했다. Railway READ server 구현·배포, Netlify 연결, Production backend 전환은 아직 수행하지 않았다.
- 검증: 기존 Singapore A/B에서 PostgreSQL warm 중앙값이 CSV 대비 3.15~4.93배였고 `/actions` 비DB server 시간은 약 0.792초였다. READ server 구현 후 동일 입력·동일 기준일 결과 동등성과 대표 경로 성능을 별도 검증한다.
- 관련 파일: `READ_PERFORMANCE_VERIFY.md`, `db/read-shadow/read_performance_singapore.csv`, `WORKLOG.md`
- 관련 commit: pending

### [35] 긴급 시연판 납품 모드 전환
- 상태: 완료
- 배경: 클라이언트가 진행 지연과 기한 준수에 강한 불만을 제기했고, 2026-09-28 02:00까지 실 DB를 사용하는 Production 시연 상태가 최우선 납품 조건이 됐다.
- 결정: 기존 시연판의 단계별 세부 검증과 내부 구조 보존 규칙을 폐기한다. 사용자 가시 결과 동등성, 핵심 5화면의 정상 표시, 시연 가능한 응답속도, 즉시 CSV rollback 가능 여부만 완료조건으로 둔다. READ server를 통한 Production 전환을 우선하며 전체 회귀, 구조 개선, 정본·GraphDB 작업은 마감 후로 이관한다.
- 이유: 남은 시간에는 실제 Railway PostgreSQL READ를 Production 화면에 안정적으로 연결하는 작업이 문서 완성도나 전수 검증보다 우선한다.
- 영향 범위: Railway `sapa-read-server`, Netlify server-side READ 연결, 핵심 5화면 smoke test, Production backend와 CSV rollback 경로. WRITE, DB schema/data, GraphDB에는 영향이 없다.
- 실제 변경: Railway READ server public HTTPS domain과 Bearer 인증 기반 Netlify server-side proxy를 구성했다. private `DATABASE_URL`의 대량 조회 지연을 줄이기 위해 READ server가 실제 DB에서 읽은 동일 query 결과를 프로세스 메모리에서 재사용하고 시작 시 핵심 5경로를 자동 사전 로드하도록 변경했다. DB 조회 결과는 서버 내부에서 JSON으로 묶어 전송량을 줄였고 health 확인은 DB 전체 검사를 기다리지 않도록 분리했다. 검증된 branch deploy를 그대로 Production에 게시해 `ADOMS_DATA_BACKEND=read-server` 상태로 전환했다. CSV backend 설정은 즉시 rollback 경로로 유지한다.
- 검증: Railway 사전 로드에서 dashboard, `/actions`, `/duties/list`, `/evidence`, `/tasks`가 모두 HTTP 200이었다. Netlify Preview는 핵심 5화면과 `/actions` 4역할 8/8 HTTP 200, backend `read-server`였고 응답시간은 dashboard 2.725초, `/actions` 0.498~0.629초, `/duties/list` 0.369초, `/evidence` 0.427초, `/tasks` 0.381초였다. Production 게시 후 동일 8개 요청이 8/8 HTTP 200 및 backend `read-server`였으며 Preview와 경로별 응답 크기가 모두 일치했다. Production 응답시간은 최초 dashboard 4.443초, `/actions` 0.572~0.675초, `/duties/list` 0.362초, `/evidence` 0.430초, `/tasks` 0.382초였다. 실제 PostgreSQL은 Railway private `DATABASE_URL`로만 읽고 Netlify browser/client는 READ server를 직접 호출하지 않는다.
- 관련 파일: `lib/db.ts`, `middleware.ts`, `services/read-server/start.mjs`, `WORKLOG.md`
- 관련 commit: `e70896a`, `1c71943`, `7264b4d`, `0d961ad`, `2a8ea0b`, `bef8a44`, `f10dfa1` (최종 상태 기록 commit은 pending)

### [36] 긴급 시연판 READ server 프로세스 메모리 재사용 정책
- 상태: 결정
- 배경: Production 시연에서 Railway READ server가 실제 PostgreSQL 데이터를 읽어 핵심 5화면을 제공한다. WRITE 경로는 아직 비활성 상태이며, 동일 조회를 반복할 때 발생하는 DB 조회·전송 비용을 줄여 시연 가능한 응답속도를 확보해야 한다.
- 결정: dashboard, `/actions`, `/duties/list`, `/evidence`, `/tasks`에 필요한 PostgreSQL 조회 결과를 Railway READ server 프로세스 메모리에서 재사용한다. 현재 WRITE가 비활성 상태이므로 시연 중 데이터 변경에 따른 cache invalidation은 이번 범위에서 제외한다. WRITE 전환 시 별도의 캐시 무효화 정책을 설계하고 적용한다.
- 이유: 현재 시연판은 읽기 전용 baseline 데이터를 사용하므로 프로세스 수명 동안 조회 결과를 재사용해도 사용자 가시 결과가 변하지 않는다. 이 방식은 반복 DB 조회와 raw row 전송을 줄여 긴급 납품에 필요한 응답속도를 확보한다.
- 영향 범위: Railway `sapa-read-server`의 핵심 5화면 READ 성능과 프로세스 재시작 후 사전 로드. PostgreSQL schema/data, Netlify browser/client, WRITE 경로에는 영향이 없다.
- 실제 변경: 기존에 구현된 process-global query result cache와 핵심 5경로 자동 사전 로드를 시연판의 임시 운영 정책으로 확정했다. 프로세스 재시작 시 PostgreSQL에서 다시 조회해 메모리를 구성한다.
- 검증: Production 핵심 5화면과 `/actions` 4역할이 모두 HTTP 200이며 backend `read-server`로 확인됐다. 반복 요청은 예열된 메모리 결과를 사용하며 CSV rollback 경로는 유지된다.
- 관련 파일: `lib/db.ts`, `services/read-server/start.mjs`, `WORKLOG.md`
- 관련 commit: pending

### [37] ADOMS 시연판 공통 UI 1차 최적화
- 상태: 완료
- 배경: 실 DB READ 전환 이후 시연 첫인상을 정리하기 위해 공통 metadata, 상단 배너, 로고, GNB와 지원 화면 범위를 일관되게 정비할 필요가 있었다. 이번 범위는 공통 Shell과 표시 자산에 한정하며 DB, READ server, WRITE 및 개별 업무 화면의 의미는 변경하지 않는다.
- 결정: 서비스 표기는 `ADOMS`, 문서 제목은 `중대재해처벌법의무이행관리시스템`, 설명은 `용인특례시 시연용`으로 통일한다. 상단 배너는 `경영목표 | 사용자·역할 | 경영방침` 3영역으로 구성한다. 최소 지원 폭은 768px로 고정하고 768px 미만에서는 앱을 축소·재배치하지 않은 채 지원 안내 overlay로 덮는다. 768px 이상은 기존 앱을 표시하며 768~1023px 구간에서만 공통 GNB를 4열로 배치한다.
- 이유: 시연판의 제품명과 공유 metadata를 명확히 하고, 역할 변경 위치와 메뉴 구조를 한눈에 보이게 하면서 지원하지 않는 모바일 폭에서 앱이 비정상적으로 압축되는 것을 방지하기 위해서다.
- 영향 범위: 공통 HTML metadata, Open Graph 이미지, 공통 Shell 상단 배너·로고·GNB, 768px 지원 경계와 안내 overlay. DB/schema/data, READ server, WRITE, role 동작, 개별 화면 데이터와 계산 결과에는 영향이 없다.
- 실제 변경: Open Graph와 Twitter metadata 및 1200×630 `ADOMS` 이미지를 추가했다. 역할 선택 영역을 상단 배너 중앙으로 옮기고 기존 역할 동작은 유지했다. 로고 배경 상자를 제거하고 시스템명을 `ADOMS`로 변경했다. GNB를 왼쪽 정렬과 좁은 간격으로 정리하고 `(실적증빙)` 보조 줄만 작게 표시했다. `.us-app` 최소 폭을 768px로 고정하고 767px 이하에서 정확한 지원 안내문을 표시하는 전체 화면 overlay를 추가했다.
- 검증: 1920×1080, 1440×900, 1280×800, 1024×768, 768×1024, 390×844 뷰포트에서 공통 Shell을 확인했다. 768px 이상에서 역할 선택과 GNB 9개가 표시되고, 390px에서는 앱 폭이 768px로 유지된 상태에서 안내 overlay가 화면 안에 표시된다. TypeScript 정적 검사와 Next.js production build를 통과했다.
- 관련 파일: `app/layout.tsx`, `app/us.css`, `components/Shell.tsx`, `components/NavMenu.tsx`, `public/adoms-og.png`, `WORKLOG.md`
- 관련 commit: pending

### [38] 확정 상단 시안 반영 및 고정 폭 정책 변경
- 상태: 완료
- 배경: 1차 UI에서 화면 폭에 따라 상단 GNB와 역할 영역이 축소·재배치되어 태블릿 폭에서 겹침이 발생했다. 요청된 동작은 작은 화면에 맞춰 앱을 축소하는 것이 아니라 일정 PC 폭을 유지하고 가로 이동 막대로 확인하는 방식이며, 넓은 화면에서도 콘텐츠가 무한히 늘어나지 않아야 한다.
- 결정: 공통 앱 프레임은 최소 1200px, 최대 1600px로 고정한다. 1200px 미만에서는 레이아웃과 글씨를 추가 축소하거나 재배치하지 않고 문서 하단의 가로 스크롤로 이동한다. 1600px보다 넓은 화면에서는 앱을 가운데 정렬하고 바깥 영역은 고정 배경색으로 둔다. 상단은 확정 시안의 65px 경영목표 띠와 83px 로고·GNB 구조를 따른다.
- 이유: 작은 뷰포트에서 메뉴가 겹치거나 업무 화면의 열 구성이 변하는 문제를 막고, PC 시연 화면의 비율과 정보 밀도를 모든 환경에서 동일하게 유지하기 위해서다.
- 영향 범위: 공통 앱 프레임 폭, 상단 경영목표·역할·경영방침 띠, 로고, GNB 표시 제목과 공통 반응형 정책. DB/schema/data, READ server, WRITE, role 권한과 메뉴 연결 대상에는 영향이 없다.
- 실제 변경: 확정 시안의 130×48 용인특례시 로고를 추가하고 헤더 왼쪽 35px, 공통 좌우 기준 40px를 적용했다. 역할 pill 안에 `ADOMS`와 역할 선택만 배치하고 `정보수정`, `로그아웃` 링크를 제거했다. GNB 표시 제목을 `의무이행·증빙`, `이행점검·조치`, `기관장 예방활동`, `통계·사례`, `관리자`, `시연참고` 기준으로 정리하되 기존 메뉴 key와 권한·링크는 유지했다. 기존 768px 전용 grid와 모바일 overlay를 제거했다.
- 검증: 1920px에서 앱 폭 1600px·좌우 바깥 영역 160px, 1200px에서 앱 폭 1200px, 1024px와 768px에서 앱 폭 1200px 및 문서 scrollWidth 1200px를 확인했다. 작은 화면에서도 헤더·본문 열은 축소되지 않고 하단 가로 스크롤이 표시되며 역할 보조 링크는 0개다. TypeScript 정적 검사와 Next.js production build를 통과했다.
- 관련 파일: `app/us.css`, `components/Shell.tsx`, `components/NavMenu.tsx`, `components/UserBox.tsx`, `public/yongin_logo_header.png`, `WORKLOG.md`
- 관련 commit: pending

### [39] 상단 메뉴 가독성 조정 및 최신 배포 통합
- 상태: 완료
- 배경: 1440px 미만 화면에서 상단 GNB 글씨가 좌측 중대재해 통계 메뉴보다 작게 표시됐고, 최신 UI는 branch deploy에만 반영되어 Production과 배포 기준 commit이 달랐다.
- 결정: 1440px 미만에서도 `시연참고`를 제외한 상단 GNB 글씨를 좌측 업무 메뉴와 같은 1.02rem 기준으로 표시한다. 최신 `remote-csv-baseline` 이력을 `main`에 fast-forward하고 Production 자동 배포 기준을 동일 commit으로 통합한다.
- 이유: 주요 메뉴의 시인성을 확보하고 GitHub 기준 브랜치, Production 배포와 사용자 확인 화면이 서로 다른 상태를 해소하기 위해서다.
- 영향 범위: 1440px 미만 공통 GNB 글자 크기, Git `main`, Netlify Production 배포. 메뉴 링크·권한·순서, DB/schema/data, READ server, WRITE에는 영향이 없다.
- 실제 변경: 일반 GNB의 축소 구간 글자 크기를 0.96rem에서 1.02rem으로 변경했다. `시연참고` pill은 기존 0.88rem을 유지했다. 최신 UI commit을 원격 `remote-csv-baseline`과 `main`에 반영해 같은 소스 기준으로 배포했다.
- 검증: TypeScript 정적 검사와 Next.js production build를 통과했다. branch deploy와 Production에서 일반 GNB 1.02rem, `시연참고` 0.88rem 및 최신 commit 반영을 확인했다.
- 관련 파일: `app/us.css`, `WORKLOG.md`
- 관련 commit: pending

### [40] Production READ server 인증 토큰 scope 복구
- 상태: 완료
- 배경: 최신 UI를 Production에 통합한 뒤 `READ server token is not configured.` 오류로 화면이 표시되지 않았다. Railway READ server에는 인증 토큰이 존재했지만 Netlify의 `ADOMS_READ_SERVER_TOKEN`은 Deploy Preview와 Branch deploy에만 값이 있고 Production 컨텍스트는 비어 있었다.
- 결정: Railway READ server와 동일한 인증 토큰을 Netlify Production의 서버 전용 환경변수에 설정하고 기존 `cc23aee` Production 소스를 재배포한다. 토큰은 화면·로그·저장소에 기록하지 않는다.
- 이유: Production만 인증정보를 주입받지 못해 server-side READ proxy가 요청을 시작하기 전에 503을 반환한 것이 직접 원인이며, 코드·DB·READ server 로직 변경 없이 배포 컨텍스트 설정을 바로잡는 것이 최소 수정이다.
- 영향 범위: Netlify Production 환경변수와 Production 재배포. PostgreSQL schema/data, Railway READ server 데이터, WRITE, UI 코드에는 영향이 없다.
- 실제 변경: `ADOMS_READ_SERVER_TOKEN` Production 값을 Railway READ server와 일치시켰고 Production을 재배포했다. Deploy Preview와 Branch deploy의 기존 값은 유지했다.
- 검증: Production dashboard, `/actions`, `/duties/list`, `/evidence`, `/tasks`가 모두 정상 표시됐고 토큰 누락 오류가 재현되지 않았다. dashboard에서 PostgreSQL baseline 기반 관리대상 383개와 시기도래 1,322건을 확인했다. `/actions`, `/duties/list`, `/evidence`, `/tasks`의 단일 요청은 각각 약 1.471초, 0.503초, 0.507초, 0.437초였다.
- 관련 파일: `WORKLOG.md`
- 관련 commit: pending

### [41] PC 고정 캔버스 전환 및 공통 UI 수정사항 반영
- 상태: 완료
- 배경: 1440px 미만에서 공통 헤더와 화면별 카드·그리드가 viewport에 맞춰 축소·재배치되어 태블릿 가로 화면에서 PC 시연판의 비율과 정보 밀도가 달라졌다. 별도 수정사항 문서에는 역할별 법 메뉴 제한, 단일 GNB dropdown, 검색 규격 통일, 이미지형 다운로드·검색 아이콘 제거가 추가로 명시돼 있었다.
- 결정: 앱 캔버스는 최소 1440px, 최대 1600px로 고정한다. 1440px 미만에서는 내부 UI를 축소·재배치하지 않고 body 가로 scrollbar로 이동하며, 1600px보다 넓은 화면에서는 1600px 앱을 중앙 배치하고 바깥 영역을 배경색으로 남긴다. 일반 GNB 대메뉴는 동일한 1.24rem을 사용하고 `시연참고`만 작은 보조 메뉴 크기를 유지한다.
- 이유: 시연판은 PC 레이아웃을 일관되게 보존해야 하며, viewport별 font·GNB·card·grid 축소가 메뉴 겹침과 화면별 비율 차이를 만들었다. 수정사항 문서의 기능 요구도 공통 Shell과 표시 컴포넌트에서 일관되게 처리할 필요가 있었다.
- 영향 범위: 공통 앱 폭과 가로 overflow, 화면별 반응형 CSS, GNB 표시·dropdown 상태, 역할별 법 메뉴 노출, 검색 입력·버튼 규격, 다운로드·검색 버튼 문구. 데이터, DB schema, READ server, WRITE, 계산 결과에는 영향이 없다.
- 실제 변경: `.us-app`을 1440~1600px 고정 캔버스로 변경하고 1439px 이하 공통 축소 규칙과 화면별 max-width 축소 규칙을 제거했다. GNB 항목을 content 폭 고정·nowrap으로 바꾸고 일반 메뉴 글자를 1.24rem으로 통일했다. dropdown open 상태를 하나의 request-independent client state로 관리해 다른 메뉴를 열면 이전 메뉴가 닫히도록 했다. 총괄(`gm`)만 `법 의무사항`의 의무목록·법령 개정 항목을 보도록 제한했다. 검색 버튼은 아이콘 없이 `검색` 텍스트, 84×40px 이상 규격으로 통일하고 같은 form의 input/select 높이를 40px로 맞췄다. 다운로드·뷰어 등 불필요한 기호형 아이콘은 텍스트 버튼으로 교체했다.
- 검증: 1920, 1600, 1440, 1366, 1280, 1024px viewport에서 실제 브라우저로 확인했다. 1920px에서 앱 폭은 1600px로 중앙 배치됐고, 1440px에서 앱 폭 1440px, 1366/1280/1024px에서 앱 폭 1440px와 horizontal scrollbar가 유지됐다. 모든 폭에서 일반 GNB 글자 18.6px, `시연참고` 15px, GNB wrap 0건이었다. keyboard focus로 연속 메뉴를 이동했을 때 열린 dropdown은 항상 1개였다. 총괄은 의무목록·법령 개정 링크 6개를 보고 경영책임자는 0개를 보며, 게시판 검색 input과 버튼 높이는 모두 40px였다. TypeScript 검사와 Next.js production build를 통과했다.
- 관련 파일: `app/us.css`, 화면별 CSS, `components/NavMenu.tsx`, `lib/menu.ts`, 검색·다운로드 표시 컴포넌트, `WORKLOG.md`
- 관련 commit: pending

### [42] 시연판 READ 체감속도 최종 최적화
- 상태: 완료
- 배경: Production은 Railway private PostgreSQL을 `sapa-read-server`가 조회하고 Netlify가 Bearer 인증으로 server-side proxy하는 상태였다. 기존 process-level SQL 결과 cache만으로는 동일 화면을 다시 열 때 Next.js 계산·정규화·materialization과 응답 body 생성이 반복됐고, UI 작업과 성능 작업을 분리해 이 병목만 마무리할 필요가 있었다.
- 결정: UI 변경은 commit `3cc9717`로 먼저 고정하고 성능 변경은 별도 commit으로 관리한다. READ server 프로세스에서는 SQL 결과 cache 위에 최종 semantic READ 결과를 재사용하고, 핵심 5화면의 완성된 HTTP 응답은 HTML과 RSC/prefetch representation을 분리해 최대 256개까지 메모리에 보존한다. cache key에는 Asia/Seoul 기준일, route, role·검색조건 및 representation을 포함한다. 시작 시 실제 PostgreSQL에서 사전 생성한 8개 응답이 모두 성공해 `READY`가 되기 전에는 외부 화면 요청에 503 warming을 반환한다.
- 이유: WRITE가 비활성인 시연판에서는 동일 입력의 최종 결과를 프로세스 수명 동안 재사용해도 결과 계약과 freshness가 바뀌지 않는다. 최종 응답 재사용은 warm 요청에서 PostgreSQL 조회뿐 아니라 반복 render와 Netlify↔Railway payload 재생성도 제거한다.
- 영향 범위: `sapa-read-server`의 핵심 5화면 READ 경로, process memory cache, 시작 시 prewarm과 readiness. UI, PostgreSQL schema/data, WRITE, 역할·필터·정렬·limit 의미에는 영향이 없다. process restart 시 cache는 사라지고 PostgreSQL에서 다시 생성하며, WRITE 전환 전까지 별도 invalidation은 두지 않는다.
- 실제 변경: 모든 traced READ에서 request-scoped semantic memoization을 사용할 수 있게 하고 READ server process-level semantic result cache를 추가했다. `/actions` 공통 context도 최종 semantic 결과로 재사용한다. READ server 앞단에 인증을 유지하는 메모리 응답 proxy를 두고 일반 HTML과 RSC/prefetch를 분리했다. prewarm 대상을 dashboard, `/duties/list`, `/evidence`, `/tasks`의 총괄 화면과 `/actions`의 `gm`, `road`, `road_head`, `ceo` 역할로 확대했다. Netlify는 기존처럼 Railway 응답을 전달하며 동일 계산을 수행하지 않는다.
- 검증: TypeScript 검사와 production build가 통과했다. Railway 배포 `d06db41`은 Singapore에서 활성화됐고 prewarm 8/8이 HTTP 200으로 끝난 뒤 `READY responses=8`을 기록했다. 최초 DB 생성은 dashboard 10.521초, `/actions` 총괄 2.004초, `/duties/list` 0.554초, `/evidence` 0.588초, `/tasks` 0.133초였으며 READY 이후 Railway cache hit는 0.95~1.58ms였다. Netlify Production을 포함한 warm 9회 중앙값은 dashboard 0.499초, `/actions` 0.316초, `/duties/list` 0.318초, `/evidence` 0.333초, `/tasks` 0.246초이고 전 요청이 HTTP 200 및 cache hit였다. 이전 Production 관측값 4.443초, 0.572~0.675초, 0.362초, 0.430초, 0.382초보다 모두 짧아졌으며 일반 화면 2초, `/actions` 2.5초 목표를 충족했다. 동일 기준일의 CSV 계약과 비교한 핵심 지표는 자동 추출 155개와 `/tasks` 4역할 지표 4개를 합쳐 159/159, mismatch 0이다. 계산 JSON 5개 SHA가 모두 동일하고 `CheckFlag[]` 4역할 SHA 및 9개 round cell 비교도 동일해 계산 검증 6/6을 통과했다. Production은 계속 실제 PostgreSQL READ server를 사용하며 CSV rollback 경로를 유지한다.
- 관련 파일: `app/check/_lib.ts`, `lib/db.ts`, `services/read-server/start.mjs`, `services/read-server/README.md`, `WORKLOG.md`
- 관련 commit: `3cc9717` (UI 분리), `d06db41` (성능), 최종 기록 commit은 pending

### [43] 사용자 유형별 법 의무사항 메뉴 및 역할 변경 고지
- 상태: 완료
- 배경: 실무자 등 비총괄 역할에서도 `법 의무사항` 아래의 의무 목록과 법령 개정 항목이 노출될 수 있었고, 상단에서 사용자 유형을 바꿔도 권한 기준이 변경됐다는 안내가 없었다.
- 결정: `법 의무사항` 자체와 대상별 의무사항 3개 화면은 모든 역할에 유지한다. 의무 목록 5개 화면과 법령 개정 현황은 총괄(`gm`) 전용 metadata로 정의하고 역할별 메뉴 생성 단계에서 제목과 링크를 함께 제외한다. 사용자 유형이 실제로 달라졌을 때만 `ROLE_LABEL`의 역할명으로 1회 안내 modal을 표시한다.
- 이유: CSS 숨김이나 링크 문자열 추정이 아니라 단일 메뉴 원천에서 권한을 결정해야 빈 제목과 우회 노출을 막을 수 있다. 역할명도 기존 정본을 재사용해야 표시 문구가 서로 달라지지 않는다.
- 영향 범위: 공통 GNB의 `법 의무사항` dropdown, 상단 사용자 유형 선택과 안내 modal. READ cache, PostgreSQL, READ server, WRITE, 고정 캔버스와 GNB 크기에는 영향이 없다.
- 실제 변경: 메뉴 항목에 역할 metadata를 추가하고 의무 목록·법령 개정의 제목과 링크를 총괄 전용으로 지정했다. 역할 선택 직후 새 역할명과 권한 반영 안내를 표시하며 `확인`으로 닫도록 했다. 같은 역할 재선택과 페이지 새로고침에는 안내를 반복하지 않는다.
- 검증: 총괄은 대상별 의무사항, 의무 목록, 법령 개정의 12개 제목·링크를 모두 받고, `ceo`, `mgr`, `road`, `water`, `road_head`, `water_head`는 대상별 의무사항 제목과 3개 링크만 받는 것을 확인했다. 7개 역할 전환 시 `ROLE_LABEL`과 동일한 이름이 표시되고 빈 제목이 남지 않았다. Next.js production build와 내장 TypeScript 검사를 통과했다. 직접 URL 권한은 기존 permission 구조의 query 구분 범위를 바꾸지 않고 별도 보강 대상으로 남겼다.
- 관련 파일: `lib/menu.ts`, `components/UserBox.tsx`, `app/us.css`, `WORKLOG.md`
- 관련 commit: pending

### [44] 시연 QA 콘솔 및 운영 점검 기능
- 상태: 완료
- 배경: 시연 참여자가 Railway 프로젝트 권한을 받지 않고도 실제 시연 중의 접근, 역할 변경, 오류, READ 성능, cache/prewarm 및 WRITE 결과를 시간순으로 확인할 내부 리뷰 화면이 필요했다. 이 화면은 Railway raw log viewer나 일반 운영 관리자 화면이 아니다.
- 결정: 용인특례시 로고를 `/demo-admin` 진입점으로 사용하고, 일반 역할과 완전히 분리된 HttpOnly 서명 session으로 QA 인증을 처리한다. QA 콘솔은 `QA 현황`, `시연 리뷰`, `시연 데이터`, `캐시 관리`, `성능 점검` 5개 메뉴만 둔다. Railway credential과 READ server token은 Netlify server-side에서만 사용한다.
- 이유: 시연 리뷰에 필요한 의미 있는 사건과 운영 상태만 제공하면 참여자에게 Railway 계정이나 프로젝트 접근 권한을 부여할 필요가 없다. 일반 역할 `gm`과 QA 인증을 분리해야 메뉴 역할 변경만으로 운영 제어 기능에 접근하는 것을 막을 수 있다.
- 영향 범위: 일반 화면 로고 링크, QA 로그인/session, Netlify QA API, Railway READ server의 인증된 cache control과 구조화 QA event, PostgreSQL의 시연 리뷰 전용 운영 표. 기존 3단 READ cache 구조와 업무 데이터·권한·WRITE 로직은 변경하지 않는다.
- 실제 변경: `demo_qa_event` 단일 표와 시간·유형 index를 추가하는 idempotent migration을 작성하고 READ server 시작 시 private `DATABASE_URL`로 적용하도록 했다. 공통 server-only 기록 함수는 같은 사건을 구조화 console JSON과 전용 표에 남긴다. 기록 대상은 시연 시작, 핵심 화면 접근, 역할 변경, QA 로그인·로그아웃, READ/server 오류, cache reset, prewarm 시작·완료·실패, 성능 점검, 향후 WRITE 성공·실패다. IP, fingerprint, secret, request body와 raw stack은 저장하지 않는다. cache 제어는 query, semantic, HTML/RSC 세 계층을 모두 초기화한 뒤 8개 대표 화면을 즉시 재예열한다. 성능 점검은 실제 Production 5개 경로를 각 3회 순차 측정하고 최근 결과를 리뷰 event로 보존한다. QA 종료는 session cookie를 만료시키고 `/?role=gm`으로 이동한다.
- 검증: 일반 역할만으로 QA API를 호출하면 401을 반환하도록 모든 Netlify QA endpoint에서 session을 검증한다. READ server의 QA event·cache control endpoint도 Bearer 인증 없이는 거부한다. 로그인 비밀번호는 기본 masking이며 표시/숨김 전환만 client에서 수행하고 평문 credential은 source·HTML·bundle·로그·문서에 기록하지 않는다. TypeScript 검사와 production build를 통과했다. Production 적용, 실제 migration·cache reset·prewarm·5화면 성능 및 로그 표 검증 수치는 배포 후 이 항목에 추가한다.
- 관련 파일: `app/demo-admin/*`, `app/api/demo-admin/*`, `app/api/read-server/control/*`, `app/api/read-server/qa/*`, `components/QaEventBeacon.tsx`, `lib/demo-admin-auth.ts`, `lib/demo-qa-store.ts`, `db/migrations/0005_demo_qa_event.sql`, `services/read-server/start.mjs`, `WORKLOG.md`
- 관련 commit: pending

### [45] GNB 단일 상태 및 ADOMS 역할·서비스 관리자 분리
- 상태: 완료
- 배경: 현재 route 강조와 dropdown open 상태를 혼용하거나 메뉴 DOM을 동시에 유지하면 서로 다른 GNB가 함께 보일 수 있었다. 역할 변경 직후 selector, URL, 메뉴 context와 고지 modal이 서로 다른 역할을 가리킬 가능성도 있었고, QA 인증 cookie의 의미를 일반 ADOMS 역할과 더 명확히 분리할 필요가 있었다.
- 결정: GNB 표시 상태는 request-local `openMenuKey` 하나만 사용하고 current route 강조와 분리한다. ADOMS 사용자 역할의 UI 정본은 URL `role` query로 유지하며 `adoms-role` cookie는 persistence/fallback에만 사용한다. QA 인증은 별도 `adoms-service-admin` HttpOnly session으로 관리하며 양방향 권한 승격을 두지 않는다.
- 이유: 사용자 역할, QA 운영 권한, 현재 화면 강조와 열린 dropdown은 서로 다른 상태다. 각 상태의 원천을 분리해야 역할 변경이나 hover·click 전환 때 이전 상태가 남지 않고 QA 접근 권한이 일반 역할에 섞이지 않는다.
- 영향 범위: 공통 GNB interaction과 표시선, 2-depth section label, 상단 역할 selector, 의무 목록·법령 개정 직접 접근 권한, QA session cookie. PostgreSQL, READ server, cache/prewarm, WRITE, 고정 캔버스와 데이터 결과에는 영향이 없다.
- 실제 변경: 열려 있는 GNB만 dropdown DOM을 생성하고 hover·click·focus·Escape·메뉴 이탈·역할 변경을 모두 같은 `openMenuKey`에 연결했다. 대메뉴 active 하단선을 제거하고 dropdown 상단선만 4px로 유지했으며 section label은 `--us-mut`와 흰색의 80:20 혼합색으로 조정했다. 역할 전환은 새 역할에서 현재 경로가 허용될 때만 유지하고, 의무 목록·법령 개정처럼 숨겨지는 화면에서는 해당 역할 홈으로 이동한다. `service_admin` logout은 서비스 session만 제거한 뒤 시연 홈 `role=gm`으로 이동한다.
- 검증: TypeScript 검사와 production build를 통과했다. 로컬 브라우저에서 기관장 예방활동 → 관리자 → 법 의무사항 순으로 전환할 때 visible dropdown은 항상 1개였고, `road` 전환 뒤 selector·URL·메뉴·modal이 동일 역할을 표시하며 기존 dropdown이 닫혔다. 코드의 `usGroupsFor(role)`에서 추출한 visible menu 294건을 순회해 HTTP·공통 Shell·blank/raw error 문자열을 검사한 결과 294/294 PASS였다. 역할별 수치는 `ceo` 39, `gm` 59, `mgr` 48, `road_head` 39, `road` 35, `water_head` 39, `water` 35건이다. Production 최종 순회는 별도 배포 검증 기록에 남긴다.
- 관련 파일: `components/NavMenu.tsx`, `components/UserBox.tsx`, `components/MenuCtx.tsx`, `lib/perm.ts`, `lib/demo-admin-auth.ts`, `app/us.css`, `scripts/visible_menu_smoke.mjs`, `MENU_SMOKE_VERIFY.md`, `WORKLOG.md`
- 관련 commit: `a696971`

### [46] Netlify 관리자 아이디 secret scan 오탐 처리
- 상태: 완료
- 배경: 역할·GNB·QA 콘솔 변경을 포함한 `main` 배포가 Netlify secret scan 단계에서 중단되어 Production에는 이전 배포가 계속 표시됐다. Production의 `ADOMS_DEMO_ADMIN_USER` 값이 일반 문자열과 일치해 소스와 빌드 산출물의 정상적인 `admin` 표기까지 secret으로 판정된 것이 원인이었다.
- 결정: secret scan 전체를 끄지 않고 비밀값이 아닌 관리자 로그인 아이디 키 `ADOMS_DEMO_ADMIN_USER`만 검사 예외로 지정한다. 관리자 비밀번호, session secret, READ server token 및 DB 연결값은 계속 검사한다.
- 이유: 사용자명은 인증 비밀값이 아니며, 일반 문자열 일치로 인한 배포 차단만 해소하면서 실제 credential에 대한 보호는 유지해야 한다.
- 영향 범위: Netlify build secret scan의 단일 환경변수 키. 애플리케이션 인증 방식, credential 값, PostgreSQL, READ server, UI와 데이터에는 영향이 없다.
- 실제 변경: 저장소 build 설정에 `SECRETS_SCAN_OMIT_KEYS=ADOMS_DEMO_ADMIN_USER`를 추가했다.
- 검증: 검사 예외 적용 뒤 Netlify Production build가 정상 게시됐으며 비밀번호·session·READ server token·DB 연결값은 예외에 포함하지 않았다.
- 관련 파일: `netlify.toml`, `WORKLOG.md`
- 관련 commit: `3c89fc2`

### [47] READ server HTML과 Next.js 정적 asset 배포 일치
- 상태: 완료
- 배경: Production에 최신 UI HTML은 반영됐지만 GNB와 역할 selector가 동작하지 않았다. 실제 브라우저 검사에서 Railway process memory가 반환한 HTML이 참조하는 Next.js JavaScript chunk 4개가 Netlify origin에서 404였고, 화면이 hydrate되지 않은 상태임을 확인했다. 단순 HTTP·Shell 검사만으로는 이 결함이 PASS로 보일 수 있었다.
- 결정: READ server 완성 응답 cache key에 Netlify source revision을 포함한다. Railway에서 렌더링한 핵심 5화면이 참조하는 `/_next/static/*`는 Netlify server-side proxy가 동일 Railway build에서 가져온다. Railway build에 없는 asset은 Netlify가 렌더링한 일반 화면의 asset이므로 Netlify 자체 정적 파일로 fallback한다. Bearer token은 서버 사이에서만 사용한다.
- 이유: 같은 commit이라도 Netlify와 Railway의 독립 Next.js build는 immutable chunk 이름이 다를 수 있다. HTML과 asset을 같은 build 단위로 맞춰야 client hydration과 메뉴 상호작용을 보장할 수 있으며, 일반 화면까지 일괄 Railway asset으로 바꾸면 반대로 Netlify 화면이 깨진다.
- 영향 범위: READ server 핵심 화면의 HTML/RSC response cache key, Netlify middleware의 `/_next/static/*` 전달과 fallback, visible menu smoke의 asset 확인. PostgreSQL schema/data, WRITE, 역할·화면 결과 계약에는 영향이 없다.
- 실제 변경: Netlify가 Railway에 source revision header를 전달하고 READ server cache key가 이를 포함하도록 했다. 정적 asset 요청은 Railway 우선·404 시 Netlify fallback으로 처리했다. smoke test는 모든 HTML의 JavaScript/CSS asset을 중복 제거해 검사하도록 보강했다.
- 검증: TypeScript 검사와 Next.js production build를 통과했다. Production 핵심 화면에서 GNB open과 실제 `법 의무사항 → 사업장` 이동, 일반 `/law/ws` 화면의 GNB open, `ceo → road` 역할 변경 modal·URL·selector 일치, road 법 메뉴 3개 제한, 연속 GNB 전환 시 열린 dropdown 1개를 확인했다. `usGroupsFor(role)` 기반 Production visible menu 294건과 JavaScript/CSS asset 66개를 검사해 294/294 PASS, asset 실패 0, HTTP 500/502/503/504·raw internal/error·blank·잘못된 role menu·동시 dropdown 각 0건이었다.
- 관련 파일: `middleware.ts`, `services/read-server/start.mjs`, `scripts/visible_menu_smoke.mjs`, `MENU_SMOKE_VERIFY.md`, `WORKLOG.md`
- 관련 commit: `fed17b8`, `22dad58`, `9fc6b33`, 최종 기록 commit은 pending

### [48] 시연용 관리자 링크 공유 메타데이터 분리
- 상태: 완료
- 배경: 일반 앱 링크와 `/demo-admin` 링크가 동일한 제목·설명·공유 이미지를 사용해 시연 리뷰용 관리자 화면임을 링크 미리보기에서 구분할 수 없었다.
- 결정: `/demo-admin`은 전용 title·description과 OG/Twitter 이미지를 사용한다. 이미지는 기존 ADOMS 공유 이미지의 중앙 흰색 워드마크 구성을 유지하고 배경색만 앱의 메인 초록색으로 변경한다.
- 이유: 일반 사용자 화면과 QA 운영 점검 링크의 용도를 공유 단계에서 명확히 구분하면서 브랜드 표현은 동일하게 유지하기 위해서다.
- 영향 범위: `/demo-admin` 문서 metadata와 외부 링크 미리보기. 일반 앱 metadata, 인증, READ server, PostgreSQL, WRITE와 화면 데이터에는 영향이 없다.
- 실제 변경: title을 `시연용 관리자 시스템`, description을 `시연리뷰, 캐시관리, 성능점검, 시연데이터`로 지정했다. 1200×630 초록색 배경에 기존과 같은 흰색 `ADOMS` 워드마크를 배치한 관리자 전용 OG/Twitter 이미지를 추가했다.
- 검증: TypeScript 검사와 Next.js production build를 통과했다. 로컬 production server와 Netlify Production에서 `/demo-admin`은 HTTP 200, title·description·OG title·OG description이 지정값과 일치했고 OG image URL은 `/demo-admin/opengraph-image`를 가리켰다. Production 이미지 endpoint도 HTTP 200, `image/png`로 응답했으며 1200×630 규격으로 생성됐다.
- 관련 파일: `app/demo-admin/page.tsx`, `app/demo-admin/opengraph-image.tsx`, `WORKLOG.md`
- 관련 commit: `b05fe10`

### [49] 역할 변경 고지 표시시간 연장 및 작업 기록 마감
- 상태: 완료
- 배경: 사용자 유형 변경 직후 표시되는 안내 modal이 route 전환 과정에서 다시 렌더링될 때 예상보다 빨리 사라질 수 있어, 선택한 역할과 권한 변경 내용을 읽을 시간을 늘릴 필요가 있었다.
- 결정: 역할 변경 고지는 약 4초간 유지해 기존 체감 표시시간의 약 2배를 확보한다. 사용자가 `확인`을 누르면 즉시 닫히며, 같은 역할 재선택과 새로고침 이후에는 불필요하게 다시 표시하지 않는다.
- 이유: 역할 변경 직후 메뉴와 화면도 함께 바뀌므로 새 역할명과 권한 반영 안내를 충분히 확인할 수 있어야 한다.
- 영향 범위: 상단 사용자 유형 선택 후 표시되는 고지 modal. 역할 권한, 메뉴 구성, READ server, PostgreSQL, WRITE와 업무 데이터에는 영향이 없다.
- 실제 변경: 역할과 만료 시각을 같은 브라우저 탭의 session storage에 4초간 보존해 route 재렌더링 뒤에도 남은 시간 동안 modal을 복원한다. 4초가 지나면 자동으로 닫고 저장값을 제거하며, `확인`을 누른 경우에도 즉시 저장값과 modal을 함께 제거한다.
- 검증: TypeScript 정적 검사와 Next.js production build를 수행하고, 역할 변경 시 modal의 4초 유지·자동 종료·확인 버튼 즉시 종료 및 route 전환 뒤 복원 동작을 확인했다.
- 관련 파일: `components/UserBox.tsx`, `WORKLOG.md`
- 관련 commit: `b7e262b`

### [50] 대시보드 알림 토글 및 상단 카드 위치 안정화
- 상태: 완료
- 배경: 대시보드 알림 펼치기 버튼이 주변 UI보다 크고 흰색 테두리만 있어 투박하게 보였으며, 알림 목록을 펼치면 같은 grid row의 높이를 따라 `시기도래`와 `기한 초과` 카드까지 세로로 늘어나 기한 초과 건수가 화면 아래로 이동했다.
- 결정: 알림 토글은 24×24px 회색 버튼으로 표시하고 펼침 상태에서는 `−`, 접힘 상태에서는 `+`를 유지한다. 알림 목록만 아래로 펼쳐지며 옆의 시기도래·기한 초과 카드는 접힌 상태의 250px 높이와 내부 건수 위치를 유지한다.
- 이유: 작은 보조 동작은 제목보다 과도하게 강조하지 않고, 알림을 확인하는 동안 핵심 지표의 위치가 바뀌지 않아야 사용자가 숫자를 놓치지 않는다.
- 영향 범위: 대시보드 상단 시기도래·기한 초과·알림 영역의 배치와 알림 토글 표시. 데이터 조회, 지표 계산, 역할, READ server와 PostgreSQL에는 영향이 없다.
- 실제 변경: 상단 grid item의 stretch를 제거하고 세 카드의 접힌 높이를 250px로 고정했다. 전체 알림 상태에서는 알림 목록에만 기존 520px 최대 높이와 세로 scroll을 적용한다. 토글에 회색 배경·24px 크기와 펼침 상태 접근성 속성을 추가했다.
- 검증: 접힘과 펼침 상태에서 시기도래·기한 초과 카드의 높이와 기한 초과 건수 위치가 동일하며, 알림 목록만 아래로 확장되는지 확인했다. TypeScript 정적 검사와 Next.js production build를 통과했다.
- 관련 파일: `app/page.tsx`, `app/us-lsx.css`, `WORKLOG.md`
- 관련 commit: pending
