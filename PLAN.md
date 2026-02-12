I'll help you migrate from Descope to Scalekit for MCP authentication while preserving your RBAC implementation. Let me search the Scalekit documentation first.Based on the Scalekit documentation, I'll provide you with a comprehensive migration guide to replace Descope with Scalekit while preserving your RBAC implementation.

## Part 1: Scalekit Dashboard Configuration

### Step 1: Sign Up and Get API Credentials

1. **Create a Scalekit account** at https://app.scalekit.com
2. **Get your API credentials:**
   - Navigate to **Dashboard > Settings > API Credentials**
   - Copy the following values (you'll need these later):
     - Environment URL (e.g., `https://your-env.scalekit.com`)
     - Client ID
     - Client Secret

### Step 2: Register Your MCP Server

1. **Navigate to MCP Servers:**
   - Go to **Dashboard > MCP Servers > Add MCP Server**

2. **Configure your MCP server:**
   - **Name**: `Expenses MCP` (or any descriptive name)
   - **Server URL**: `http://localhost:3000/` (or your deployment URL - **must include trailing slash**)
   - **Enable Dynamic Client Registration (DCR)**: ✅ Checked
   - **Enable Client ID Metadata Document (CIMD)**: ✅ Checked
   - **Access Token Lifetime**: `3600` seconds (1 hour recommended)
   - **Scopes**: Define your OAuth 2.1 scopes matching your existing setup:
     - `expense:submit`
     - `expense:view:own`
     - `expense:view:team`
     - `expense:view:all`
     - `expense:approve`
     - `expense:report:generate`

3. **Save and copy the metadata JSON:**
   - After saving, Scalekit will display the **OAuth Protected Resource Metadata JSON**
   - **Copy this entire JSON** - you'll use it in your `.env` file
   - It should look like:
   ```json
   {
     "authorization_servers": [
       "https://<your-env>.scalekit.com/resources/<resource-id>"
     ],
     "bearer_methods_supported": ["header"],
     "resource": "http://localhost:3000/",
     "scopes_supported": [
       "expense:submit",
       "expense:view:own",
       "expense:view:team",
       "expense:view:all",
       "expense:approve",
       "expense:report:generate"
     ]
   }
   ```

### Step 3: Configure Authentication Methods (Optional)

For production, you can enable additional auth methods:

1. **Enterprise SSO** (for org-owned domains):
   - Go to **Dashboard > SSO Connections**
   - Add SAML/OIDC connections as needed

2. **Social Login**:
   - Go to **Dashboard > Social Connections**
   - Enable Google, GitHub, Microsoft, etc.

---

## Part 2: Code Changes & SDK Integration

### Step 1: Update Dependencies

**Update `package.json`:**

```json
{
  "name": "expenses-server",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "db:seed": "tsx src/db/seed.ts",
    "db:reset": "rm -f data/expense.db && bun run db:seed",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.25.3",
    "@scalekit-sdk/node": "^2.0.1",
    "better-sqlite3": "^12.6.2",
    "cors": "^2.8.6",
    "dotenv": "^17.2.3",
    "express": "^5.2.1",
    "helmet": "^8.1.0",
    "morgan": "^1.10.1",
    "uuid": "^13.0.0",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@expense/typescript-config": "workspace:*",
    "@types/better-sqlite3": "^7.6.13",
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.6",
    "@types/morgan": "^1.9.10",
    "@types/node": "^25.2.0",
    "@types/uuid": "^11.0.0",
    "tsx": "^4.21.0",
    "typescript": "^5.9.3"
  }
}
```

**Install new dependencies:**

```bash
bun remove @descope/mcp-express @descope/node-sdk
bun add @scalekit-sdk/node@^2.0.1
```

### Step 2: Update Environment Variables

**Update `.env` file:**

```env
# Server Config
PORT=3000
DATABASE_PATH=./data/expense.db
NODE_ENV=development
CORS_ORIGIN=*

# Scalekit Configuration
SCALEKIT_ENV_URL=https://<your-env>.scalekit.com
SCALEKIT_CLIENT_ID=<your-client-id>
SCALEKIT_CLIENT_SECRET=<your-client-secret>

# MCP Server Configuration
MCP_SERVER_URL=http://localhost:3000/
PROTECTED_RESOURCE_METADATA='{"authorization_servers":["https://<your-env>.scalekit.com/resources/<resource-id>"],"bearer_methods_supported":["header"],"resource":"http://localhost:3000/","scopes_supported":["expense:submit","expense:view:own","expense:view:team","expense:view:all","expense:approve","expense:report:generate"]}'
```

### Step 3: Update Scalekit Client Configuration

**Create/Update `src/config/scalekit.config.ts`:**

```typescript
import { Scalekit } from '@scalekit-sdk/node'
import { envConfig } from './env.config.js'

// Initialize Scalekit client
export const scalekitClient = new Scalekit(
  envConfig.SCALEKIT_ENV_URL,
  envConfig.SCALEKIT_CLIENT_ID,
  envConfig.SCALEKIT_CLIENT_SECRET
)

// Resource metadata configuration
export const RESOURCE_ID = envConfig.MCP_SERVER_URL
export const METADATA_ENDPOINT = `${envConfig.MCP_SERVER_URL}.well-known/oauth-protected-resource`

// WWW-Authenticate header for 401 responses
export const WWW_AUTHENTICATE_HEADER = {
  key: 'WWW-Authenticate',
  value: `Bearer realm="OAuth", resource_metadata="${METADATA_ENDPOINT}"`
}
```

**Update `src/config/env.config.ts` to include Scalekit variables:**

```typescript
import { z } from 'zod'
import dotenv from 'dotenv'

dotenv.config()

const envSchema = z.object({
  PORT: z.string().default('3000'),
  DATABASE_PATH: z.string().default('./data/expense.db'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('*'),
  
  // Scalekit Configuration
  SCALEKIT_ENV_URL: z.string().url(),
  SCALEKIT_CLIENT_ID: z.string().min(1),
  SCALEKIT_CLIENT_SECRET: z.string().min(1),
  
  // MCP Configuration
  MCP_SERVER_URL: z.string().url(),
  PROTECTED_RESOURCE_METADATA: z.string().min(1)
})

export const envConfig = envSchema.parse(process.env)
```

### Step 4: Update Authentication Middleware

**Replace `src/middleware/auth.middleware.ts`:**

```typescript
import { Request, Response, NextFunction } from 'express'
import { scalekitClient, RESOURCE_ID, WWW_AUTHENTICATE_HEADER } from '@/config/scalekit.config.js'
import { UnauthorizedError } from '@/utils/errors.js'

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string
    email: string
    scopes: string[]
    roles: string[]
  }
}

/**
 * Authentication middleware - validates Bearer tokens using Scalekit
 * Extracts user info, scopes, and roles from the validated token
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Allow public access to well-known endpoints for OAuth discovery
    if (req.path.includes('.well-known')) {
      return next()
    }

    // Extract Bearer token from Authorization header
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : null

    if (!token) {
      res
        .status(401)
        .set(WWW_AUTHENTICATE_HEADER.key, WWW_AUTHENTICATE_HEADER.value)
        .json({ error: 'Missing or invalid Bearer token' })
      return
    }

    // Validate token using Scalekit SDK
    // This verifies signature, expiration, issuer, and audience claims
    const validationResult = await scalekitClient.validateToken(token, {
      audience: [RESOURCE_ID]
    })

    // Extract user information from token claims
    const claims = validationResult as any // Scalekit returns token payload
    
    // Parse scopes from token (space-separated string to array)
    const scopes = claims.scope ? claims.scope.split(' ') : []
    
    // Extract roles from custom claims (adjust based on your Scalekit config)
    // Scalekit allows custom claims - map them to your RBAC roles
    const roles = claims.roles || []
    
    // Map Scalekit roles to your application roles
    const mappedRoles = mapScalekitRoles(roles)

    // Attach user context to request
    req.user = {
      userId: claims.sub,
      email: claims.email || '',
      scopes,
      roles: mappedRoles
    }

    next()
  } catch (error) {
    console.error('Token validation failed:', error)
    res
      .status(401)
      .set(WWW_AUTHENTICATE_HEADER.key, WWW_AUTHENTICATE_HEADER.value)
      .json({ error: 'Token validation failed' })
  }
}

/**
 * Map Scalekit roles to application roles
 * Handles role name variations and sets default role
 */
function mapScalekitRoles(scalekitRoles: string[]): string[] {
  const roleMapping: Record<string, string> = {
    'finance_admin': 'finance_admin',
    'finance-admin': 'finance_admin',
    'financeadmin': 'finance_admin',
    'manager': 'manager',
    'employee': 'employee'
  }

  if (!scalekitRoles || scalekitRoles.length === 0) {
    return ['employee'] // Default role
  }

  const mapped = scalekitRoles
    .map(role => roleMapping[role.toLowerCase()])
    .filter(Boolean)

  return mapped.length > 0 ? mapped : ['employee']
}
```

### Step 5: Add OAuth Discovery Endpoint

**Update `src/index.ts` or create `src/routes/oauth.routes.ts`:**

```typescript
import express from 'express'
import { envConfig } from '@/config/env.config.js'

export const oauthRouter = express.Router()

/**
 * OAuth Protected Resource Metadata endpoint
 * Required for MCP client discovery of authorization server
 */
oauthRouter.get('/.well-known/oauth-protected-resource', (req, res) => {
  try {
    const metadata = JSON.parse(envConfig.PROTECTED_RESOURCE_METADATA)
    res.type('application/json').send(JSON.stringify(metadata, null, 2))
  } catch (error) {
    res.status(500).json({ error: 'Failed to load protected resource metadata' })
  }
})
```

**Register the router in `src/index.ts`:**

```typescript
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { envConfig } from './config/env.config.js'
import { authMiddleware } from './middleware/auth.middleware.js'
import { oauthRouter } from './routes/oauth.routes.js'
import { apiRouter } from './api/routes.js'
import { mcpRouter } from './mcp/routes.js'

const app = express()

// Middleware
app.use(cors({ origin: envConfig.CORS_ORIGIN }))
app.use(helmet())
app.use(morgan('dev'))
app.use(express.json())

// OAuth discovery endpoint (public, no auth)
app.use(oauthRouter)

// Apply authentication to all other routes
app.use(authMiddleware)

// API and MCP routes (protected)
app.use('/api', apiRouter)
app.use('/mcp', mcpRouter)

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' })
})

const PORT = parseInt(envConfig.PORT)
app.listen(PORT, () => {
  console.log(`🚀 Expenses server running on http://localhost:${PORT}`)
  console.log(`📋 OAuth metadata: http://localhost:${PORT}/.well-known/oauth-protected-resource`)
})
```

### Step 6: Update RBAC Middleware (No Changes Needed!)

Your existing RBAC middleware in `src/middleware/rbac.middleware.ts` **should work as-is** because we're mapping Scalekit roles to your existing role structure in the auth middleware. The `req.user.roles` and `req.user.scopes` are populated the same way.

### Step 7: Update MCP Tools (Scope Validation)

Your MCP tools can continue using scope-based authorization. The scopes are now validated via Scalekit tokens:

```typescript
// Example: src/mcp/tools/submit-expense.tool.ts
import { z } from 'zod'
import { McpScopes } from '@/config/constants.js'
import { AuthenticatedRequest } from '@/middleware/auth.middleware.js'

