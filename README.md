# Trioloo Java ERP

Multi-channel retail ERP for Trioloo — Daraz shops, websites, Facebook, WhatsApp, phone and walk-in, predominantly Cash on Delivery.

---

## 🔴 Canonical architecture lives in `docs/`, not in code

The V1 architecture is **frozen** under the baseline **`FREEZE-V1-2026-08-11`**, recorded at `DOC-077` in [`docs/MASTER_DOCUMENTATION_INDEX.md`](docs/MASTER_DOCUMENTATION_INDEX.md).

**Code does not define business truth.** If production code conflicts with frozen canonical architecture, **the code is the defect** (`DOC-080`, `CLAUDE.md` §6). The remedy is to fix the code, or amend the architecture through the governed procedure at `DOC-079` — never to let the divergence stand.

Start at [`CLAUDE.md`](CLAUDE.md) for task routing, then read the owning document for whatever you are changing. This README is **not** an architecture document and deliberately duplicates none of them.

| Question | Authority |
|---|---|
| Business / domain behaviour | The owning architecture document in `docs/` |
| Stack, versions, technical construction | [`docs/TECHNOLOGY_ARCHITECTURE.md`](docs/TECHNOLOGY_ARCHITECTURE.md) |
| Engineering discipline, layering, money rules | [`docs/PROJECT_CONSTITUTION.md`](docs/PROJECT_CONSTITUTION.md) |
| Visual language, tokens, accessibility | [`docs/DESIGN_CONSTITUTION.md`](docs/DESIGN_CONSTITUTION.md) |
| Navigation, page composition, interaction | [`docs/UI_UX_ARCHITECTURE.md`](docs/UI_UX_ARCHITECTURE.md) |
| Document ownership and index | [`docs/MASTER_DOCUMENTATION_INDEX.md`](docs/MASTER_DOCUMENTATION_INDEX.md) |

---

## Repository layout

```
CLAUDE.md      Operating manual — task routing
docs/          Canonical architecture (34 documents) + design-reference/
backend/       Spring Boot application
frontend/      React + TypeScript + Vite application
```

## Current implementation status

**Stage 4, Step 1 — Application Foundation.** Runnable baseline only.

Not yet implemented, by design: **no business module**, no Inventory, **no authentication or authorization**, and **not the final application shell** (sidebar, header utilities, workspaces). Each is a separate bounded step.

---

## Prerequisites

| Tool | Required version | Why |
|---|---|---|
| **JDK 25 (LTS)** | 25 | `TECHNOLOGY_ARCHITECTURE.md` §1.1 |
| **Maven** | 3.9+ | `TECHNOLOGY_ARCHITECTURE.md` §1.1 |
| **PostgreSQL** | 18.x | `TECHNOLOGY_ARCHITECTURE.md` §1.2 |
| **Node.js** | 20+ | Required by Vite 7 |

> These versions are locked. `TEC-003` requires a **proven requirement recorded as an amendment** before any of them changes — "it would be convenient" is not one.

### Verified local toolchain

