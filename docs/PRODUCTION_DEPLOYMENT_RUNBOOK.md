# Production Deployment Runbook

**Owner:** Trioloo Technology · **Module:** Cross-cutting operations · **Status:** Canonical
**Version:** 1.5.0 · **Ratified:** 2026-08-16 (`DOC-091`) · **Amended:** 2026-08-17 (`DEP-124` Daraz production configuration; `DEP-090.a`–`.b` superseded) · **Amended:** 2026-08-16 (`DEP-123` integration credential encryption key) · **Amended:** 2026-08-16 (`DEP-122` production session-cookie security) · **Amended:** 2026-08-16 (`DEP-121` frontend same-origin build; `DEP-042.c`–`.f`, `DEP-050.f`–`.g` — frontend layout established) · **Amended:** 2026-08-16 (`DEP-081.d` — `GAP-120` closed) · **Rule prefix:** `DEP-`

> 🔴 **THIS DOCUMENT RATIFIES INFRASTRUCTURE THAT ALREADY EXISTS. IT INVENTS NONE.** **The host, the reverse proxy, the routing model and the origin address are USER DECISIONS**, recorded here so a deployment agent never has to choose them — and never may.
>
> 🔴 **IT IS AN OPERATIONS AUTHORITY, NOT A BUSINESS AUTHORITY.** It creates no business rule, no lifecycle, no permission and no API meaning. Where it names an application fact, that fact is transcribed from source and cited.
>
> ⚠ **EVERY COMMAND AND PATH BELOW WAS READ OUT OF THIS REPOSITORY.** Nothing is a generic Java-deployment convention. Where the repository genuinely does not know something — the service name, the nginx file path, the production database identity — **this document says so and makes it a DISCOVERY ITEM rather than guessing** (`DEP-040`, `DEP-050`).

**Inherits:** [`TECHNOLOGY_ARCHITECTURE.md`](TECHNOLOGY_ARCHITECTURE.md) (`TEC-115`–`TEC-118`) · [`PROJECT_CONSTITUTION.md`](PROJECT_CONSTITUTION.md) (`PRJ-081` migrations) · [`GAP_ANALYSIS.md`](GAP_ANALYSIS.md) (`GAP-120`, `GAP-133`).

---

# 1. Production topology

> **`DEP-001` — ✅ THE RATIFIED PRODUCTION TOPOLOGY.**
>
> | Layer | Fact |
> |---|---|
> | **Public application** | `https://user.trioloo.com` |
> | **DNS / edge** | **Cloudflare proxied** (`DEP-020`) |
> | **Production origin** | **`159.223.47.70`** — 🔴 the authoritative server identity |
> | **Hosting** | **DigitalOcean droplet, Ubuntu** |
> | **Web server / reverse proxy** | **Nginx** — serves the frontend and proxies the API (`DEP-050`) |
> | **Frontend** | the **static production build**, served by Nginx |
> | **Backend** | the Java ERP backend, an **OS-managed service** (`DEP-040`) |
> | **Backend bind address** | 🔴 **`127.0.0.1:8080` — LOCAL ONLY.** It is never published directly; Nginx is the only ingress |
> | **Database** | the production PostgreSQL database (`TEC-001`) |
> | **Schema** | **Flyway**, forward-only, applied migrations immutable (`DEP-030`) |
>
> **a.** ✅ **ONE DEPLOYABLE BACKEND, ONE AUTHORITATIVE DATABASE** (`TEC-002`). **The modular monolith is deployed as a single service; the `system`, `integration` and `product` modules are internal boundaries, not deployment units.**
> **b.** 🔴 **NO CONTAINER, ORCHESTRATOR OR CI/CD PLATFORM IS PART OF THIS TOPOLOGY** (`TEC-115`). ⚠ **Their absence is a RECORDED POSITION, not an oversight, and introducing one is a `TEC-003` amendment.**

> **`DEP-002` — ✅ PUBLIC ROUTING INTENT.**
>
> | Path | Destination |
> |---|---|
> | `/` | the frontend static application |
> | `/api/` | the backend at `127.0.0.1:8080` |
> | `/api/integration/daraz/callback` | ✅ **THE DARAZ OAUTH CALLBACK, IMPLEMENTED.** **It sits under `/api/`, so the EXISTING proxy rule already serves it** — 🔴 **no separate Nginx location is needed or permitted** (`DEP-124`). |
>
> **a.** ⚠ **THE BACKEND'S OWN CONTROLLERS ARE ALREADY MOUNTED UNDER `/api/…`** — `/api/auth/…`, `/api/system/shops`, `/api/integration/channel-connections/…`, `/api/product/…`. **The proxy therefore passes `/api/` through and must NOT strip the prefix**, or every route 404s.
> **b.** ⚠ **`/actuator/health` IS NOT UNDER `/api/`.** The backend exposes it at its own root, and it is the only management endpoint exposed (`DEP-003`). 🔴 **Whether it is reachable publicly depends on the existing Nginx configuration and is a DISCOVERY ITEM** (`DEP-050.c`) — this document does not assert that `https://user.trioloo.com/api/actuator/health` resolves, and the previous gate's probe of that URL proves nothing about it.
> **c.** ✅ **THE FRONTEND AND THE API SHARE ONE ORIGIN in production**, so the browser makes same-origin requests and **no CORS entry is required**. ⚠ **Should one ever be needed, the property is `app.cors.allowed-origins`, which defaults to `http://localhost:5173`** — a development default that is correct precisely because production does not rely on it.

> **`DEP-003` — ✅ THE ONLY EXPOSED MANAGEMENT ENDPOINT IS HEALTH.** `application.yml` exposes `include: health` with `show-details: never`, and `SecurityConfig` permits `/actuator/health` unauthenticated. 🔴 **No other actuator endpoint is exposed, and none may be opened to satisfy a deployment check.**

---

# 2. Authority and scope

> **`DEP-010` — 🔴 WHAT THIS DOCUMENT MAY AND MAY NOT DECIDE.**
>
> **a.** ✅ **IT DECIDES THE OPERATIONAL SEQUENCE** — order of steps, gates, stop conditions, verification.
> **b.** 🔴 **IT DECIDES NO BUSINESS RULE.** ⚠ **If a deployment appears to require a business decision, that is a `CLAUDE.md` §5 stop, not a runbook edit.**
> **c.** 🔴 **IT NEVER AUTHORISES A COMMIT OR A PUSH.** **Those remain explicit user instructions** (`AGENTS.md`).
> **d.** 🔴 **IT NEVER AUTHORISES A SCHEMA CHANGE MADE BY HAND.** **Every schema change is a migration** (`PRJ-081`).

