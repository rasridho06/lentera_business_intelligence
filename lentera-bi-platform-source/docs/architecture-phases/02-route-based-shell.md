> Part 2 of [Lean Architecture 7-Day Plan](../../LEAN_ARCHITECTURE_7_DAY_PLAN.md).

# Day 2 - Phase 2: Route-based application shell

**Date:** Tuesday, 21 July 2026
**Focus:** replace `currentView` state switching with Next.js routing.

## Branch rule

Work for this phase belongs only to `codex/phase-2-route-shell`. If this phase is merged, checkout `main`, pull `main`, and create a new dedicated branch before starting Phase 3.

## 2.0 - Guard rails and route baseline

- [x] Confirm branch: codex/phase-2-route-shell.
- [x] Confirm base: main at merge commit 2e72061.
- [x] Preserve unrelated archives and .backup/ changes outside staging.
- [x] Record current root flow: src/app/page.tsx is a client wrapper with ssr: false.
- [x] Record current navigation: home-client.tsx owns currentView, switchView, conditional rendering, and all menu buttons.
- [x] Record auth boundary: src/proxy.ts protects non-login, non-API routes.

### Baseline result

The application has no feature URL routes yet. The root route loads the full client shell, and navigation is state-driven. Phase 2 will make the URL the single source of truth without changing API contracts or business logic.

## 2.1 - Centralize navigation configuration

- [x] Move `ViewType`, `NavItem`, `navSections`, and `allNavItems` to `src/lib/navigation.ts`.
- [x] Render icon components from the shared navigation definition.
- [x] Keep `currentView` and `switchView` unchanged until route migration.

### Result

Navigation metadata now has one caller-independent source. No route or behavior changed.

## 2.2 - Extract the platform shell boundary

- [x] Create `src/components/platform-shell.tsx`.
- [x] Move the shared `TooltipProvider` and root platform wrapper into the shell.
- [x] Keep sidebar, header, view state, and data fetching in `home-client.tsx` until route extraction.
- [x] Run tests and production build.

### Result

The platform shell boundary is reusable without introducing a new state layer. Route pages can adopt it in the next subphase.

## 2.3 - URL-backed feature routes

- [x] Add a single dynamic route at `src/app/(platform)/[view]/page.tsx`.
- [x] Validate route names against the shared `routeViewIds` set.
- [x] Pass the validated route into `HomeClient` as `initialView`.
- [x] Use `usePathname` to synchronize the visible view with the URL.
- [x] Use `router.push` for navigation menu actions.
- [x] Keep invalid route handling on the existing not-found path.

### Result

Primary feature views now have direct URLs without duplicating page files. The legacy shell still renders the view content; full layout/page separation remains a later subphase.

## 2.4 - Root redirect and login separation

- [x] Replace the root client wrapper with a server-side redirect to `/overview`.
- [x] Keep `/login` outside the platform route group.
- [x] Preserve proxy authentication behavior for platform routes.
- [x] Verify the production route table after the change.
- [x] Smoke-test root redirect, protected /overview, and public /login.

### Result

The root route no longer loads the full client application. Authenticated users enter through `/overview`, while login remains an independent route.

## 2.5 - Direct-route smoke test

- [x] Start standalone production runtime on port 3001.
- [x] Check `/overview`, `/connectors`, `/datasets`, `/query`, `/charts`, `/dashboards`, `/metrics`, and `/lineage`.
- [x] Confirm each protected route returns the auth redirect when unauthenticated.
- [x] Confirm `/login` returns `200 OK`.
- [x] Stop the production process cleanly.

### Result

All eight feature routes returned HTTP 307 to `/login` without a session; `/login` returned HTTP 200. Invalid-route status remains an authenticated-session check because the proxy redirects unauthenticated requests before route resolution.

## 2.6 - Remove duplicated route view state

- [x] Derive the primary active view from `usePathname()` and `routeViewIds`.
- [x] Remove the `currentView` React state and its pathname synchronization effect.
- [x] Keep only transient detail, impact, and search state because those views do not have primary feature routes yet.
- [x] Clear transient state when the URL changes or a primary navigation item is selected.
- [x] Run the full test suite and production build.

### Result

