# Day 1 - Phase 1: Runtime and baseline

**Planned date:** Monday, 20 July 2026
**Focus:** Windows production build, measurable baselines, and repeatable local runtime.

## Exit criteria

1. `npm run build` exits with code `0` in Windows PowerShell.
2. `npm start` runs the standalone application without Bash.
3. `/login` returns `200 OK` in production mode.
4. Startup, memory, response-time, and bundle before/after results are recorded.
5. No route, database schema, UI, or business-logic changes are included.

## File scope

| Allowed | Not changed |
|---|---|
| `package.json` | `src/app/**` |
| New `scripts/prepare-standalone.mjs` | `src/components/**` |
| Remove `start-lentera.sh` when unused | `prisma/**` |
| This phase documentation | `.env` and credentials |

## Initial baseline

| Metric | Initial value | Notes |
|---|---:|---|
| Node.js | `v26.4.0` | Local runtime |
| npm | `11.17.0` | Package manager |
| Tests | `128 passed` | 5 test files |
| Development RAM | about `420 MB` | Earlier dev-process snapshot |
| Warm `/login` | about `0.11 s` | Server already warm |
| Build compilation | passed | Next.js and TypeScript |
| Build packaging | failed | `cp` unavailable on Windows |

## 1.0 - Guard rails

- [x] Confirm working branch and starting commit.
- [x] Record `git status` before changes.
- [x] Keep `.backup/`, archives, and `.env` out of staging.
- [x] Do not delete `node_modules`, `.next`, databases, or user files to fix the error.
- [x] Do not add dependencies.

Checkpoint: only Phase 1 runtime/build code and documentation are in scope.

## 1.1 - Development baseline

- [x] Run `npm run dev`.
- [x] Record the Next.js `Ready` timestamp and startup time.
- [x] Warm `/login` once, then measure the second request.
- [x] Measure the full Next.js process-tree Working Set.
- [x] Record the five largest files in `.next/static/chunks`.

### Measurement commands

```powershell
curl.exe -s -o NUL -w "login status=%{http_code} time=%{time_total}s size=%{size_download} bytes\n" http://localhost:3000/login
Get-NetTCPConnection -LocalPort 3000 -State Listen
Get-ChildItem .next\static\chunks -File | Sort-Object Length -Descending | Select-Object -First 5 Name,Length
```

### Result - 19 July 2026

| Metric | Result |
|---|---:|
| Measured Next.js ready time | 833 ms |
| First warm-route request | 402 ms in server log |
| Warm `/login` | 64 ms curl; 62 ms server log |
| Total Node process-tree Working Set | 735.4 MB |
| Largest chunks | 477.1 KB, 222.2 KB, 134.2 KB, 132.7 KB, 110.0 KB |

Cold compilation was previously observed at 2.2 seconds. Warm response time is the interactive baseline.

## 1.2 - Quality baseline

- [x] Run `npm test` before changing the build script.
- [x] Run `npm run build` once and record the first failure.
- [x] Confirm the failure is shell packaging, not compilation, TypeScript, database, or authentication.

### Result - 19 July 2026

| Check | Result |
|---|---|
| Tests | 5 files, 128 tests passed |
| Next.js compilation | Passed, 11.1 s |
| TypeScript | Passed, 21.1 s |
| Static generation | Passed, 23/23 pages |
| Build exit code | Failed, exit 1 |
| First error | `'cp' is not recognized as an internal or external command` |

### Confirmed root cause

The original `build` script used Unix-only `cp -r` and `mkdir -p` commands. Next.js compilation and static generation succeeded; packaging then failed on Windows. The `Proxy (Middleware)` output is a warning label, not the root cause.

## 1.3 - Cross-platform standalone packaging

- [x] Add `scripts/prepare-standalone.mjs` using only `node:fs` and `node:path`.
- [x] Copy `.next/static`, `public`, and `prisma` into the standalone output.
- [x] Create the standalone `upload` directory.
- [x] Replace the Unix build tail with `node scripts/prepare-standalone.mjs`.
- [x] Run the standalone server through `node .next/standalone/server.js`.
- [x] Remove the unused Bash wrapper.

### Result

`npm run build` passed with exit code `0`. Standalone `server.js`, static assets, public files, Prisma files, and upload directory were verified.

## 1.4 - Production build validation

- [x] Run `npm run build`.
- [x] Verify Next.js compilation and standalone preparation.
- [x] Run `npm test` again.
- [x] Run `git diff --check`.

### Result

Build passed with exit code `0`; static generation produced 23/23 pages; all 128 tests passed; standalone output was present.

## 1.5 - Production runtime measurement

