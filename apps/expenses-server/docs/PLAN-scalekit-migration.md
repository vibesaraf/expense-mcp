# Migration Plan: Scalekit → LoginRadius (OIDC/MCP with Introspection + Local RBAC)

## Context

Migrating the expense-management MCP server from Scalekit to LoginRadius dev environment. LoginRadius does not support RBAC natively, so we maintain a local user→role→scopes mapping in the existing `users` table.

### LoginRadius MCP App Details

- **Tenant**: `dev-vaibhav`
- **Dev IDX Host**: `devhub.lrinternal.com`
- **MCP App Identifier**: `expense-2`
- **Issuer**: `https://dev-vaibhav.devhub.lrinternal.com/service/oauth/expense-2`
- **Well-Known Metadata**: `https://dev-vaibhav.devhub.lrinternal.com/.well-known/oauth-authorization-server/service/oauth/expense-2/`

### Key Endpoints (from well-known metadata)

| Purpose | URL |
|---------|-----|
| Authorization | `https://dev-vaibhav.devhub.lrinternal.com/service/oauth/expense-2/authorize` |
| Token | `https://dev-vaibhav.devhub.lrinternal.com/api/oauth/expense-2/token` |
| JWKS | `https://dev-vaibhav.devhub.lrinternal.com/service/oauth/expense-2/jwks` |
| Introspection | `https://dev-vaibhav.devhub.lrinternal.com/api/oauth/expense-2/introspect` |
| DCR Registration | `https://dev-vaibhav.devhub.lrinternal.com/api/oauth/expense-2/register` |
| Revocation | `https://dev-vaibhav.devhub.lrinternal.com/api/oauth/expense-2/revoke` |
| Device Authorization | `https://dev-vaibhav.devhub.lrinternal.com/service/oauth/expense-2/device/authorize` |

### Design Decisions

- **Token Validation**: Introspection endpoint (not local JWKS)
- **User Matching**: By `sub` (LoginRadius UID) first, fallback to `email`
- **RBAC Storage**: Extend existing `users` table with `lr_user_id` + `scopes` columns
- **No SDK**: All LoginRadius interactions via raw HTTP (fetch)
- **Scope Model**: LoginRadius issues `mcp:tools` scope; fine-grained expense scopes (`expense:submit`, `expense:view:own`, etc.) are enforced locally from `users` table

---

## Phase 1: Configuration & Dependencies

### 1a. Remove Scalekit

**Files to delete:**
- `src/config/scalekit.ts` (Scalekit client singleton)

**Package to remove:**
```bash
bun remove @scalekit-sdk/node
```

**Files to update (remove Scalekit imports):**
- `src/middleware/auth.middleware.ts`
- `src/config/index.ts` (if it re-exports scalekit config)
- Any other file importing from `@scalekit-sdk/node` or `src/config/scalekit`

### 1b. Create LoginRadius Config

**New file: `src/config/loginradius.ts`**

```typescript
import { z } from "zod"

export const loginRadiusConfigSchema = z.object({
  LR_ISSUER: z.string().url(),
  LR_INTROSPECT_URL: z.string().url(),
  LR_JWKS_URI: z.string().url(),
  LR_CLIENT_ID: z.string().min(1),
  LR_CLIENT_SECRET: z.string().min(1),
  LR_TOKEN_ENDPOINT_AUTH_METHOD: z
    .enum(["client_secret_post", "client_secret_basic"])
    .default("client_secret_post"),
})

export type LoginRadiusConfig = z.infer<typeof loginRadiusConfigSchema>

let config: LoginRadiusConfig | null = null

export function getLoginRadiusConfig(): LoginRadiusConfig {
  if (!config) {
    config = loginRadiusConfigSchema.parse({
      LR_ISSUER: process.env.LR_ISSUER,
      LR_INTROSPECT_URL: process.env.LR_INTROSPECT_URL,
      LR_JWKS_URI: process.env.LR_JWKS_URI,
      LR_CLIENT_ID: process.env.LR_CLIENT_ID,
      LR_CLIENT_SECRET: process.env.LR_CLIENT_SECRET,
      LR_TOKEN_ENDPOINT_AUTH_METHOD: process.env.LR_TOKEN_ENDPOINT_AUTH_METHOD,
    })
  }
  return config
}
```

**New file: `src/config/loginradius-client.ts`** (introspection helper)