---

# 3. Server and origin identity

> **`DEP-020` — 🔴 THE CLOUDFLARE EDGE IS NOT THE SERVER.**
>
> **`user.trioloo.com` resolves through Cloudflare.** A DNS lookup returns Cloudflare edge addresses — observed in the `104.21.x.x`, `172.67.x.x` and `2606:4700::/32` ranges — **and those are ANYCAST EDGE NODES belonging to Cloudflare.**
>
> **a.** 🔴 **NEVER SSH TO A RESOLVED `user.trioloo.com` ADDRESS.** ⚠ **It is not the ERP server and does not belong to Trioloo.**
> **b.** ✅ **THE OPERATIONAL ORIGIN IS `159.223.47.70`, ALWAYS.** **Every server-side step in this runbook targets that host and nothing else.**
> **c.** ⚠ **A PUBLIC HTTP STATUS DESCRIBES THE EDGE'S VIEW, NOT THE APPLICATION.** **A Cloudflare `5xx` such as `521` is the edge reporting that it could not reach the origin; it is EVIDENCE TO INVESTIGATE ON THE ORIGIN, never a diagnosis** (`DEP-100`).

> **`DEP-021` — 🔴 NO CREDENTIAL EVER ENTERS THIS REPOSITORY.**
>
> **a.** ✅ **Production access is authorised SSH to `159.223.47.70` using the operator's existing secure credential mechanism.** ⚠ **A host alias is convenient and optional; direct host access is acceptable.**
> **b.** 🔴 **NO PASSWORD, PRIVATE KEY, TOKEN, DATABASE PASSWORD OR SECRET IS WRITTEN INTO THIS DOCUMENT, ANY OTHER DOCUMENT, ANY SCRIPT, OR ANY COMMIT.** **Secrets live outside source control**, exactly as `backend/.env` already is.
> **c.** ⚠ **WHERE AN AGENT CANNOT REACH THE SERVER, IT ASKS THE OPERATOR TO MAKE AN AUTHORISED SESSION AVAILABLE.** 🔴 **It does not attempt to obtain, guess or store access itself, and it does not proceed without it.**
> **d.** 🔴 **A REPORT NEVER PRINTS A SECRET**, including in command echoes, environment dumps and log excerpts.

---

# 4. Build artifacts

> **`DEP-030` — ✅ THE TWO ARTIFACTS, AS THE BUILD ACTUALLY PRODUCES THEM.**
>
> | | Backend | Frontend |
> |---|---|---|
> | **Build command** | `mvn package` in `backend/` | `npm run build` in `frontend/` |
> | **What that runs** | compile · **the full test suite** · `spring-boot-maven-plugin` repackage | `tsc --noEmit && vite build` |
> | **Output** | `backend/target/<artifactId>-<version>.jar` | `frontend/dist/` |
> | **Currently** | `trioloo-erp-backend-0.1.0-SNAPSHOT.jar` | `dist/index.html` + `dist/assets/` |
> | **Form** | a **Spring Boot executable jar** with nested dependencies | static files, no server runtime |
>
> **a.** ⚠ **THE JAR NAME IS DERIVED, NOT FIXED.** `pom.xml` sets no `<finalName>`, so the file follows `artifactId` and `version`. 🔴 **A deployment step must resolve the actual produced file rather than assuming today's string** — the version WILL change.
> **b.** ✅ **`vite.config.ts` DOES NOT OVERRIDE `outDir`**, so `dist/` is Vite's default and is the artifact directory.
> **c.** 🔴 **THE ARTIFACT DEPLOYED IS THE ARTIFACT VERIFIED.** ⚠ **No production-only source edit, no server-side patch, no "small fix while we are here"** (`DEP-011` intent, `CLAUDE.md` §4).

---

# 5. Production pre-flight

> **`DEP-031` — ✅ INSPECT BEFORE CHANGING. Read-only, in this order.**
>
> **1.** ✅ **Local gate is green** (`DEP-032`).
> **2.** ✅ **SSH to `159.223.47.70` succeeds** (`DEP-021`).
> **3.** ✅ **Backend service state and whether it is in a restart loop** (`DEP-040`).
> **4.** ✅ **Nginx active, and `nginx -t` reports the configuration valid** (`DEP-050`).
> **5.** ✅ **The backend is listening on `127.0.0.1:8080`**, and is not bound to a public interface.
> **6.** ✅ **Database connectivity from the server**, using the production environment's own configuration (`DEP-060`).
> **7.** ✅ **`flyway_schema_history` read** — current version and any failed row (`DEP-070`).
> **8.** ✅ **Disk capacity sufficient for a database backup plus both artifacts.**
> **9.** ✅ **Application log reviewed for pre-existing fatal errors.** ⚠ **A failure that already existed is recorded, not silently inherited by this deployment.**
>
> 🔴 **NOTHING IS MODIFIED DURING PRE-FLIGHT.**

> **`DEP-032` — 🔴 THE LOCAL GATE. A FAILING BUILD IS NEVER DEPLOYED.**
>
> | Check | Command | Required |
> |---|---|---|
> | Backend tests + artifact | `mvn package` in `backend/` | **BUILD SUCCESS**, zero failures |
> | Frontend types | `npm run typecheck` | clean |
> | Frontend tests | `npm run test` | all pass |
> | Frontend artifact | `npm run build` | succeeds |
> | Migration ceiling | inspect `backend/src/main/resources/db/migration/` | matches expectation (`DEP-070.e`) |
>
> ⚠ **Backend tests run against the ISOLATED `trioloo_erp_test` database and never touch development or production data** — `DevelopmentDatabaseIsolationTest` is the tripwire that keeps that true.

---

# 6. Database backup gate

