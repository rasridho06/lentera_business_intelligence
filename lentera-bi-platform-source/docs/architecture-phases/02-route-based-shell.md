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

## Tasks

- [ ] Extract the sidebar from `home-client.tsx`.
- [ ] Extract the header and content container.
- [ ] Create the authenticated platform layout.
- [ ] Move navigation configuration into one file.
- [ ] Replace menu buttons with Next.js `Link`.
- [ ] Use `usePathname` only for the active menu state.
- [ ] Create routes for overview, connectors, datasets, query, charts, dashboards, metrics, and lineage.
- [ ] Render the existing views on their respective routes.
- [ ] Redirect the root route to overview.
- [ ] Keep login outside the authenticated layout.
- [ ] Remove `currentView`, `switchView`, and conditional rendering of every view.
- [ ] Delete `home-client.tsx` if it is no longer used.
- [ ] Hide deferred feature menu items.
- [ ] Test direct refresh for every route.
- [ ] Test browser Back and Forward navigation.

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

## Definition of done

- [ ] Every primary feature has a URL.
- [ ] No `currentView` state remains.
- [ ] Refresh and browser navigation work.
- [ ] Authentication redirect still works.
- [ ] Tests and production build pass.

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