```typescript
import { getLoginRadiusConfig } from "./loginradius"

export interface IntrospectionResponse {
  active: boolean
  sub?: string
  email?: string
  scope?: string
  iss?: string
  aud?: string
  exp?: number
  iat?: number
  client_id?: string
  token_type?: string
}

export async function introspectToken(
  accessToken: string
): Promise<IntrospectionResponse> {
  const config = getLoginRadiusConfig()

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  }

  let body: Record<string, string>

  if (config.LR_TOKEN_ENDPOINT_AUTH_METHOD === "client_secret_basic") {
    // Basic auth: base64(client_id:client_secret) in Authorization header
    const credentials = Buffer.from(
      `${config.LR_CLIENT_ID}:${config.LR_CLIENT_SECRET}`
    ).toString("base64")
    headers["Authorization"] = `Basic ${credentials}`
    body = {
      token: accessToken,
      token_type_hint: "access_token",
    }
  } else {
    // client_secret_post: credentials in request body
    body = {
      token: accessToken,
      token_type_hint: "access_token",
      client_id: config.LR_CLIENT_ID,
      client_secret: config.LR_CLIENT_SECRET,
    }
  }

  const response = await fetch(config.LR_INTROSPECT_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(
      `Introspection request failed: ${response.status} ${response.statusText}`
    )
  }

  return response.json() as Promise<IntrospectionResponse>
}
```

> **NOTE**: The introspection endpoint request format above is based on standard RFC 7662 + LoginRadius M2M docs. You should verify the exact request format with your dev environment. LoginRadius OIDC apps may use `application/x-www-form-urlencoded` instead of JSON — adjust the Content-Type and body encoding if needed:
>
> ```typescript
> // If form-urlencoded is required instead of JSON:
> headers["Content-Type"] = "application/x-www-form-urlencoded"
> const bodyParams = new URLSearchParams(body)
> // ... fetch with body: bodyParams.toString()
> ```

### 1c. Update Environment Variables

**Remove from `.env`:**
```
SCALEKIT_ENV_URL=...
SCALEKIT_CLIENT_ID=...
SCALEKIT_CLIENT_SECRET=...
```

**Add to `.env`:**
```bash
# LoginRadius OIDC / MCP App
LR_ISSUER=https://dev-vaibhav.devhub.lrinternal.com/service/oauth/expense-2
LR_INTROSPECT_URL=https://dev-vaibhav.devhub.lrinternal.com/api/oauth/expense-2/introspect
LR_JWKS_URI=https://dev-vaibhav.devhub.lrinternal.com/service/oauth/expense-2/jwks
LR_CLIENT_ID=<your-mcp-app-client-id>
LR_CLIENT_SECRET=<your-mcp-app-client-secret>
LR_TOKEN_ENDPOINT_AUTH_METHOD=client_secret_post

# MCP Resource Server
MCP_RESOURCE_URL=http://localhost:3000/mcp
```

**Update `src/config/env.ts` (or wherever Zod env validation lives):**
- Remove Scalekit env vars from the schema
- Add the `LR_*` vars above
- Keep or rename `MCP_SERVER_URL` → `MCP_RESOURCE_URL`

### 1d. Update `src/config/constants.ts`

The `McpScopes` constant should remain, as the fine-grained scopes are still used locally. Optionally add:

```typescript
export const LR_MCP_SCOPE = "mcp:tools" // The single scope from LoginRadius
```

---

## Phase 2: Auth Middleware Rewrite

### 2a. Rewrite `src/middleware/auth.middleware.ts`

**Current flow:**
```
Bearer token → scalekitClient.validateAccessToken() → extract roles from Scalekit claims → mapScalekitRoles() → attach to req.user
```

**New flow:**
```
Bearer token
  → introspectToken(token)
  → verify active === true
  → verify iss matches LR_ISSUER
  → extract sub, email, scope from introspection response
  → lookup users table by lr_user_id (sub) OR email
  → if not found → 401 "User not registered"
  → attach local role + scopes + user data to req.user
  → if 401 → include WWW-Authenticate header with PRM URL
```

**Pseudocode for new middleware:**