> **`DEP-060` — 🔴 NO MIGRATION WITHOUT A VERIFIED BACKUP. THIS GATE HAS NO EXCEPTION.**
>
> **a.** ✅ **Identify the production database engine, host, name and user FROM THE SERVER'S OWN CONFIGURATION** — the service environment and `application.yml`'s `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USERNAME` / `DB_PASSWORD` variables. 🔴 **This document names no production database, user or password, because the repository does not know them and guessing one would be fabrication.**
> **b.** ✅ **Create a TIMESTAMPED backup** using the server's existing PostgreSQL tooling.
> **c.** ✅ **VERIFY THE COMMAND SUCCEEDED** — exit status checked, not assumed.
> **d.** ✅ **VERIFY THE ARTEFACT EXISTS AND IS NON-EMPTY.** ⚠ **A zero-byte backup is a failed backup that reports success.**
> **e.** ✅ **RECORD method, timestamp and path** in the deployment report. 🔴 **Never the credentials used.**
> **f.** 🔴 **IF ANY OF a–d FAILS: STOP BEFORE MIGRATION.** **Deploying past a failed backup converts a recoverable incident into an unrecoverable one.**

---

# 7. Flyway gate

> **`DEP-070` — 🔴 FORWARD-ONLY, IMMUTABLE, AND NEVER IMPROVISED.**
>
> **a.** 🔴 **AN APPLIED MIGRATION IS NEVER MODIFIED** (`PRJ-081`). **`V1`–`V12` are applied history.** ⚠ **Editing one changes its checksum and Flyway will refuse to start the application — correctly.**
> **b.** ✅ **PENDING MIGRATIONS ARE DETERMINED BY COMPARING SOURCE AGAINST PRODUCTION `flyway_schema_history`.** 🔴 **NEVER ASSUMED.** ⚠ **Production may be at any version; it is not necessarily behind development.**
> **c.** 🔴 **MIGRATION SQL IS NEVER RECREATED BY HAND ON THE SERVER**, and the schema is never altered directly to "make it work".
> **d.** 🔴 **A VALIDATION OR CHECKSUM ERROR IS A FULL STOP.** `spring.flyway.validate-on-migrate` is `true`; that is the guard working, and it is investigated, not bypassed.
> **e.** ✅ **Current source ceiling is `V12`** — `V11__shops_and_channels.sql`, `V12__market_closed_set.sql` — ⚠ **unless disk inspection proves a later migration exists, in which case DISK WINS and it is inspected before deployment.**
> **f.** 🔴 **`spring.flyway.baseline-on-migrate` IS `false`.** ⚠ **A non-empty production database with NO history table will therefore FAIL rather than silently baseline. That is intended: it must be investigated, never "fixed" by enabling baselining.**

> **`DEP-071` — 🔴 MIGRATIONS RUN IN-PROCESS, AT BACKEND STARTUP. THIS IS THE SEQUENCING FACT THAT GOVERNS THE WHOLE DEPLOYMENT.**
>
> **`spring.flyway.enabled: true` with `locations: classpath:db/migration`, and no standalone Flyway CLI exists in this project.** ✅ **"Apply pending migrations" therefore MEANS "start the new backend artifact", and the two cannot be ordered independently.**
>
> **a.** 🔴 **THE BACKUP GATE CLOSES BEFORE THE NEW BACKEND IS STARTED** (`DEP-060`), because starting it IS the migration.
> **b.** ⚠ **A failed migration will prevent the application from starting.** ✅ **That is the safe failure, and the response is `DEP-110`, never a hand-edited schema.**

---

# 8. Backend deployment

> **`DEP-040` — ✅ THE BACKEND RUNS AS AN OS-MANAGED SERVICE. 🔴 ITS NAME IS A DISCOVERY ITEM.**
>
> **a.** 🔴 **THIS REPOSITORY CONTAINS NO SERVICE DEFINITION, AND THIS DOCUMENT INVENTS NO SERVICE NAME, UNIT FILE, USER OR INSTALL PATH.** ⚠ **A guessed unit name is worse than no name: it produces a command that appears to work and manages the wrong thing, or nothing.**
> **b.** ✅ **THE EXACT SERVICE NAME, ITS UNIT, ITS RUN USER, ITS WORKING DIRECTORY, ITS ENVIRONMENT SOURCE AND ITS INSTALLED JAR PATH ARE DISCOVERED ON THE SERVER DURING PRE-FLIGHT** and recorded in the deployment report.
> **c.** ⚠ **THIS IS AN OPERATIONAL DISCOVERY, NOT A BLOCKING DECISION.** **It requires no canon and no platform choice** (`DEP-120.b`).
> **d.** ✅ **Whatever manages it, the process must bind `127.0.0.1:8080`** (`DEP-001`).
>
> **Sequence, once the name is known:**
> **1.** ✅ **STAGE the new jar beside the current one — never overwrite in place.** ⚠ **The currently installed artifact must remain intact and identifiable for `DEP-110.a`.**
> **2.** ✅ **Stop the service.**
> **3.** ✅ **Swap the active artifact to the staged one.**
> **4.** ✅ **Start the service.** 🔴 **Pending migrations apply here** (`DEP-071`).
> **5.** ✅ **Watch startup to completion** — Flyway result, port bound, no restart loop.

> **`DEP-041` — 🔴 THE PRODUCTION PROFILE NEVER CARRIES DEVELOPMENT AUTHORITY.**
>
> **`DevelopmentAuthorityBootstrap` grants the local identity every defined permission and is guarded by three gates: the `dev-authority` profile, `trioloo.dev.identity.provision=true`, and no production-looking active profile.** ✅ **The third gate THROWS rather than skipping** — a production system that activated it fails to start by design.
>
> **a.** 🔴 **PRODUCTION MUST NOT RUN THE `dev-authority` PROFILE.**
> **b.** ⚠ **If the backend refuses to start citing a production profile alongside that bootstrap, the SERVER CONFIGURATION is wrong. Fix the configuration; never weaken the guard.**

---

# 9. Frontend deployment

