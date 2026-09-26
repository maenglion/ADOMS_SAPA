# ops_v0.2 — 운영·관리 보강 시드 (용인시 데모 2차)

**전부 시연용 예시 데이터다.** 실제 기록이 아니며, 표마다 `note` 칸에 「예시 데이터(시연용)」가 들어 있다.
DDL 은 `_build\ops_v0.2_add.sql` — **01_schema.sql 을 돌린 뒤** 이것을 돌리고, 그다음 아래 CSV 를 넣는다.

| 파일 | 행 | 내용 |
|---|---:|---|
| `task_approval_patch.csv` | 2717 | 기존 `compliance_task` 에 **결재 칸**(작성중·제출·승인·반려 + 제출일·승인일·반려사유) 채우기 — `update … from` 으로 적용 |
| `contract.csv` · `contract_hazard.csv` · `contract_duty.csv` | 24 · 48 · 72 | 도급·용역·위탁 계약 · 위험요인 · 계약별 의무이행 |
| `ceo_activity.csv` | 12 | 기관장(경영책임자) 예방활동 |
| `safety_budget.csv` | 70 | 부서×항목 안전 예산 편성·집행 |
| `training_record.csv` | 28 | 담당자 교육 이수 |
| `worker_voice.csv` | 5 | 종사자 의견 수렴·조치 |
| `incident.csv` | 2 | 재해·사고(가상) → 재발방지대책 |
| `order_received.csv` | 6 | 중앙행정기관·지자체 개선·시정 명령 |
| `law_change.csv` | 3 | 법령 개정 알림 |
| `inspection_batch.csv` | 3 | 점검 회차(취합 배치) · 결재 상태 |

## 결재 칸 적용 SQL (task_approval_patch)

```sql
create temp table _patch (…);          -- CSV 임포트용 임시표
update adoms2.compliance_task t set
  approval_status = p.approval_status, created_by = p.created_by,
  submitted_at = nullif(p.submitted_at,'')::timestamptz, submitted_by = p.submitted_by,
  approved_at  = nullif(p.approved_at,'')::timestamptz,  approved_by  = p.approved_by,
  rejected_at  = nullif(p.rejected_at,'')::timestamptz,  reject_reason = p.reject_reason,
  created_at   = nullif(p.created_at,'')::timestamptz,
  period_year = p.period_year, half_year = p.half_year,
  plan_date = nullif(p.plan_date,'')::date, evidence_cnt = p.evidence_cnt,
  check_result = p.check_result
from _patch p where p.task_id = t.task_id;
```

생성 2026-09-20 23:48 · `_build\build_ops_v02_seed.py`