```typescript
import { introspectToken } from "@/config/loginradius-client"
import { getLoginRadiusConfig } from "@/config/loginradius"
import { UnauthorizedError } from "@/utils/errors"
// Import the user repository (existing or updated)

export async function authMiddleware(req, res, next) {
  try {
    // 1. Extract Bearer token
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith("Bearer ")) {
      return sendUnauthorized(res, "Missing or invalid Authorization header")
    }
    const token = authHeader.slice(7)

    // 2. Introspect token with LoginRadius
    const introspectResult = await introspectToken(token)

    // 3. Validate introspection response
    if (!introspectResult.active) {
      return sendUnauthorized(res, "Token is not active")
    }

    const config = getLoginRadiusConfig()
    if (introspectResult.iss && introspectResult.iss !== config.LR_ISSUER) {
      return sendUnauthorized(res, "Token issuer mismatch")
    }

    // 4. Extract identity from introspection
    const sub = introspectResult.sub
    const email = introspectResult.email
    const lrScopes = introspectResult.scope?.split(" ") ?? []

    // 5. Verify mcp:tools scope from LoginRadius (gate-level check)
    if (!lrScopes.includes("mcp:tools")) {
      return sendForbidden(res, "Missing required scope: mcp:tools")
    }

    // 6. Lookup user in local DB by sub OR email
    const user = userRepository.findByLrUserIdOrEmail(sub, email)
    if (!user) {
      return sendUnauthorized(res, "User not registered in this application")
    }

    // 7. If lr_user_id was null (first login), update it
    if (!user.lr_user_id && sub) {
      userRepository.updateLrUserId(user.user_id, sub)
    }

    // 8. Attach enriched user context to request
    req.user = {
      userId: user.user_id,
      email: user.email,
      fullName: user.full_name,
      roles: [user.role],
      scopes: user.scopes?.split(" ") ?? [],
      department: user.department,
      managerId: user.manager_id,
    }

    next()
  } catch (error) {
    return sendUnauthorized(res, "Authentication failed")
  }
}

function sendUnauthorized(res, message: string) {
  const prmUrl = `${process.env.MCP_RESOURCE_URL?.replace(/\/mcp$/, "")}/.well-known/oauth-protected-resource`
  res
    .status(401)
    .set(
      "WWW-Authenticate",
      `Bearer realm="expense-mcp", resource_metadata="${prmUrl}"`
    )
    .json({ error: "unauthorized", message })
}

function sendForbidden(res, message: string) {
  res.status(403).json({ error: "forbidden", message })
}
```

### 2b. `requireRoles()` and `requireScopes()` — Minimal Changes

These middlewares in `src/middleware/rbac.middleware.ts` should already read from `req.user.roles` and `req.user.scopes`. Verify the shape matches:

```typescript
// Expected shape on req.user (same as before, just sourced differently)
interface AuthenticatedUser {
  userId: string
  email: string
  fullName: string
  roles: string[]          // e.g. ["manager"]
  scopes: string[]         // e.g. ["expense:submit", "expense:view:own", "expense:view:team"]
  department?: string
  managerId?: string
}
```

**Check:** If the existing `mapScalekitRoles()` function did role normalization (e.g., `finance-admin` → `finance_admin`), you can remove that since roles now come directly from your local DB in the correct format.

### 2c. Remove Scalekit-specific code

- Delete `mapScalekitRoles()` helper function
- Remove any Scalekit claim extraction logic
- Remove any Scalekit token type references

---

## Phase 3: Database Schema Changes

### 3a. Update `users` Table in `src/db/schema.ts`

Add two columns to the `users` table creation:

```sql
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('employee', 'manager', 'finance_admin')),
  department TEXT,
  manager_id TEXT,
  lr_user_id TEXT UNIQUE,                    -- NEW: LoginRadius sub claim
  scopes TEXT NOT NULL DEFAULT '',            -- NEW: space-separated scopes
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (manager_id) REFERENCES users(user_id)
)
```

Add index for `lr_user_id` lookups:

```sql
CREATE INDEX IF NOT EXISTS idx_users_lr_user_id
ON users(lr_user_id)
```

### 3b. Handle Existing DB — Migration Strategy

Since this is a dev project with `db:reset`, the simplest approach:

1. Add the columns to `createTables()` in `src/db/schema.ts`
2. Run `bun run db:reset` to recreate with new schema
3. Update seed data to include scopes (Phase 6)

If you need a non-destructive migration for any reason:

```sql
-- Run manually or add to a migration script
ALTER TABLE users ADD COLUMN lr_user_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN scopes TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_users_lr_user_id ON users(lr_user_id);
```

### 3c. Update User Repository — `src/db/repositories/user.repository.ts`

Add these new methods to the existing `UserRepository` (which extends `BaseRepository`):

```typescript
// New method: find by LoginRadius user ID (sub claim)
findByLrUserId(lrUserId: string): User | undefined {
  const stmt = this.db.prepare(
    "SELECT * FROM users WHERE lr_user_id = ?"
  )
  return stmt.get(lrUserId) as User | undefined
}

// New method: find by lr_user_id OR email (used by auth middleware)
findByLrUserIdOrEmail(lrUserId?: string, email?: string): User | undefined {
  // Try sub first (more specific)
  if (lrUserId) {
    const user = this.findByLrUserId(lrUserId)
    if (user) return user
  }
  // Fallback to email
  if (email) {
    return this.findByEmail(email)
  }
  return undefined
}

// New method: link LoginRadius identity to local user
updateLrUserId(userId: string, lrUserId: string): void {
  const stmt = this.db.prepare(
    "UPDATE users SET lr_user_id = ?, updated_at = datetime('now') WHERE user_id = ?"
  )
  stmt.run(lrUserId, userId)
}
```

