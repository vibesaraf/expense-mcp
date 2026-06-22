# PLAN — Token Exchange Architecture + React Client

> The previous Scalekit→LoginRadius migration plan was moved to
> `apps/expenses-server/docs/PLAN-scalekit-migration.md` (it is complete; this is a new effort).

## Goal

Refactor the expense system from a single-resource server (where MCP tools call services
directly) into a two-resource, **RFC 8693 token-exchange** architecture, and add a React client
that drives the same REST API directly. The payoff is an **Activity page** that shows, for every
action, whether it was performed by a human in the web app or by an AI agent acting on the user's
behalf — using the `act` claim that token exchange preserves.

This document describes the approach only. The executable, testable breakdown is in `STAGE.md`.

---

## Current State (verified in code)

- **One resource.** REST `authMiddleware` validates the token's audience against
  `config.SERVER_URL`; MCP `mcpAuthMiddleware` validates against `config.MCP_RESOURCE_URL`.
- **MCP tools run business logic directly.** `src/mcp/tools/*.ts` import `expenseService`,
  `reportService`, `userRepository` and enforce `expense:*` scopes at the tool layer via
  `defineTool({ scopes })`.
- **Audit is fake.** `audit.middleware.ts` only `console.log`s. The `audit_log` table exists but
  no request path writes to it.
- **`utils/oidc.ts` has a critical bug.** On *any* verification error its `catch` block **returns a
  forged token** (`scopes: ["mcp:tools"]`, bogus `sub`/`aud`) instead of throwing. This silently
  defeats signature and audience checks and MUST be fixed before audience isolation can be trusted.
- **Missing pieces:** no `GET /api/users/me`, no `/oidc/callback`, no cookie auth, no
  `/api/activity`. The React app (`apps/expense-client`) is an untouched Vite + React 19 stub
  (no router, no data libs).
- **Config already present:** `LR_TOKEN_ENDPOINT`, `LR_CLIENT_ID/SECRET`, `MCP_RESOURCE_URL`,
  `LR_ISSUER`, `LR_JWKS_URI`. `McpScopes` (6 scopes) + `LR_MCP_SCOPE = "mcp:tools"` exist in
  `config/constants.ts`.

---

## Target Architecture

Two **logical** resources in one Node process on `localhost:3001`, separated by distinct `aud`
claims and distinct Protected Resource Metadata documents:

| Resource   | `aud`                  | Scopes                       | Token senders                           |
| ---------- | ---------------------- | ---------------------------- | --------------------------------------- |
| MCP Server | `http://localhost:3001/mcp`   | `mcp:tools` (coarse)         | MCP clients (Claude Desktop, Code…)     |
| REST API   | `http://localhost:3001`  | the six `expense:*` scopes   | Exchanged tokens **and** direct (React) |

Hard boundary: REST rejects any token with `aud = http://localhost:3001/mcp`; MCP rejects any token with
`aud = http://localhost:3001`.

### Two paths into the REST API