// MCP tool definition remains the same
// Scope validation happens in middleware via requireScopes()

export const submitExpenseTool = {
  name: 'submit_expense',
  description: 'Submit a new expense for approval',
  inputSchema: z.object({
    amount: z.number().positive(),
    category: z.string(),
    description: z.string()
  }),
  handler: async (input: any, req: AuthenticatedRequest) => {
    // requireScopes middleware already validated expense:submit scope
    // Your existing logic works unchanged
    
    const result = await expenseService.submitExpense({
      userId: req.user!.userId,
      ...input
    })
    
    return { content: [{ type: 'text', text: JSON.stringify(result) }] }
  }
}
```

---

## Summary of Changes

### ✅ **What Stays the Same:**
- Your RBAC role structure (`employee`, `manager`, `finance_admin`)
- Your OAuth 2.1 scopes system
- Your `requireRoles()` and `requireScopes()` middleware logic
- Your database schema and business logic
- Your MCP tool definitions

### 🔄 **What Changes:**
- Replace Descope SDK with Scalekit SDK
- Update token validation logic to use `scalekitClient.validateToken()`
- Add `.well-known/oauth-protected-resource` endpoint
- Update environment variables
- Map Scalekit roles to your application roles in auth middleware

### 📋 **Migration Checklist:**
1. ✅ Create Scalekit account and get API credentials
2. ✅ Register MCP server in Scalekit dashboard
3. ✅ Update `package.json` dependencies
4. ✅ Update `.env` with Scalekit configuration
5. ✅ Replace Descope client with Scalekit client
6. ✅ Update auth middleware to use Scalekit validation
7. ✅ Add OAuth discovery endpoint
8. ✅ Test with MCP Inspector: `npx @modelcontextprotocol/inspector@latest`
9. ✅ Verify all scopes and roles work as expected

Would you like me to help you with any specific part of this migration, such as testing the integration or handling edge cases?