Ensure `findByEmail()` already exists (it likely does). If not, add it:

```typescript
findByEmail(email: string): User | undefined {
  const stmt = this.db.prepare("SELECT * FROM users WHERE email = ?")
  return stmt.get(email) as User | undefined
}
```

### 3d. Update User Type — `src/types/`

Add the new fields to the User interface:

```typescript
export interface User {
  user_id: string
  email: string
  full_name: string
  role: "employee" | "manager" | "finance_admin"
  department?: string
  manager_id?: string
  lr_user_id?: string       // NEW
  scopes: string            // NEW: space-separated
  created_at: string
  updated_at: string
}
```

---

## Phase 4: Protected Resource Metadata (RFC 9728)

### 4a. New Route: `GET /.well-known/oauth-protected-resource`

**New file: `src/api/routes/well-known.routes.ts`**

```typescript
import { Router } from "express"

const router = Router()

router.get("/.well-known/oauth-protected-resource", (req, res) => {
  const resourceUrl = process.env.MCP_RESOURCE_URL || "http://localhost:3000/mcp"
  const issuer = process.env.LR_ISSUER

  res.json({
    resource: resourceUrl,
    authorization_servers: [issuer],
    scopes_supported: ["mcp:tools"],
    bearer_methods_supported: ["header"],
  })
})

export default router
```

**Register in `src/api/routes/index.ts` or main app:**

```typescript
import wellKnownRoutes from "./api/routes/well-known.routes"

// Mount BEFORE auth middleware (this endpoint must be public)
app.use(wellKnownRoutes)
```

> **Important**: This endpoint must NOT require authentication. Mount it before the auth middleware or explicitly exclude it.

### 4b. Verify AS Metadata from LoginRadius

Your LoginRadius MCP app already serves AS metadata at:
```
GET https://dev-vaibhav.devhub.lrinternal.com/.well-known/oauth-authorization-server/service/oauth/expense-2/
```

This includes `registration_endpoint` for DCR. Your MCP server does NOT proxy this — the MCP client fetches it directly from LoginRadius after discovering the AS URL from your PRM endpoint.

**DCR flow from client's perspective:**
1. Client → `POST /mcp` → gets 401 with `WWW-Authenticate` header
2. Client → `GET /.well-known/oauth-protected-resource` → discovers AS URL
3. Client → `GET <AS>/.well-known/oauth-authorization-server` → discovers endpoints including `registration_endpoint`
4. Client → `POST <registration_endpoint>` → DCR with LoginRadius → gets `client_id`
5. Client → OAuth authorize flow with LoginRadius → gets access token
6. Client → `POST /mcp` with `Authorization: Bearer <token>` → proceeds

---

## Phase 5: MCP Transport Updates

### 5a. Update MCP Server Mount Point

Wherever the MCP StreamableHTTP transport is mounted (likely in `src/mcp/` or main server file), ensure:

1. **Unauthenticated requests** return 401 with `WWW-Authenticate` header (already handled by auth middleware from Phase 2)
2. **The auth middleware is applied** to the `/mcp` route

### 5b. Dual Scope Validation for MCP Tools

MCP tool handlers should enforce TWO layers:

1. **Layer 1 (LoginRadius scope)**: `mcp:tools` — verified by auth middleware (Phase 2a, step 5)
2. **Layer 2 (Local app scopes)**: Fine-grained scopes like `expense:submit`, `expense:approve` — verified by `requireScopes()` middleware

This is the existing pattern but now the scopes come from different sources:
- `mcp:tools` → from LoginRadius JWT/introspection response
- `expense:*` → from local `users.scopes` column

The `requireScopes()` middleware checks `req.user.scopes` which is populated from the local DB. No change needed to the middleware itself.

---

## Phase 6: Seed Data (Deferred)

### 6a. Scope Assignments per Role

When you're ready to define seed users, use this mapping:

| Role | Scopes |
|------|--------|
| `employee` | `expense:submit expense:view:own` |
| `manager` | `expense:submit expense:view:own expense:view:team expense:approve` |
| `finance_admin` | `expense:submit expense:view:own expense:view:team expense:view:all expense:approve expense:report:generate` |

### 6b. Seed Data Template

