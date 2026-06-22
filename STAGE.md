# STAGE — Execution Plan

Modular stages, each independently testable. Order: **REST API → MCP server → React app**.
Each stage lists the changes, then a concrete test you can run before moving on.

Legend: 🟦 REST · 🟪 MCP · 🟩 React · ⚙️ config/db

---

## Stage 0 — ⚙️ Config & env scaffolding

**Changes**

- `src/config/index.ts`: add to the Zod schema
  - `REST_RESOURCE_URL` (url, e.g. `http://localhost:3001`)
  - `REST_BASE_URL` (url, default `http://localhost:3001`)
  - `MCP_SERVER_ACTOR_SCOPES` (string, space-delimited — all six `expense:*`)
  - `LR_AUTHORIZE_URL` (url) and `OIDC_REDIRECT_URI` (url) for the React callback flow
  - `COOKIE_NAME` (string, default `expense_session`), `COOKIE_SECURE` (bool from NODE_ENV)
- Update `.env` / `.env.example` with the new vars.

**Test**

- `pnpm --filter expenses-server run dev` boots without Zod errors.
- Temporarily remove one new required var → server exits with a clear validation message.

---

## Stage 1 — 🟦 Fix token verification (security prerequisite)

**Changes**

- `src/utils/oidc.ts`: remove the `catch` block that returns a forged token. On failure, **throw**.
- Add `act` to the `TokenData` interface and populate it from the payload (`payload.act`).

**Test**

- Unit/manual: call `verifyIdToken("garbage")` → it throws (no longer returns a fake `mcp:tools`
  token).
- Existing MCP/REST auth still succeeds with a valid token (smoke test an endpoint with a real
  token, or a locally-signed JWT against a stub JWKS).

> ⚠️ Do this before Stage 2 — audience isolation is meaningless while the forged fallback exists.

---

## Stage 2 — 🟦 REST audience isolation + cookie read

**Changes**

- `src/middleware/auth.middleware.ts`:
  - Verify with `audience: config.REST_RESOURCE_URL` (replace `config.SERVER_URL`).
  - After verify, if `aud === config.MCP_RESOURCE_URL` → `401 invalid_token`
    ("Token audience is not valid for this resource").
  - Read token from `Authorization: Bearer` **or** the `COOKIE_NAME` cookie (add `cookie-parser`).
  - Set `req.actorId = tokenData.act?.sub`; keep `tokenData.claims`/`scopes` on `req` for audit.

**Test**

- Token with `aud=http://localhost:3001` → `200` on `GET /api/expenses/me`.
- Token with `aud=http://localhost:3001/mcp` → `401` with the audience error.
- Same valid token delivered via cookie instead of header → `200`.

---

## Stage 3 — ⚙️🟦 Audit log schema + repository

**Changes**

- `src/db/schema.ts`: drop & recreate `audit_log` with columns `id` (TEXT UUID PK), `user_id`,
  `actor_type` CHECK(`'user'|'agent'`), `actor_client_id` (nullable), `action`, `resource_type`,
  `resource_id` (nullable), `scope_used`, `status_code` (INT), `created_at` (ISO). Add indexes on
  `(user_id)`, `(actor_type)`, `(created_at)`.
- New `src/db/repositories/auditLog.repository.ts`: `insert(row)`, `findForUser(userId, filters)`,
  `findForTeam(managerId, filters)` (self + direct reports), `findAll(filters)`. Register in
  `repositories/index.ts`.

**Test**

- `pnpm --filter expenses-server run db:reset && pnpm --filter expenses-server run db:seed`
  succeeds with the new schema.
- A throwaway script inserting a row then calling each `find*` returns expected rows.

---

## Stage 4 — 🟦 Real audit middleware

**Changes**

- New `src/middleware/auditLog.middleware.ts` (replaces `auditMiddleware` usage): on `res.finish`,
  derive `action` from method+route, read `req.user.sub`/`req.actorId`/`scp`, write one row via the
  repo. Apply globally in `src/api/index.ts` after `authMiddleware`.
- Update `expense.routes.ts` etc. to drop the old per-route `auditMiddleware(...)` calls.

**Test**

- Hit `POST /api/expenses/:id/approve` with a direct token → row with `actor_type='user'`,
  `actor_client_id=null`, `action='approve_expense'`, correct `status_code`.
- Hit it with a token containing an `act` claim → row with `actor_type='agent'`,
  `actor_client_id=<act.sub>`.

---

## Stage 5 — 🟦 New REST routes: `/api/users/me` + `/api/activity`

**Changes**

- `user.routes.ts` / `user.controller.ts`: `GET /api/users/me` (auth only, no scope) → profile
  incl. roles + manager. Note: current `user.routes.ts` applies `requireFinanceAdmin` at router
  level — mount `/me` so it is NOT behind that guard.
- New `activity.routes.ts` + `activity.controller.ts`: `GET /api/activity` gated by
  `requireAnyScope(view:own|team|all)`; controller picks `findForUser/Team/All` by role; supports
  `actorType`, `action`, `fromDate`, `toDate`, `page`, `limit`.

**Test**

- `GET /api/users/me` returns the caller (employee token works — not finance-gated).
- As employee → `/api/activity` shows only own rows; as manager → own + reports; as finance_admin →
  all. Filters narrow results correctly.

---

## Stage 6 — 🟦 OIDC callback + dual PRM

**Changes**

- New `oidc.routes.ts`: `POST /oidc/callback` { code } → exchange code at `LR_TOKEN_ENDPOINT`
  (`grant_type=authorization_code`, `redirect_uri`, client creds, `resource=REST_RESOURCE_URL`) →
  set HttpOnly+SameSite cookie → return `{ user }`. `POST /oidc/logout` clears the cookie. Mount
  public (before auth), with CORS `credentials: true` for the React origin.
