-- ADOMS 데모 2차 — ops_v0.8 추가분 (2026-09-22)
-- ★ ops_v07_add.sql 다음에 돌린다. 여러 생성기가 표마다 이 파일 끝에 덧붙인다.
-- 모두 if not exists 라 여러 번 돌려도 안전하다. 외래키는 걸지 않는다. 스키마: adoms2

-- ════════════════════════════════════════════════════════════════════
-- material_item — 원료·제조물 대장 (시행령 제8조 · 제9조 해당 여부 판단) · 2026-09-22
--   생성기: _build/build_material_v08.py · 시드: ops_v0.8_20260922/seed/material_item.csv
--   근거: 법 제9조제1항(생산ㆍ제조ㆍ판매ㆍ유통) · 시행령 제8조제3호·별표 5(12개 호) · 환경부 해설서 20·108·131쪽
--   판단(verdict)은 사람이 정한다. 행위에서 나오는 제안은 저장하지 않는다(앱 lib/material.ts 가 매번 계산).
-- ════════════════════════════════════════════════════════════════════
set search_path to adoms2, public;

create table if not exists material_item (
  item_id          text primary key,   -- 품목 번호(MAT-…)
  item_name        text,               -- 품목
  dept_id          text,               -- 담당 부서
  owner_staff_id   text,               -- 담당자(제8조제1호 인력 판정에 씀)
  acts             text,               -- 행위: produce·process·enduse·provide 를 「;」로
  byeolpyo5        text,               -- 별표 5: 호 번호(「;」로 여럿) · N(아님) · 빈칸(확인 필요)
  related_law      text,               -- 관계 법령
  verdict          text,               -- 판단: 해당 · 비해당 · 확인 필요
  reason           text,               -- 사유(필수)
  basis_ref        text,               -- 근거(해설서 쪽 또는 「ADOMS 해석(확인 필요)」)
  judged_by        text,               -- 판단자
  judged_at        date,               -- 판단일
  ceo_confirmed_at date,               -- 경영책임자 확인일
  ceo_confirmed_by text,               -- 확인한 사람
  ceo_proxy        text,               -- 총괄이 대신 적은 확인 Y
  updated_at       date,               -- 고친 날
  created_by       text,               -- 올린 사람
  note             text                -- 비고
);

-- ════════════════════════════════════════════════════════════════════
-- incident_response · incident_report · incident_response_setting — 재해 발생 직후 대응 · 2026-09-22
--   생성기: _build/build_incident_response_v08.py · 시드: ops_v0.8_20260922/seed/incident_response.csv · incident_report.csv
--   근거: 시행령 제10조제7호다목(긴급구호·긴급안전점검·위험표지 등 추가 피해방지·관계 행정기관 신고·원인조사 개선)
--         · 시행령 제4조제8호 가·나·다 · 산업안전보건법 제54조제2항 · 같은 법 시행규칙 제73조제1항
--   실무: 서울시 안내서 표 5-8 · 붙임 5-9(최초·직후·수시 보고) · 5-10(보고 칸) · 5-16(언론 창구)
--   incident_response_setting 은 예시 자료가 없다(화면이 씀) — 없으면 최초보고 기한 60분.
-- ════════════════════════════════════════════════════════════════════
set search_path to adoms2, public;

create table if not exists incident_response (
  resp_id          text primary key,   -- 대응 기록 번호(IRS-…)
  incident_id      text,               -- 재해 번호(incident)
  kind             text,               -- 종류: recognize 인지 · call 112·119 · rescue 긴급구호 · inspect 긴급안전점검 · sign 위험표지 · restrict 이용 제한·통제(산업은 작업 중지·대피) · notify 주민 알림 · agency 관계 행정기관 신고 · press 언론 창구 · family 피해자·유가족 연락 · ceo_prevent·ceo_cause 경영책임자 지시
  status           text,               -- 결과: 완료 · 해당 없음 · 지시
  done_at          text,               -- 한 시각(YYYY-MM-DD HH:MM)
  done_by          text,               -- 한 사람(staff_id · 경영책임자는 CEO-1)
  target_org       text,               -- 신고한 기관·대상(지시면 받는 사람 staff_id)
  detail           text,               -- 내용(해당 없음이면 이유)
  evidence_name    text,               -- 증빙 파일 이름
  evidence_url     text,               -- 올린 파일 주소
  proxy            text,               -- 총괄이 대신 적은 경영책임자 지시 Y
  recorded_by      text,               -- 기록한 사람
  recorded_at      text,               -- 기록한 시각
  note             text                -- 비고
);

create table if not exists incident_report (
  report_id           text primary key,   -- 보고 번호(IRP-…)
  incident_id         text,               -- 재해 번호(incident)
  report_stage        text,               -- 단계: 최초보고 · 직후보고 · 수시보고
  seq                 text,               -- 수시보고 차수
  reported_at         text,               -- 보고 시각(YYYY-MM-DD HH:MM)
  reporter_staff_id   text,               -- 보고자
  recipients          text,               -- 수신(경영책임자 · 총괄 · 관계 행정기관)
  agency_name         text,               -- 관계 행정기관 이름
  channel             text,               -- 보고 방법(전화·문자·서면·대면)
  overview            text,               -- 개요(언제·어디서·무엇이·어떻게)
  damage              text,               -- 피해(인명·기타)
  rescue              text,               -- 긴급구조
  recovery            text,               -- 수습(조치·동원 인력·장비)
  support             text,               -- 지원·협조
  next_plan           text,               -- 향후 대책
  evidence_name       text,               -- 보고 문서 이름
  evidence_url        text,               -- 올린 파일 주소
  ceo_ack_at          text,               -- 경영책임자 받은 시각(최초보고)
  ceo_ack_by          text,               -- 받은 사람(CEO-1)
  ceo_ack_proxy       text,               -- 총괄 대리 기록 Y
  ceo_ack_recorded_by text,               -- 받음을 적은 사람
  recorded_by         text,               -- 기록한 사람
  recorded_at         text,               -- 기록한 시각
  note                text                -- 비고
);

create table if not exists incident_response_setting (
  set_id                 text primary key,   -- 설정 번호(IRT-…)
  first_report_limit_min integer,            -- 최초보고 기한(분) — 안내서는 「즉시」, 시간은 기관이 정함
  set_at                 text,               -- 정한 시각
  set_by                 text,               -- 정한 사람
  memo                   text,               -- 정한 근거
  note                   text                -- 비고
);