> **`DEP-042` — ✅ STATIC FILES, STAGED THEN SWAPPED.**
>
> **a.** ✅ **DEPLOY THE VERIFIED `dist/` FROM THE LOCAL GATE.** 🔴 **Do not rebuild a different tree on the server**; the artifact that was tested is the artifact that ships (`DEP-030.c`).
> **b.** ✅ **STAGE THE NEW BUILD BESIDE THE ACTIVE ONE, THEN SWAP**, so the served directory is never half-written. ⚠ **Copying file-by-file over a live directory serves a mixed build to whoever loads the page mid-copy.**
> **c.** ~~✅ **THE EXISTING SERVED PATH IS DISCOVERED FROM THE RUNNING NGINX CONFIGURATION** (`DEP-050`). 🔴 **This document invents no web root.**~~ → ✅ **SUPERSEDED 2026-08-16: THE WEB ROOT NOW EXISTS AND IS RECORDED IN `DEP-042.f`.** ⚠ **It was a discovery item only because no frontend had ever been deployed; it was established by the first frontend deployment, not invented by this document.**
> **d.** ✅ **KEEP THE PREVIOUS BUILD RECOVERABLE** until the smoke gate passes (`DEP-110.a`).
> **e.** ✅ **THE ARTIFACT IS PROVEN IDENTICAL ON ARRIVAL.** **Compare a per-file checksum manifest of the local `dist/` against the staged release before activating.** 🔴 **A mismatching artifact is NEVER activated** — ⚠ **a transfer that silently truncated one file produces a site that loads and then fails in ways no log explains.**
> **f.** ✅ **THE ESTABLISHED PRODUCTION FRONTEND LAYOUT, first deployed 2026-08-16:**
>
> | | |
> |---|---|
> | **Releases** | `/var/www/trioloo-erp/releases/<UTC-timestamp>/` — **immutable once staged** |
> | **Active** | `/var/www/trioloo-erp/current` — **a symlink, swapped atomically** |
> | **Nginx root** | `/var/www/trioloo-erp/current` |
>
> 🔴 **A RELEASE DIRECTORY IS NEVER EDITED IN PLACE AND NEVER REBUILT ON THE SERVER.** ⚠ **Rolling back is repointing the symlink and reloading Nginx; it is not restoring files over a live directory.** ✅ **Node, npm and the frontend toolchain are NOT installed in production and must not be** — **the server serves static files it did not build.**

---

# 10. Nginx

> **`DEP-050` — ✅ NGINX IS THE RATIFIED WEB AND REVERSE-PROXY LAYER. 🔴 ITS CONFIGURATION PATH IS A DISCOVERY ITEM.**
>
> **a.** ✅ **Routing intent is `DEP-002`** — `/` to the static application, `/api/` to `127.0.0.1:8080`, `/daraz/callback` reserved (`DEP-090`).
> **b.** 🔴 **THIS DOCUMENT NAMES NO NGINX FILE, SITE NAME, WEB ROOT OR INCLUDE PATH, AND THIS TASK ADDS NO NGINX CONFIGURATION.** **The existing production configuration is authoritative and is read on the server.**
> **c.** ✅ **DISCOVER AND RECORD:** the active site file, the frontend root, the `/api/` proxy block and whether it preserves the `/api` prefix (`DEP-002.a`), and **whether `/actuator/health` is reachable through the proxy** (`DEP-002.b`).
> **d.** 🔴 **NGINX IS NOT MODIFIED UNLESS THE DEPLOYMENT GENUINELY REQUIRES A CORRECTION**, and any change is reported explicitly with its reason.
> **e.** ✅ **AFTER ANY CHANGE: `nginx -t` MUST PASS BEFORE RELOAD.**
> **f.** ✅ **THE SPA FALLBACK IS `try_files $uri $uri/ /index.html`, AND IT IS SCOPED TO `location /`.** **A client-side route such as `/administration/shops` has no file on disk and must not 404.**
> **g.** 🔴 **THE FALLBACK MUST NEVER SWALLOW `/api/` OR THE ACME CHALLENGE PATH.** ⚠ **An API request answered with `index.html` returns HTTP 200 and an HTML body to a caller expecting JSON — a missing endpoint would then look like a parse bug instead of a 404.** ✅ **`/api/` is a longer prefix match and the ACME location uses `^~`, so both are matched before `location /` is ever considered; verify this by asserting that an unknown `/api/` path does NOT return HTML.**

---

# 10a. Frontend production build

> **`DEP-121` — 🔴 THE PRODUCTION BUNDLE MUST RESOLVE THE API SAME-ORIGIN, AND THIS IS VERIFIED IN THE BUILT ARTIFACT, NOT IN THE SOURCE.**
>
> **a.** ✅ **The frontend and the API share one origin** (`DEP-002.c`), **so the browser must issue RELATIVE `/api/...` requests.** **`frontend/.env.production` sets `VITE_API_BASE_URL` EMPTY to produce exactly that**, and it is committed because a build configuration that only exists on one machine is not a configuration.
> **b.** 🔴 **THE BUILT BUNDLE MUST CONTAIN NO `localhost` API BASE.** **Grep the generated `dist/` for `http://localhost`, `127.0.0.1` and `:8080` before deploying; the required count is ZERO.**
> **c.** ⚠ **THIS IS A REAL DEFECT CLASS, NOT A PRECAUTION — IT WAS CAUGHT AT THE 2026-08-16 GATE.** **`api.ts` falls back to `http://localhost:8080` when the variable is absent, so a missing production value does not fail the build: it produces a bundle that silently points every browser at the OPERATOR'S OWN MACHINE, where it is additionally blocked as mixed content.** 🔴 **Deleting `.env.production` does not mean 'no base URL' — it restores the development fallback.**
> **d.** ✅ **A third-party library may legitimately contain the string `localhost`** — **React Router uses `http://localhost` as a placeholder base for URL parsing, immediately replaced by `location.origin`.** ⚠ **Identify what any remaining occurrence IS before accepting it; do not accept a non-zero count by assumption.**
> **e.** ✅ **The deployed page must make ZERO requests to `localhost` and ZERO plain-HTTP requests.** **Verify against the REAL deployed origin, not a local preview.**

---

# 10b. Production session-cookie security