The reference development machine has no administrator rights, so the toolchain is installed **per-user from official archives** under `%USERPROFILE%\dev-tools\` — no Windows service, no elevation:

| Component | Location | Verified |
|---|---|---|
| Temurin JDK 25 | `dev-tools\jdk-25.0.4+7` | `25.0.4` LTS |
| Apache Maven | `dev-tools\apache-maven-3.9.11` | `3.9.11`, running on the same JDK 25 |
| PostgreSQL | `dev-tools\pgsql` + cluster in `dev-tools\pgdata` | `18.2` |

`JAVA_HOME` and `PATH` are set at **user** scope. Start and stop the database cluster with:

```powershell
& "$env:USERPROFILE\dev-tools\pgsql\bin\pg_ctl.exe" -D "$env:USERPROFILE\dev-tools\pgdata" -l "$env:USERPROFILE\dev-tools\pg.log" start
& "$env:USERPROFILE\dev-tools\pgsql\bin\pg_ctl.exe" -D "$env:USERPROFILE\dev-tools\pgdata" stop
```

Local credentials live in `dev-tools\*.local` and `backend/.env` — both outside version control.

## Local setup

**1. Database**

```sql
CREATE DATABASE trioloo_erp;
CREATE USER trioloo WITH PASSWORD 'your-local-password';
GRANT ALL PRIVILEGES ON DATABASE trioloo_erp TO trioloo;
```

**2. Environment** — copy the examples and fill in local values. Both `.env` files are git-ignored; never commit real credentials.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

The backend reads `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, `SERVER_PORT` from the environment. Spring Boot does not read `.env` files itself, so export them before running Maven (or use your IDE's env-file support):

```powershell
Get-Content backend\.env | Where-Object { $_ -notmatch '^\s*#' -and $_ -match '=' } |
  ForEach-Object { $k,$v = $_ -split '=',2; Set-Item -Path "env:$k" -Value $v }
```

## Running

**Backend** — <http://localhost:8080>

```bash
cd backend
mvn spring-boot:run
```

Flyway applies migrations from `backend/src/main/resources/db/migration` at startup. Health: <http://localhost:8080/actuator/health>

**Frontend** — <http://localhost:5173>

```bash
cd frontend
npm install
npm run dev
```

## Tests and checks

```bash
cd backend  && mvn test          # needs PostgreSQL running; uses the ISOLATED test database
cd frontend && npm run typecheck # strict TypeScript, no emit
cd frontend && npm run test      # vitest — shell, navigation and folding behaviour
cd frontend && npm run build     # type check + production build
```

> **Backend tests never touch the development database.** They run against `trioloo_erp_test`
> (`src/test/resources/application.yml`), because fixture cleanup is destructive by design.
> `DevelopmentDatabaseIsolationTest` fails fast if that is ever misconfigured. Export
> `TEST_DB_PASSWORD` before running `mvn test`.

---

## Conventions that are not negotiable

These are consequences of frozen rules, not preferences. Each is owned elsewhere; the citation is the authority.

- **Money is `BigDecimal` in Java and `NUMERIC` in PostgreSQL.** `float`, `double`, `Float` and `Double` are prohibited in any monetary path — including DTOs, projections, test fixtures and mappers (`PRJ-040`, `TEC-010`).
- **Money crosses REST as a JSON string**, never a JSON number — annotate DTO fields with `@MonetaryAmount` (`TEC-015`). The client performs no arithmetic on money (`TEC-095`).
- **Rounding policy is owned by `DB-079`** and applied, never reinterpreted: 2dp `HALF_UP`, line rounded before aggregation, totals summed from already-rounded lines, rates and weighted-average costs at higher precision (`PRJ-041`).
- **Flyway owns schema.** `ddl-auto` is `validate`; an applied migration is never edited (`PRJ-080`, `PRJ-081`).
- **Derived positions are never stored.** No cached or duplicated balance columns (`DB-001`, `CP-12`).
- **Module layering is `api → application → domain`**, infrastructure pointing inward. `domain` imports no Spring, no Jakarta Persistence, no Jackson (`PRJ-021`, `PRJ-030`).
- **`Asia/Dhaka` is the canonical business timezone**; a business date is never derived from an instant without applying it (`TEC-050`, `TEC-052`).
- **No opinionated component library** — Material UI, Ant Design and Bootstrap are excluded. `DESIGN_CONSTITUTION.md` is the design authority and a library shipping its own type scale, radius set and colour ramp is a competing one (`TEC-091`).
- **OKLCH tokens are canonical.** Never eye-match a colour, hard-code a hex substitute, or approximate a token with opacity (`RULE 15.1`). `frontend/src/design/tokens.css` transcribes the Constitution; if the two disagree, that file is the defect.
- **Browser zoom is never suppressed**, and zoom never changes records, page size, fields, actions or API behaviour (`RULE 7.3.a`, `RULE 7.9`).
