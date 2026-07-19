# Refactoring Phases

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Quick wins: env config, type strictness, Zod dedup | Complete |
| 1 | Architecture: delete dual API layer, TanStack Query, NextAuth | Complete |
| 2 | Security & validation: encryption, cascade delete, Zod, constants | Complete |
| 3 | Test infrastructure: shared cleanup, API integration tests | Complete |
| 4 | CI pipeline, ponytail cleanup (dead code, deps, unused components) | Complete |


## Branch lifecycle rules

1. One large phase equals one dedicated branch.
2. After a phase PR is merged, checkout main and pull main before starting the next large phase.
3. Commit and push only work belonging to the active phase.