Primary navigation no longer has two competing sources of truth. Refreshing or navigating to a feature route derives the active view directly from the URL; detail, impact, and search remain local transient states until their own routes are introduced.
## Tasks

- [x] Keep the shared shell boundary in `platform-shell.tsx`.
- [x] Keep navigation metadata in `src/lib/navigation.ts`.
- [x] Use Next.js `Link` for primary menu navigation.
- [x] Use `usePathname` only to derive the active route view.
- [x] Serve all primary feature views through the validated dynamic route.
- [x] Redirect the root route to `/overview`.
- [x] Keep login outside the platform route flow.
- [x] Remove duplicated `currentView` state and `switchView` navigation callers.
- [x] Verify direct protected-route refresh behavior and login access.
- [x] Verify tests and production build.

### Scope decision

The existing `PlatformShell` and `proxy.ts` already provide the client shell and authentication boundary. A second authenticated layout wrapper would add no behavior, so sidebar/header extraction and a wrapper-only layout are intentionally deferred until route-owned data fetching requires them.
## Target structure

```text
src/app/(platform)/layout.tsx
src/app/(platform)/overview/page.tsx
src/app/(platform)/connectors/page.tsx
src/app/(platform)/datasets/page.tsx
src/app/(platform)/query/page.tsx
src/app/(platform)/charts/page.tsx
src/app/(platform)/dashboards/page.tsx
src/app/(platform)/metrics/page.tsx
src/app/(platform)/lineage/page.tsx
src/components/platform-shell.tsx
src/lib/navigation.ts
```

## Mandatory browser quality gate

Run this gate after every subphase that can affect runtime or user-visible behavior and again before merge. A successful build or an HTTP status alone is not browser validation.

1. Run `npm run lint`, `npm test`, and `npm run build` in that order.
2. Start the production runtime, sign in, and open every affected route in a real browser.
3. Confirm the sidebar and main content render together inside the viewport, then test the primary action, refresh, and Back/Forward navigation.
4. Fail the gate on an uncaught page error, React console error or warning, unexpected `4xx/5xx` response, missing runtime asset, blank page, or content rendered outside the viewport.
5. Save a screenshot of each affected primary route, then record the commands, route, interaction, console result, network result, and screenshot path in the implementation record or PR.
6. A PR cannot merge until lint, tests, build, and the authenticated browser smoke test pass. Until this flow is automated in CI, execute it manually and attach the evidence.

## Definition of done

- [x] Every primary feature has a URL.
- [x] No `currentView` state remains.
- [x] Refresh and browser navigation work.
- [x] Authentication redirect still works.
- [x] Tests and production build pass.

## Instructions after phase completion

1. Run tests, build, and smoke tests for every route.
2. Review the diff with navigation callers and the auth guard.
3. Push the branch and open a PR.
4. Review like GitHub Copilot.
5. Classify findings as Critical, High, Medium, or Low.
6. Fix Critical and High before merge; fix Medium in this PR; record Low as follow-up.
7. After the PR is merged, checkout `main`, pull `main`, and create the next phase branch before starting Phase 3.
8. Repeat direct refresh, Back/Forward, auth redirect, tests, and build after every fix.

## Phase 2 review focus

- **Critical - route is accessible without authentication.** Error: page bypasses the authenticated layout or proxy. Impact: metadata and dashboards are exposed. Fix: place every platform route behind the authenticated layout and add redirect coverage.
- **High - direct refresh returns 404 or loses state.** Error: route still depends on `currentView`. Impact: bookmarks and deep links break. Fix: make the URL the single source of truth and test every route directly.
- **High - legacy callers still use `switchView`.** Error: old and new routers run together. Impact: URL and UI diverge. Fix: remove the old state/callers and use Next.js `Link`.
- **Medium - layout loads data or client state too broadly.** Error: every route pays for unrelated queries. Impact: extra requests and JavaScript. Fix: move data fetching to the owning page.
- **Low - labels, headings, and URLs are inconsistent.** Error: menu names differ across surfaces. Impact: navigation is confusing. Fix: use one navigation constant.

## Review finding format

```markdown
### [PRIORITY] Title
- Error: file/line and incorrect condition.
- Impact: risk or behavior if left unresolved.
- Fix: concrete change.
- Evidence: test/direct route.
- Status: open / fixed / verified.
```