- `well-known.routes.ts`: existing `/.well-known/oauth-protected-resource` advertises
  `http://localhost:3001/mcp` + `mcp:tools`; add `/api/.well-known/oauth-protected-resource` advertising
  `http://localhost:3001` + all `expense:*`.
- Tighten `index.ts` CORS to the React origin (not `*`) since credentials are used.

**Test**

- Both PRM docs return correct `resource` + `scopes_supported`.
- Manual: paste a real auth code → `POST /oidc/callback` sets the cookie; a follow-up
  `GET /api/users/me` (cookie only, no header) returns `200`. `POST /oidc/logout` → subsequent call
  `401`.

> **End of REST workstream — fully testable with direct tokens / the React-style cookie flow, no
> MCP needed yet.**

---

## Stage 7 — 🟪 Token exchange utility

**Changes**

- New `src/utils/tokenExchange.ts`: `getActorToken()` (`client_credentials`, cached until ~30s
  before expiry), `exchangeToken(subjectToken, scope)` (RFC 8693 delegation), `TokenExchangeError`.

**Test**

- Manual harness: `getActorToken()` returns a token with `aud=http://localhost:3001`, `sub=client_id`, no
  user. `exchangeToken(<user mcp token>, 'expense:view:own')` returns a token with `aud=http://localhost:3001`,
  `sub=<user>`, `act.sub=<client_id>`, `scp=expense:view:own`. Second `getActorToken()` call hits
  cache (no network).

---

## Stage 8 — 🟪 MCP auth hardening

**Changes**

- `src/mcp/auth.ts`: keep `audience: MCP_RESOURCE_URL`; reject `aud=http://localhost:3001`; assert
  `mcp:tools` present; ensure raw subject JWT stays on `authInfo.token`.

**Test**

- MCP call with `aud=http://localhost:3001/mcp` + `mcp:tools` → passes auth.
- MCP call with `aud=http://localhost:3001` → rejected. MCP token lacking `mcp:tools` → rejected.

---

## Stage 9 — 🟪 Rewrite MCP tools to call REST

**Changes**

- Rewrite each of the 7 `src/mcp/tools/*.ts` to the pattern: `exchangeToken(subject, scope)` →
  `fetch(REST_BASE_URL + endpoint, { Authorization: Bearer <exchanged> })` → return REST body.
  `who_am_i` calls `GET /api/users/me` with the original MCP token (no exchange). Remove
  `defineTool({ scopes })` enforcement and all service/repo imports. Map per the table in PLAN.md.

**Test**

- Through an MCP client (or JSON-RPC curl to `/mcp`): `list_my_expenses` returns the user's
  expenses; `approve_expense` approves and the REST `audit_log` row shows `actor_type='agent'` with
  the MCP `client_id`. A user whose role lacks the scope → LR refuses the exchange / REST returns
  `403` (least-privilege enforced by AS + REST, not the tool).

> **End of MCP workstream — agent path produces `agent`-tagged audit rows end-to-end.**

---

## Stage 10 — 🟩 React scaffold + auth context

**Changes**

- `apps/expense-client`: add `react-router-dom`; create an API client (fetch wrapper with
  `credentials: 'include'`), an `AuthContext` that calls `/api/users/me` on load, a Login page that
  redirects to `LR_AUTHORIZE_URL` (resource=rest, all scopes, `response_type=code`), and a callback
  route that POSTs `code` → `/oidc/callback`. Protected-route wrapper + role-aware nav.

**Test**

- `pnpm --filter expense-client run dev`; full login round-trip lands authenticated; refresh stays
  logged in (cookie); logout returns to Login. Nav hides manager/finance items for an employee.

---

## Stage 11 — 🟩 Expense pages

**Changes**

- Submit Expense (`POST /api/expenses`), My Expenses (`GET /api/expenses/me`, filter+pagination),
  Team Expenses (`GET /api/expenses/team/:teamId`, manager+, inline approve/reject), Reports
  (finance_admin, `POST /api/expenses/reports/generate`).

**Test**

- Employee submits → appears in My Expenses (`pending`). Manager approves from Team Expenses →
  status flips to `approved`. Employee cannot reach Team/Reports (route + nav gated).

---

## Stage 12 — 🟩 Activity page (centerpiece)

**Changes**

- Activity table from `GET /api/activity`. Columns: Timestamp, User, Action, Resource, **Performed
  via** (Web App vs 🤖 <client name> from `actor_client_id` lookup), Scope used, Result
  (`status_code`). Filters: Performed via (`actorType`), Action, date range. Client-side
  `client_id → friendly name` map.

**Test — the demo payoff**

- As a manager: approve one expense in the React app, then ask an MCP client (Claude) to approve
  another. Both appear in Activity — one tagged **Web App**, one tagged **🤖 <client>** — same user,
  same action, two authorization paths. Employee sees only their own rows; finance_admin sees all.

---

## Final verification checklist

- [ ] REST rejects `aud=http://localhost:3001/mcp`; MCP rejects `aud=http://localhost:3001`.
- [ ] `oidc.ts` no longer returns a forged token on failure.
- [ ] Every REST request writes exactly one audit row with correct `actor_type`.
- [ ] Agent path: exchanged token has `sub`=user, `act.sub`=mcp client, scope = only what the tool
      needs.
- [ ] Activity visibility tiers match expense visibility (own/team/all).
- [ ] No `client_secret` reaches the browser or the MCP client; cookie is HttpOnly; tokens never
      logged.
- [ ] `pnpm db:reset && pnpm db:seed` rebuilds cleanly with the new audit schema.