> **`DEP-122` — 🔴 THE PRODUCTION SESSION COOKIE MUST BE `Secure` AND `HttpOnly`, AND `Secure` IS NOT ACHIEVED BY THE FORWARDED-HEADERS SETTING ALONE.**
>
> **a.** ✅ **REQUIRED PRODUCTION ENVIRONMENT SETTINGS**, supplied through the systemd `EnvironmentFile` and never hard-coded in Java:
>
> | Variable | Value | What it actually fixes |
> |---|---|---|
> | `SERVER_FORWARD_HEADERS_STRATEGY` | `framework` | **Spring reads Nginx's `X-Forwarded-Proto`, so `request.isSecure()` is true.** ✅ **This makes Spring Security's `XSRF-TOKEN` `Secure`.** |
> | `SERVER_SERVLET_SESSION_COOKIE_SECURE` | `true` | 🔴 **`JSESSIONID`. The setting above does NOT reach it.** |
>
> **b.** 🔴 **WHY TWO SETTINGS ARE NEEDED — THE TWO COOKIES HAVE DIFFERENT AUTHORS.** **`XSRF-TOKEN` is written by Spring Security's `CookieCsrfTokenRepository`, which is handed the `ForwardedHeaderFilter`-WRAPPED request and therefore sees HTTPS.** **`JSESSIONID` is minted by TOMCAT itself, in `ApplicationSessionCookieConfig.createSessionCookie`, from its own connector's view of the request — and that connector is plain HTTP on `127.0.0.1:8080`.** ⚠ **`ForwardedHeaderFilter` is a SERVLET FILTER: it can only WRAP the request, so it can never change what the container below it believes.**
> **c.** 🔴 **THEREFORE: NEVER INFER `JSESSIONID`'s FLAGS FROM `XSRF-TOKEN`'s.** ⚠ **This exact mistake was made at the 2026-08-16 gate: `XSRF-TOKEN` carried `Secure`, which was taken as evidence the session cookie did too. Direct browser observation proved it did not.** ✅ **OBSERVE THE `Set-Cookie` HEADER FOR `JSESSIONID` ITSELF.**
> **d.** ✅ **HOW TO VERIFY WITHOUT ANY CREDENTIAL.** **An UNAUTHENTICATED request to a protected endpoint — for example `GET /api/auth/me` — returns `401` AND STILL ISSUES A `JSESSIONID`.** ✅ **Read the flags from that response.** 🔴 **No password, no session value and no test-only route is required, and nothing is mutated.**
> **e.** ✅ **REQUIRED RESULT:** `Set-Cookie: JSESSIONID=…; Path=/; Secure; HttpOnly`. 🔴 **`HttpOnly` MUST BE PRESERVED** — **the session cookie is never script-readable.** ⚠ **`XSRF-TOKEN` MUST NOT become `HttpOnly`: the SPA has to read it to send the `X-XSRF-TOKEN` header.**
> **f.** ⚠ **`Secure` BECOMES UNCONDITIONAL, BY DESIGN.** **The property means 'always mark the cookie secure', so the cookie is `Secure` even on a plain-HTTP request to the backend directly.** ✅ **This is correct here because the setting lives ONLY in the production environment file, where the public boundary is HTTPS-only.** 🔴 **Do not add it to local development**, where a browser would then refuse to return the cookie over `http://localhost`.
> **g.** ✅ **`SameSite` IS NOT SET AND IS NOT RATIFIED** (2026-08-16). 🔴 **Do not introduce one as a side effect of a `Secure` correction** — **it is a separate decision with its own consequences for the OAuth return leg** (`DEP-090`).

---

# 10c. Integration credential encryption key

> **`DEP-123` — 🔴 THE PROVIDER-CREDENTIAL ENCRYPTION KEY IS DEPLOYMENT CONFIGURATION AND LIVES NOWHERE ELSE.**
>
> **a.** ✅ **REQUIRED VARIABLE NAMES** in the systemd `EnvironmentFile` (`TEC-119.f`):
>
> | Variable | Meaning |
> |---|---|
> | `INTEGRATION_CREDENTIAL_ENCRYPTION_KEYS` | `version:base64key[,version:base64key…]`, each key exactly 256 bits |
> | `INTEGRATION_CREDENTIAL_ENCRYPTION_ACTIVE_KEY_VERSION` | which version encrypts NEW material |
>
> **b.** 🔴 **NO KEY VALUE APPEARS IN THIS DOCUMENT, IN THE REPOSITORY, IN THE DATABASE OR IN ANY LOG.** ✅ **Ciphertext lives in PostgreSQL and the key lives in `/etc/trioloo-erp/backend.env` (`0640 root:trioloo`), so a database backup ON ITS OWN IS USELESS** — which is the entire reason for encrypting at rest.
> **c.** ✅ **SEVERAL VERSIONS MAY BE CONFIGURED AT ONCE.** **New writes use the active version; existing rows stay readable under the version recorded against them**, so a key is rotated without decrypting every row at once.
> **d.** ✅ **MALFORMED CONFIGURATION FAILS AT STARTUP** — unknown version, duplicate version, bad Base64, a key that is not 256 bits, an active version absent from the set, or one variable set without the other. 🔴 **A validation failure names the structural fault and at most the offending VERSION NUMBER; it never quotes key material, a fragment of it, or its decoded length.**
> **e.** ⚠ **ABSENT IS PERMITTED AND IS NOT THE SAME AS BROKEN.** **No provider adapter exists yet, so an environment with nothing to protect starts normally.** 🔴 **Attempting to store or read credential material while unconfigured fails LOUDLY at first use.** ✅ **What cannot happen is a token being stored unprotected.**
> **f.** 🔴 **DO NOT SET THESE IN LOCAL DEVELOPMENT FROM A PRODUCTION KEY.** **Test configuration carries its own throwaway key material whose decoded bytes literally spell out that they are test values.**

---

# 11. Data-safety verification

> **`DEP-080` — 🔴 A DEPLOYMENT MAY NEVER FABRICATE A BUSINESS FACT. VERIFY, DO NOT MUTATE.**
>
> **After migration, confirm by READ-ONLY inspection:**
>
> **a.** ✅ **Every pre-existing `channel_instance` row is still present.** 🔴 **No shop was lost.**
> **b.** ✅ **A legacy `market` that was `NULL` is STILL `NULL`.** 🔴 **`V12` deliberately permits `NULL` and backfills nothing** — an unrecorded market stays unrecorded (`SYS-034`, `INV-16.7.d`). ⚠ **Finding `BANGLADESH` on a row that never had one is a FABRICATION and a stop condition.**
> **c.** 🔴 **No `external_account_identity` was invented.** **Binding happens only through a real authorisation** (`INV-16.5`).
> **d.** 🔴 **No `external_link` was invented** (`INV-16.14`).
> **e.** 🔴 **No `bound_at`, `authorised_at`, `activated_at` or `activated_by` was invented** (`INV-16.15`). ⚠ **These are captured by the act, never by a deployment.**
> **f.** 🔴 **`channel_connection` acquired no rows.** ✅ **Absence means never authorised** (`SCS-043`); **a deployment creates no connection.**
> **g.** 🔴 **No shop became connected or activated as a side effect of deploying.**
> **h.** 🔴 **NO ROW IS MODIFIED IN ORDER TO TEST IT.** ⚠ **Verification is `SELECT` only.**

