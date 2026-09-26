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
