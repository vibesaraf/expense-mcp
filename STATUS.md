# Architecture Overhaul — Stage Status

Current stage: **COMPLETE** ✅

## Completed

- [x] Stage 0 — Config & env scaffolding
- [x] Stage 1 — Fix token verification (`oidc.ts` forged-token catch removed; `act` added to `TokenData`)
- [x] Stage 2 — REST audience isolation + cookie read (`REST_RESOURCE_URL` audience; cookie fallback; `req.actorId`; no MCP PRM header on REST 401s)
- [x] Stage 3 — Audit log schema + repository (`audit_log` replaced with RFC 8693-aware schema; `AuditRepository` rewritten with `insert`/`findForUser`/`findForTeam`/`findAll`; service-level audit calls removed)
- [x] Stage 4 — Real audit middleware (global `auditLogMiddleware`; action derived from `req.method+baseUrl+route.path`; writes one row per authenticated request; per-route `auditMiddleware` calls removed)
- [x] Stage 5 — New REST routes (`GET /api/users/me` auth-only before finance admin guard; `GET /api/activity` scope-gated, role-scoped to own/team/all; `findAll` double-param bug fixed)
- [x] Stage 6 — OIDC callback + dual PRM (`POST /oidc/callback` exchanges code at `LR_OIDC_TOKEN_ENDPOINT`, sets HttpOnly cookie; `POST /oidc/logout`; REST PRM at `/api/.well-known/oauth-protected-resource`)
- [x] Stage 7 — Token exchange utility (`src/utils/tokenExchange.ts`: `TokenExchangeError`, `getActorToken` with module-level cache, `exchangeToken` RFC 8693 delegation; `LR_TOKEN_ENDPOINT_AUTH_METHOD` respected for both)
- [x] Stage 8 — MCP auth hardening (`mcp:tools` scope assertion added to `mcpAuthMiddleware`; audience isolation already handled by `JWT.verify`; `authInfo.token` already held raw subject JWT)
- [x] Stage 9 — MCP tools rewritten to call REST (`src/utils/restClient.ts` + `RestError`; `define-tool.ts` scope enforcement removed; all 7 tools exchange MCP token → REST token via RFC 8693, then call matching REST endpoint; `who_am_i` exchanges with `EXPENSE_VIEW_OWN`)
- [x] Stage 10 — React scaffold + auth context (`react-router-dom` + Vite proxy; `apiFetch` + `ApiError`; `AuthContext` with cookie-based `/api/users/me` load; `ProtectedRoute` with role guard; `Login` → LR authorize redirect; `Callback` → POST code to `/oidc/callback`; role-aware `Layout` nav; placeholder routes for all pages; `tsc -b && vite build` clean)
- [x] Stage 11 — Expense pages (`SubmitExpense` form with dynamic category load + receipt toggle; `MyExpenses` with status/date filters + pagination + summary bar; `TeamExpenses` with inline approve/reject action rows + refetch trigger; `Reports` form + summary/byStatus/byCategory/detailed tables; `StatusBadge` shared component; build clean)
- [x] Stage 12 — Activity page (`AuditLog`/`ActivityResponse` types; Activity table with Timestamp/User/Action/Resource/Performed-via/Scope/Result columns; `actorType` select + action text + date range filters; "Web App" vs "🤖 <client>" distinction in Performed-via column; status code color-coding; pagination; `AGENT_NAMES` map for client_id → friendly name; build clean) (`SubmitExpense` form with dynamic category load + receipt toggle; `MyExpenses` with status/date filters + pagination + summary bar; `TeamExpenses` with inline approve/reject action rows + refetch trigger; `Reports` form + summary/byStatus/byCategory/detailed tables; `StatusBadge` shared component; build clean)

---

## Upcoming Stages

| Stage | Label | Key files |
|-------|-------|-----------|
| 5 | New REST routes | `user.routes.ts`, new `activity.routes.ts` |
| 6 | OIDC callback + dual PRM | new `oidc.routes.ts`, `well-known.routes.ts` |
| 7 | Token exchange utility | new `src/utils/tokenExchange.ts` |
| 8 | MCP auth hardening | `src/mcp/auth.ts` |
| 9 | Rewrite MCP tools to call REST | `src/mcp/tools/*.ts` (all 7) |
| 10 | React scaffold + auth context | `apps/expense-client` |
| 11 | Expense pages | `apps/expense-client` |
| 12 | Activity page (centerpiece) | `apps/expense-client` |

---

## Stage Notes (carry-forward)

### Stage 6 notes
- `CORS_ORIGIN` must be tightened to the React origin (not `*`) since cookies require `credentials: true`.
- Both PRM documents must return correct `resource` + `scopes_supported`.

### Stage 11 notes
- Pages need `VITE_*` env vars set in `.env.local` (copy `.env.local.example`).
- `apiFetch` is the fetch wrapper — all page data calls go through it.
- Role helpers: `user.roles.includes('manager' | 'finance_admin')` for conditional UI.