> **`DEP-081` — ✅ PERMISSIONS ARE VERIFIED, NOT GRANTED.**
>
> **a.** ✅ **Confirm the four `PRM-090` codes exist:** `system.channel-instance.view` · `system.channel-instance.manage` · `system.channel-instance.lifecycle` · `integration.channel-connection.authorize`. **`V11` seeds them.**
> **b.** 🔴 **NO PERMISSION IS GRANTED TO ANY PRODUCTION USER TO MAKE A SCREEN VISIBLE.** ⚠ **An empty Shops & Channels destination for an operator without `view` is CORRECT BEHAVIOUR, not a deployment defect.**
> **c.** ✅ **Granting authority remains ordinary production administration** under `PERMISSION_ARCHITECTURE.md` and `ACCESS_GOVERNANCE_ARCHITECTURE.md`, performed by an authorised person — never by a deployment step.
> **d.** ✅ **`GAP-120` IS CLOSED** (`AGV-042`, 2026-08-16). **The first-Owner bootstrap is a ratified, server-side, one-time application command, and the production first Owner has been created and verified.** 🔴 **A DEPLOYMENT STILL CREATES NO OWNER AND MUST NOT INVENT A BOOTSTRAP** (`AGENTS.md` — no production bootstrap shortcuts): ⚠ **the mechanism existing is not permission for a deployment step to use it.** ✅ **Further Owners are designated only by an existing Owner** (`AGV-038`), **and ordinary accounts remain normal authenticated administration** (`AGV-011`). ✅ **Frontend deployment and login smoke may proceed using the existing legitimate Owner.**

---

# 12. Post-deployment smoke gate

> **`DEP-082` — ✅ MANDATORY. A DEPLOYMENT IS NOT DONE UNTIL THESE PASS.**
>
> **Server** — service active and not restarting · `127.0.0.1:8080` listening · `nginx -t` valid · Nginx active.
> **HTTP** — the public application responds · a real existing endpoint responds (`DEP-002.b` decides which) · **no unexpected `5xx`**.
> **Database** — Flyway final version is the expected one · **no failed migration row** · `DEP-080` passes in full.
> **Application** — sign-in and shell load · **Shops & Channels workspace** loads with summary, search and filters · a **shop detail** page opens from a row · **Listings smoke** (`DEP-083`).
> **Browser** — **no fatal console error** · bounded visual check at **80 / 90 / 100 / 110**: no operational row wrapping, no clipped action, no horizontal workspace scroll, no inner x-scroll, semantic chips render, shell intact.
>
> **a.** 🔴 **SMOKE TESTING CREATES NO DATA.** ⚠ **Add Shop may be OPENED where the account legitimately holds `manage`; it is NEVER SUBMITTED.** **No shop is created, edited, activated or connected to verify a deployment.**
> **b.** 🔴 **NO CONNECTION, AUTHORISATION OR MARKETPLACE STATE IS FABRICATED ON PRODUCTION.** ✅ **The exhaustive state-by-state verification was completed locally against the approved design and is not repeated against live data.**

> **`DEP-083` — ✅ LISTINGS REGRESSION SMOKE, BOUNDED.** **Shops & Channels shares the global shell, tokens and semantic-role system, so a bounded check of the existing Listings surfaces is required: route loads, no shell or semantic regression, no fatal console error.** 🔴 **SMOKE ONLY — Listings is not modified, and PASS 01–16 remain locked.**

---

# 13. Rollback and recovery boundary

> **`DEP-110` — 🔴 ARTIFACTS ROLL BACK. THE DATABASE DOES NOT.**
>
> **a.** ✅ **APPLICATION ARTEFACT FAILURE:** the previously installed backend jar and the previous frontend build may be restored, which is why both are staged rather than overwritten (`DEP-040.1`, `DEP-042.d`).
> **b.** 🔴 **NO DOWN-MIGRATION IS PROMISED OR ATTEMPTED. FLYWAY IS FORWARD-MIGRATION AUTHORITY** (`PRJ-081`). ⚠ **Reverting the artifact does NOT revert an applied migration, and an older backend against a newer schema may not start — which is a deliberate constraint, not a bug.**
> **c.** ✅ **A migration that causes a critical issue is resolved by an explicit FORWARD FIX — a new migration — or by restoring the verified backup** (`DEP-060`).
> **d.** 🔴 **A DATABASE RESTORE IS NEVER AUTOMATIC. IT IS AN OPERATOR DECISION**, because it discards everything written since the backup.
> **e.** 🔴 **NO IMPROVISED DESTRUCTIVE RECOVERY.** ⚠ **No `DROP`, no manual `DELETE` of migration history, no hand-editing `flyway_schema_history` to make a failure disappear.**
> **f.** ✅ **WHATEVER HAPPENS IS REPORTED EXACTLY**, including a partial or failed deployment.

---

# 14. The Cloudflare `521` investigation order

> **`DEP-100` — ✅ A `521` IS EVIDENCE ABOUT THE EDGE, NOT A DIAGNOSIS OF THE SERVER.**
>
> **Observed 2026-08-16: `https://user.trioloo.com` returned HTTP `521` (Cloudflare *Web Server Is Down*).** 🔴 **The cause was NOT determined, and this document does not guess it.**
>
> **Investigate ON THE ORIGIN `159.223.47.70`, in this order, stopping at the first genuine fault:**
>
> **1.** ✅ **Is the host reachable at all** — does the SSH session establish?
> **2.** ✅ **Is Nginx running, and is its configuration valid?** ⚠ **`521` most often means the edge reached the host but nothing accepted on 80/443.**
> **3.** ✅ **Is anything listening on 443 and 80?**
> **4.** ✅ **Is the origin firewall permitting Cloudflare?** — the host firewall and the provider firewall are two different layers, and both are checked.
> **5.** ✅ **Is the origin TLS certificate valid and does it match the Cloudflare SSL mode?** ⚠ **A Full/Strict mode against an expired or absent origin certificate presents as `521`/`526`.**
> **6.** ✅ **Only then the backend service and application logs.** 🔴 **A stopped BACKEND does not by itself cause `521`** — Nginx would still serve the frontend and return `502` on `/api/`. **Treat a `521` as an availability fault at the Nginx/host/TLS layer until the evidence says otherwise.**
> **7.** ✅ **Disk full, OOM, or a crashed host process** as remaining candidates.
>
> **a.** 🔴 **NOTHING IS CHANGED WHILE DIAGNOSING.** **Findings are recorded first; a fix is a separate, reported act.**
> **b.** ⚠ **THE `521` MUST BE RESOLVED BEFORE A DEPLOYMENT IS MEANINGFUL** — deploying onto an origin that is not serving verifies nothing.