1. **Agent path** — MCP client holds a `mcp:tools` token for `http://localhost:3001/mcp`. Per tool call the MCP
   server (a) obtains its own M2M `client_credentials` token (the *actor*), (b) performs an RFC 8693
   **delegation** exchange (subject = user's MCP token, actor = M2M token) requesting only the one
   scope that tool needs, then (c) calls the REST endpoint over HTTP with the exchanged token. The
   exchanged token carries `sub` = user and `act.sub` = MCP `client_id`.

2. **Direct path** — React app runs Authorization Code flow against LoginRadius with
   `resource = http://localhost:3001` and all `expense:*` scopes, `response_type=code`. The code is
   POSTed to the REST API's `/oidc/callback`, which exchanges it for a token and sets it as an
   HttpOnly cookie. Subsequent React requests carry that token (no `act` claim).

REST treats both paths identically except the audit log records `actor_type` = `agent` vs `user`
based on presence of the `act` claim. User identity (`sub`) is preserved end-to-end on both paths.

---

## Workstream 1 — REST API (source of truth)

Service / repository / controller business logic stays **unchanged**. Work is confined to config,
auth middleware, audit, schema, and new routes.

1. **Config** (`src/config/index.ts`): add `REST_RESOURCE_URL` (`http://localhost:3001`),
   `REST_BASE_URL` (`http://localhost:3001`, where MCP tools send internal HTTP), and
   `MCP_SERVER_ACTOR_SCOPES` (space-delimited ceiling for the M2M actor token). Also need
   LR authorize endpoint + redirect URI values for the `/oidc/callback` exchange.

2. **Fix `utils/oidc.ts`**: delete the forged-token fallback — verification failure must throw so
   callers return `401`. Add `act` to `TokenData` (already returns `audience`). Prerequisite for
   trustworthy audience isolation.

3. **REST `authMiddleware`**: validate `aud === REST_RESOURCE_URL` (not `SERVER_URL`); explicitly
   reject `aud === MCP_RESOURCE_URL` → `401 invalid_token` ("Token audience is not valid for this
   resource"). Read the token from `Authorization: Bearer` **or** the auth cookie (React path).
   Extract `act?.sub` → `req.actorId`; keep validated claims on the request for audit. Role
   derivation continues to use `sub`, never `act.sub`.

4. **Audit**: replace the fake middleware with a real `auditLog` middleware on every REST route
   (reads included). One row per request, written after the response finishes: `user_id` (`sub`),
   `actor_type` (`agent` if `act` present else `user`), `actor_client_id` (`act.sub`|null), `action`
   (derived from method+route, reusing MCP tool-name vocabulary, e.g. `approve_expense`),
   `resource_type`, `resource_id`, `scope_used` (`scp`), `status_code`.

5. **DB schema** (`src/db/schema.ts`): replace `audit_log` with the richer collection — `id`,
   `user_id`, `actor_type`, `actor_client_id`, `action`, `resource_type`, `resource_id`,
   `scope_used`, `status_code`, `created_at`. Destructive by design (demo): rebuild via
   `pnpm db:reset`. Add `auditLog.repository.ts` with `findForUser` / `findForTeam` / `findAll`.

6. **New routes**:
   - `GET /api/users/me` — caller profile (no scope). Powers `who_am_i` and React nav gating.
   - `GET /api/activity` — audit rows scoped by role (own / team / all, mirroring expense
     visibility, reusing `expense:view:*` as gates). Params: `actorType`, `action`, `fromDate`,
     `toDate`, `page`, `limit`.
   - `POST /oidc/callback` — accept auth code from React, exchange at LR for a REST-audience token,
     set HttpOnly cookie, return minimal profile. Plus `POST /oidc/logout` to clear the cookie.
   - Second PRM document for `http://localhost:3001` at `/api/.well-known/oauth-protected-resource`;
     update the existing well-known route to advertise `http://localhost:3001/mcp` + `mcp:tools` only.

---

## Workstream 2 — MCP Server (thin intermediary)

1. **Token exchange utility** (`src/utils/tokenExchange.ts`, NEW): `getActorToken()`
   (`client_credentials`, in-memory cached until ~30s before expiry) and
   `exchangeToken(subjectToken, scope)` (RFC 8693 delegation: subject + actor → narrow REST token).
   Typed `TokenExchangeError`. Both POST to `LR_TOKEN_ENDPOINT`.

2. **MCP `mcpAuthMiddleware`**: assert `aud === MCP_RESOURCE_URL`, reject `http://localhost:3001`; assert
   `mcp:tools` present; keep the raw inbound JWT available as the subject token (`authInfo.token`
   already holds it).

3. **Rewrite all 7 tools** to: exchange for the single scope the tool needs → `fetch` the matching
   REST endpoint with the exchanged token as Bearer → return the REST response body. Remove all
   direct service/repository imports and the per-tool `expense:*` scope enforcement (now only in
   REST). Per-tool scope/endpoint map (from architecture doc):

   | Tool | Exchange scope | REST endpoint |
   | --- | --- | --- |
   | `who_am_i` | none needed | `GET /api/users/me` (original MCP token) |
   | `submit_expense` | `expense:submit` | `POST /api/expenses` |
   | `list_my_expenses` | `expense:view:own` | `GET /api/expenses/me` |
   | `list_team_expenses` | `expense:view:team` | `GET /api/expenses/team/:teamId` |
   | `approve_expense` | `expense:approve` | `POST /api/expenses/:id/approve` |
   | `reject_expense` | `expense:approve` | `POST /api/expenses/:id/reject` |
   | `generate_report` | `expense:report:generate` | `POST /api/expenses/reports/generate` |

The architectural point: fine-grained authorization is delegated entirely to the REST API.

---

## Workstream 3 — React Client (`apps/expense-client`)

Currently a bare Vite + React 19 stub. Build the human-facing counterpart of the agent path.

1. **Scaffold**: add routing (react-router), an API client that sends requests with credentials
   (cookie) included, and an auth context that loads `/api/users/me` for role-aware nav.

2. **Auth flow**: Login page redirects to LoginRadius authorize with
   `resource=http://localhost:3001`, `response_type=code`, all `expense:*` scopes. The redirect
   returns to a callback route that forwards `code` → `POST /oidc/callback`; server sets the cookie.
   App is thereafter cookie-authenticated.

3. **Pages**:
   - **Submit Expense** — `POST /api/expenses`.
   - **My Expenses** — `GET /api/expenses/me`, status filter + pagination.
   - **Team Expenses** — `GET /api/expenses/team/:teamId`, manager+ only (nav hidden otherwise),
     inline approve/reject.
   - **Reports** — finance_admin only, `POST /api/expenses/reports/generate`.
   - **Activity** (centerpiece) — `GET /api/activity` as a table. Key column "Performed via"
     renders **Web App** for `actor_type='user'` and **🤖 <client name>** for `actor_type='agent'`
     (friendly name resolved from `actor_client_id` via a small client-side lookup). Filters:
     actorType, action, date range. Visible rows scoped server-side by role.

---

## Cross-Cutting Concerns

- **Security**: audience isolation is the hard boundary and only holds after the `oidc.ts` forged
  fallback is removed. Exchanged tokens are short-lived (~300s), minted per call. `client_secret`
  stays server-side only — never shipped to React or the MCP client. The HttpOnly cookie protects
  the REST token from XSS; pair with `SameSite` and CSRF handling on state-changing routes. Never
  log token contents.
- **LoginRadius config** (prerequisite, out of code scope, see architecture HTML): two resource
  servers registered; token-exchange grant enabled on the shared client; role→scope grants on
  `http://localhost:3001` so LR downscopes per the subject user's role.
- **DB**: schema change is destructive by design for the demo — `pnpm db:reset` rebuilds.
- **Ordering**: REST first (source of truth, independently testable with direct tokens), then MCP
  (depends on REST endpoints), then React (depends on `/oidc/callback` + `/api/activity`).