Update `src/db/seed.ts` — each user now needs `scopes` and optionally `lr_user_id`:

```typescript
const users = [
  {
    user_id: "user-001",
    email: "<new-email-tbd>",
    full_name: "<new-name-tbd>",
    role: "finance_admin",
    department: "finance",
    manager_id: null,
    lr_user_id: null,  // Will be populated on first login
    scopes: "expense:submit expense:view:own expense:view:team expense:view:all expense:approve expense:report:generate",
  },
  {
    user_id: "user-002",
    email: "<new-email-tbd>",
    full_name: "<new-name-tbd>",
    role: "manager",
    department: "engineering",
    manager_id: null,
    lr_user_id: null,
    scopes: "expense:submit expense:view:own expense:view:team expense:approve",
  },
  // ... more users
]
```

The `INSERT` statement in the seed script needs to include the two new columns:

```sql
INSERT INTO users (user_id, email, full_name, role, department, manager_id, lr_user_id, scopes)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
```

### 6c. LoginRadius User Account Creation

Users must also exist in LoginRadius so they can authenticate. Options:
- Create them manually via LoginRadius Admin Console
- Create them via LoginRadius Management API (if you have API key/secret)
- Let them self-register via the LoginRadius hosted login page

The `lr_user_id` column gets populated automatically on first successful authentication (Phase 2a, step 7).

---

## File Change Summary

### New Files
| File | Purpose |
|------|---------|
| `src/config/loginradius.ts` | Zod-validated LR env config |
| `src/config/loginradius-client.ts` | Introspection helper function |
| `src/api/routes/well-known.routes.ts` | Protected Resource Metadata endpoint |

### Modified Files
| File | Changes |
|------|---------|
| `src/config/env.ts` | Remove Scalekit vars, add LR vars |
| `src/config/constants.ts` | Add `LR_MCP_SCOPE` constant (optional) |
| `src/middleware/auth.middleware.ts` | Full rewrite: introspection + local DB lookup |
| `src/middleware/rbac.middleware.ts` | Verify `req.user` shape compatibility (likely no changes) |
| `src/db/schema.ts` | Add `lr_user_id`, `scopes` columns + index to `users` table |
| `src/db/seed.ts` | Add `scopes` values to seed users, update user data (deferred) |
| `src/db/repositories/user.repository.ts` | Add `findByLrUserId`, `findByLrUserIdOrEmail`, `updateLrUserId` methods |
| `src/types/` (user interface) | Add `lr_user_id?` and `scopes` fields |
| `src/app.ts` (or main server) | Mount well-known route before auth, remove Scalekit imports |
| `.env` | Swap Scalekit vars for LR vars |
| `package.json` | Remove `@scalekit-sdk/node` |

### Deleted Files
| File | Reason |
|------|--------|
| `src/config/scalekit.ts` | No longer needed |

---

## Verification Checklist

After implementation, verify these end-to-end:

- [ ] `GET /.well-known/oauth-protected-resource` returns correct JSON (no auth required)
- [ ] `POST /mcp` without token returns 401 with `WWW-Authenticate` header containing `resource_metadata` URL
- [ ] `POST /mcp` with invalid token returns 401
- [ ] `POST /mcp` with valid LoginRadius token but user NOT in local DB returns 401
- [ ] `POST /mcp` with valid token + user in local DB succeeds
- [ ] `lr_user_id` gets populated on first login for a user matched by email
- [ ] `requireRoles("manager")` blocks employees
- [ ] `requireScopes("expense:approve")` blocks users without that local scope
- [ ] `bun run db:reset` + `bun run db:seed` works with new schema
- [ ] DCR flow: MCP client can discover AS, register, authenticate, and call tools

---

## Open Items / Things to Verify

1. **Introspection request format**: Confirm whether LoginRadius OIDC introspect endpoint expects `application/json` or `application/x-www-form-urlencoded`. Test with curl:
   ```bash
   curl -X POST https://dev-vaibhav.devhub.lrinternal.com/api/oauth/expense-2/introspect \
     -H "Content-Type: application/json" \
     -d '{"token":"<access_token>","client_id":"<id>","client_secret":"<secret>"}'
   ```
2. **Introspection response shape**: Confirm exact claim names (`sub`, `email`, `scope`) from the actual response
3. **Token endpoint auth method**: Your MCP app config determines whether to use `client_secret_post` or `client_secret_basic` — check what you configured in LoginRadius Admin Console
4. **Seed user names/emails**: To be decided when you're ready for Phase 6
5. **CORS**: If MCP clients make browser-based requests, you may need to update CORS config for the well-known endpoint