---

# 15. The Daraz live-integration boundary

> **`DEP-090` — 🔴 A ROUTING BOUNDARY IS NOT AN IMPLEMENTED CAPABILITY.**
>
> **a.** ~~✅ **`/daraz/callback` IS A RESERVED BACKEND ROUTING BOUNDARY in the production topology** (`DEP-002`).~~ → ✅ **SUPERSEDED 2026-08-17.** 🔴 **THE ROUTE WAS NEVER BUILT AT THAT PATH.** **The implemented callback is `GET /api/integration/daraz/callback`, which the existing `/api/` proxy rule already serves** (`DEP-124`). ⚠ **Configuring `/daraz/callback` in Nginx would create a path nothing listens on.**
> **b.** ~~🔴 **THE APPLICATION ENDPOINT DOES NOT EXIST.**~~ → ✅ **SUPERSEDED 2026-08-17 — IT NOW DOES.** **The callback controller, the OAuth initiate/complete workflow, the Daraz adapter, the request signer and the encrypted credential store are all implemented and tested, and `ChannelAuthorisationRegistry` now registers `DARAZ`.** ⚠ **The original wording is kept because it was true when written and explains why the topology reserved a path at all.**
> **c.** 🔴 **DOCUMENTING THE ROUTE ASSERTS NOTHING ABOUT CAPABILITY.** ⚠ **Reserving the path is how the topology stays stable when the endpoint is eventually built; it must never be read as evidence that it was.**
> **d.** 🔴 **A DEPLOYMENT PERFORMS NO LIVE INTEGRATION.** **No Daraz OAuth, no seller sign-in, no shop connection, no account binding, no marketplace read, no marketplace write.** ✅ **That is a separate, later, explicitly authorised gate.**

---

# 15a. Daraz production configuration

> **`DEP-124` — ✅ WHAT A DEPLOYMENT MUST CONFIGURE BEFORE A SELLER CAN BE CONNECTED. 🔴 CONFIGURING IT IS NOT CONNECTING ANYTHING.**
>
> **a.** ✅ **THE CALLBACK URL, WHICH MUST MATCH THE DARAZ APP CONSOLE BYTE-FOR-BYTE** (`DZC-002`):
>
> ```
> https://user.trioloo.com/api/integration/daraz/callback
> ```
>
> ✅ **IT IS SERVED BY THE EXISTING `/api/` PROXY RULE.** 🔴 **DO NOT ADD AN NGINX LOCATION FOR IT** — a separate rule can only diverge from the one that already works. ⚠ **A mismatch between this value, `DARAZ_OAUTH_REDIRECT_URI` and the App Console registration fails at the provider with an error that names none of the three.**
>
> **b.** ✅ **REQUIRED ENVIRONMENT VARIABLE NAMES**, added to the systemd `EnvironmentFile` alongside those already present. 🔴 **NAMES ONLY — no value appears in this document, the repository, the database or any log** (`API-070`, `TEC-119.f`):
>
> | Variable | Purpose |
> |---|---|
> | `DARAZ_APP_KEY` | Identifies Trioloo to Daraz; travels in the authorisation URL |
> | `DARAZ_APP_SECRET` | 🔴 Keys the HMAC-SHA256 signature. **Server-side only, never transmitted** |
> | `DARAZ_OAUTH_REDIRECT_URI` | Must equal **a.** exactly |
> | `INTEGRATION_CREDENTIAL_ENCRYPTION_KEYS` | `version:base64key[,…]`, each key 256-bit (`DEP-123`) |
> | `INTEGRATION_CREDENTIAL_ENCRYPTION_ACTIVE_KEY_VERSION` | Which version encrypts new material |
>
> ⚠ **THESE ARE ADDITIONS, NOT REPLACEMENTS.** **The existing production set stays: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, `SERVER_ADDRESS`, `SERVER_PORT`, `APP_CORS_ALLOWED_ORIGINS`, `SERVER_FORWARD_HEADERS_STRATEGY` (`DEP-122`), `SERVER_SERVLET_SESSION_COOKIE_SECURE` (`DEP-122`).**
>
> **c.** 🔴 **`V14` MUST BE APPLIED BEFORE ANY LIVE SELLER CONNECTION.** **It creates `channel_credential` and `channel_authorisation_attempt`; without them an authorisation cannot record its one-time state and has nowhere to put the encrypted token.** ✅ **Migrations run in-process at backend startup (`TEC-118`), so deploying the Gate-B artifact IS applying `V14`** — production sits at `V13` until that deployment happens.
>
> **d.** 🔴 **THE ENCRYPTION KEY MUST EXIST BEFORE THE FIRST CONNECTION, NOT AFTER.** ⚠ **An unconfigured key does not stop the application starting — that is deliberate (`DEP-123.e`) — but the first authorisation that tries to store a credential FAILS LOUDLY.** ✅ **Generate it, set it, restart, and only then connect a seller.**
>
> **e.** ✅ **ORDER OF OPERATIONS.** **Apply `V14` and configure the encryption key and Daraz variables → restart the backend → register the callback on the App Console → verify health → STOP.** 🔴 **Creating a shop and authorising a seller is a SEPARATE, EXPLICITLY AUTHORISED gate** (`DEP-090.d`).
>
> **f.** 🔴 **PRODUCT AND LISTING PULL IS NOT PART OF THIS.** **No listing read, no product read, no sync, no marketplace write.** ⚠ **A working connection is permission to read nothing yet** — `GAP-133` stays open for the ingestion work.
>
> **g.** ✅ **WHAT CONFIGURING THIS DOES NOT DO.** **It creates no Shop, binds no seller, stores no credential and contacts no marketplace.** **Every one of those needs a human to click Connect and sign in as the seller.**

---

# 16. Stop and fail conditions