- [x] Start the standalone server on port 3001 to keep the development server on port 3000 available.
- [x] Request `/` and verify the login redirect.
- [x] Request `/login` and verify `200 OK`.
- [x] Measure startup, memory, warm response, and a static asset.
- [x] Stop the production process cleanly.

### Result

- Command: PowerShell `$env:PORT='3001'; npm start`.
- Startup: Next.js ready in 0 ms.
- Production Working Set: 104.9 MB.
- Root `/`: HTTP 307 redirect to login.
- `/login`: HTTP 200, 0.213 s.
- Static font asset: HTTP 200, 0.209 s.
- Production process stopped cleanly.

## 1.6 - Compare results and decide next steps

| Metric | Development | Production | Decision |
|---|---:|---:|---|
| Startup | 833 ms | 0 ms | Repeatable |
| Total Node RAM | 735.4 MB | 104.9 MB | Production is about 85.7% lower |
| Warm `/login` | 48-64 ms | 213 ms | No Phase 1 optimization; pipelines differ |
| Build | 0 after fix | 0 | Passed |
| Tests | 128/128 | 128/128 | Passed |
| Largest client chunk | 477.1 KB | Same output | Phase 3 baseline |

Development compiler and HMR overhead is accepted as dev-only. Route splitting and lazy loading are deferred to Phase 3. No database, DuckDB, lineage, or business-logic work belongs in this Phase 1 commit.

## 1.7 - Handoff

- [x] Run final tests and build.
- [x] Review the diff and keep unrelated archives, backups, credentials, and other phase documents out of the commit.
- [x] Commit: `fix: make standalone build work on Windows`.
- [x] Push branch and open PR.

### Day 1 result

- Status: Phase 1 complete; PR review pending
- Branch: `codex/phase-1-runtime-baseline`
- Commit: `fix: make standalone build work on Windows`
- Tests: `128/128` passed
- Build: exit code `0`
- Development RAM: 735.4 MB
- Production RAM: 104.9 MB
- Largest chunks: 477.1 KB, 222.2 KB, 134.2 KB, 132.7 KB, 110.0 KB
- Blocker: none

## Mandatory browser quality gate

Run this gate after every subphase that can affect runtime or user-visible behavior and again before merge. A successful build or an HTTP status alone is not browser validation.

1. Run `npm run lint`, `npm test`, and `npm run build` in that order.
2. Start the production runtime, sign in, and open every affected route in a real browser.
3. Confirm the sidebar and main content render together inside the viewport, then test the primary action, refresh, and Back/Forward navigation.
4. Fail the gate on an uncaught page error, React console error or warning, unexpected `4xx/5xx` response, missing runtime asset, blank page, or content rendered outside the viewport.
5. Save a screenshot of each affected primary route, then record the commands, route, interaction, console result, network result, and screenshot path in the implementation record or PR.
6. A PR cannot merge until lint, tests, build, and the authenticated browser smoke test pass. Until this flow is automated in CI, execute it manually and attach the evidence.

## Definition of done

- [x] Windows build exits with code `0`.
- [x] Production `/login` returns `200 OK`.
- [x] Full test suite passes before and after the change.
- [x] Before/after baseline is recorded.
- [x] No route, database schema, UI, or business-logic changes.
- [x] No local files or credentials are committed.

## PR review instructions

1. Run the final test and build.
2. Inspect only the Phase 1 diff, callers, process flow, and test output.
3. Classify findings as Critical, High, Medium, or Low.
4. Critical and High findings must be fixed before merge; Medium findings are fixed in this PR; Low findings are follow-ups.
5. Re-run test, build, and diff review after every fix.

### Phase 1 review focus

- **Critical - credentials or local data committed.** Error: `.env`, databases, archives, or upload data appear in the diff. Impact: secret or data exposure. Fix: remove from staging, update `.gitignore`, rotate exposed credentials, and rescan.
- **High - Unix-only build dependency remains.** Error: `cp`, `mkdir -p`, Bash, or Unix paths remain in the build flow. Impact: Windows/CI failure. Fix: use Node standard-library file operations.
- **High - standalone runtime is incomplete.** Error: static, public, Prisma, or login assets are missing. Impact: 404s or server crash. Fix: fail fast in the preparation script and smoke-test `/` and `/login`.
- **Medium - baseline is not reproducible.** Error: before/after measurements use different commands or sequence. Impact: optimization cannot be compared. Fix: use the same measurement sequence and record the numbers.
- **Low - runtime documentation is incomplete.** Error: Windows commands are missing or unclear. Impact: repeated setup errors. Fix: document the exact dev and production commands.

### Review finding format

```markdown
### [PRIORITY] Title
- Error: file/line and incorrect condition.
- Impact: risk if left unresolved.
- Fix: concrete change.
- Evidence: test/command/output.
- Status: open / fixed / verified.
```
