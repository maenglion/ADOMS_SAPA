# PostgreSQL READ Cutover Verification

## Scope

- Baseline READ adapter commit: `749c298c33fc6e58faa727abe5f7dd130f968be9`
- Current UI contract: frozen CSV + overlay
- Target READ source: Railway PostgreSQL schema `adoms2`
- WRITE source: unchanged
- Database/schema/data changes: prohibited

## Verification Status

- Preview: in progress
- Production: remains `csv` until Preview passes
- Rollback: set Production `ADOMS_DATA_BACKEND=csv` and redeploy

## Required Gates

- Preview backend is `postgres` without exposing credentials.
- Representative routes and role-specific pages render without server errors.
- Golden HTML, values, key metrics, calculations, and audit-log contract remain equivalent.
- Production cutover occurs only after every Preview mismatch count is zero.
- PostgreSQL physical row count remains 25,022 and WRITE remains unchanged.