> **`DEP-120` — 🔴 STOP IMMEDIATELY, AND REPORT, ON ANY OF THESE.**
>
> **a.** 🔴 **The local gate fails** (`DEP-032`) — a failing build is never deployed.
> **b.** 🔴 **The database backup fails or cannot be verified** (`DEP-060.f`).
> **c.** 🔴 **Flyway reports a validation, checksum or migration failure** (`DEP-070.d`).
> **d.** 🔴 **A production row appears fabricated** (`DEP-080`).
> **e.** 🔴 **The deployment would require an unauthorised commit or push** (`DEP-010.c`).
> **f.** 🔴 **The deployment would require a technology this topology does not contain** — a container, an orchestrator, a CI platform. **That is a `TEC-003` amendment, not a deployment step.**
> **g.** 🔴 **A business question surfaces** — `CLAUDE.md` §5, report `BLOCKED — MISSING CANONICAL BUSINESS RULE`.
> **h.** 🔴 **Server access is unavailable.** ✅ **Ask the operator; do not improvise around it** (`DEP-021.c`).
>
> ⚠ **A DISCOVERY ITEM IS NOT A STOP CONDITION.** ✅ **The service name (`DEP-040`), the Nginx paths (`DEP-050`) and the production database identity (`DEP-060.a`) are READ ON THE SERVER during pre-flight. They are unknown to the repository by design, not undecided by architecture, and they block nothing.**

---

# 17. Version History

| Version | Date | Change |
|---|---|---|
| **1.5.0** | **2026-08-17** | ✅ **NEW `DEP-124` — DARAZ PRODUCTION CONFIGURATION:** **the exact callback URL, the five environment variable NAMES, the rule that `V14` and the encryption key must both be in place BEFORE a seller is connected, and the order of operations.** 🔴 **`DEP-090.a` AND `.b` SUPERSEDED — THEY WERE MATERIALLY WRONG.** **`.a` reserved `/daraz/callback`, but the route was built at `/api/integration/daraz/callback`, so following the old text would have configured Nginx for a path nothing listens on. `.b` asserted no callback controller, adapter, OAuth client or credential store existed — all of them now do, and the registry now registers `DARAZ`.** ✅ **Superseded wording retained (`DOC-009`); `DEP-090.c` and `.d` are UNCHANGED and still binding — a deployment still performs no live integration.** ⚠ **No secret value appears in this document.** |
| **1.4.0** | **2026-08-16** | ✅ **NEW `DEP-123` — the integration credential encryption key as deployment configuration: the two variable NAMES, versioned keys for rotation, fail-fast validation that never quotes key material, and the rule that ABSENT is permitted (nothing to protect yet) while USING it unconfigured fails loudly.** 🔴 **The key lives in the environment file, never in the database, so a database backup alone is useless.** ⚠ **No key, token or secret value appears in this document.** |
| **1.3.0** | **2026-08-16** | ✅ **NEW `DEP-122` — PRODUCTION SESSION-COOKIE SECURITY.** **Records that `Secure` on `JSESSIONID` requires `SERVER_SERVLET_SESSION_COOKIE_SECURE=true` IN ADDITION to `SERVER_FORWARD_HEADERS_STRATEGY=framework`, because the two cookies have different authors: Spring Security writes `XSRF-TOKEN` from the WRAPPED request, while Tomcat mints `JSESSIONID` from its own connector, which a servlet filter cannot reach.** 🔴 **REGISTERED BECAUSE THE INFERENCE FAILED IN PRACTICE: `XSRF-TOKEN` carrying `Secure` was treated as evidence for `JSESSIONID`, and direct observation disproved it.** ✅ **Also records the credential-free verification path — an unauthenticated `401` still issues a session cookie — and that `SameSite` remains unratified and untouched.** ⚠ **No business rule changed; no credential, password, session value or hash appears in this document.** |
| **1.2.0** | **2026-08-16** | ✅ **THE FIRST FRONTEND DEPLOYMENT ESTABLISHED THE PRODUCTION WEB ROOT, so `DEP-042.c`'s discovery wording is superseded and the real layout is recorded in `DEP-042.f`: `/var/www/trioloo-erp/releases/<timestamp>/` with an atomically-swapped `current` symlink.** ✅ **`DEP-042.e` adds the checksum-before-activation rule.** ✅ **`DEP-050.f`–`.g` record the SPA fallback and 🔴 the prohibition on it swallowing `/api/` or ACME.** ✅ **NEW `DEP-121` — the production bundle must resolve the API same-origin, verified in the BUILT ARTIFACT.** ⚠ **Registered because the defect was real: the gate found a bundle carrying `http://localhost:8080`, which would have pointed every browser at the operator's own machine.** 🔴 **No business rule changed; no credential, password or hash appears in this document.** |
| **1.1.0** | **2026-08-16** | ✅ **`DEP-081.d` CORRECTED — it still declared `GAP-120` open after the gap had closed.** **`AGV-042` ratified the one-time server-side first-Owner bootstrap and the production first Owner now exists and is verified.** 🔴 **THE PROHIBITION IS UNCHANGED AND RESTATED: a deployment still creates no Owner and must not invent a bootstrap** — **a mechanism existing is not permission for a deployment step to use it.** ✅ **Further Owners remain `AGV-038`'s, ordinary accounts remain `AGV-011`'s, and login smoke may now use the existing legitimate Owner.** ⚠ **No other rule changed; no credential, password or hash appears in this document.** |
| **1.0.0** | **2026-08-16** | **Initial ratification (`DOC-091`). `DEP-001`–`DEP-120`.** ✅ **RATIFIES THE PRODUCTION INFRASTRUCTURE THAT ALREADY EXISTS** — DigitalOcean Ubuntu droplet at origin `159.223.47.70`, Nginx serving the static frontend and reverse-proxying `/api/` to the backend on `127.0.0.1:8080`, PostgreSQL with Flyway, Cloudflare in front of `user.trioloo.com`. 🔴 **NO PLATFORM WAS INVENTED: no container, orchestrator, CI/CD, IaC or registry appears here, and introducing one remains a `TEC-003` amendment.** ✅ **Records the deployment sequence from the repository's OWN build commands**, and establishes the backup gate, the Flyway gate, the data-safety verification, the smoke gate, the rollback boundary and the `521` investigation order. 🔴 **The service name, the Nginx paths and the production database identity are DISCOVERY ITEMS, deliberately not guessed.** 🔴 **`DEP-071` records the governing sequencing fact — migrations run IN-PROCESS at backend startup, so starting the new artifact IS the migration.** 🔴 **`DEP-090` separates the reserved `/daraz/callback` routing boundary from application capability, which remains unbuilt under `GAP-133`.** ⚠ **No business rule created, altered or reinterpreted; no application code, migration or test touched.** |
