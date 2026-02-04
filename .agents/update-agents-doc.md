# Instructions for Updating AGENTS.md

> **Purpose**: This file provides guidelines for AI agents on when and how to update the [AGENTS.md](../AGENTS.md) file to keep it synchronized with the codebase.

## When to Update AGENTS.md

Update AGENTS.md whenever ANY of the following changes occur:

### 1. Project Structure Changes
- **New directories** added to the workspace
- **Directories moved** or renamed
- **Directory structure** fundamentally reorganized
- **New workspaces** added (apps/* or packages/*)

**Example triggers**:
- Created `apps/expenses-server/src/api/`
- Created `apps/expenses-server/src/middleware/`
- Created `packages/shared-utils/`

### 2. Critical Module Location Changes
- **Config files** moved or reorganized
- **Entry points** changed (e.g., `index.ts` location)
- **Key modules** relocated (auth, database, MCP handlers)
- **Import paths** significantly changed

**Example triggers**:
- Moved `src/config/descope.ts` to `src/auth/descope.ts`
- Changed entry point from `src/index.ts` to `src/server.ts`
- Reorganized middleware from flat structure to subdirectories

### 3. Technology Stack Updates
- **New dependencies** added to core stack
- **Major version upgrades** of existing dependencies
- **Framework changes** (switching Express to Fastify)
- **Runtime changes** (Node to Bun to Deno)
- **Database changes** (SQLite to PostgreSQL)

**Example triggers**:
- Added `@modelcontextprotocol/sdk` package
- Upgraded Express from 4.x to 5.x
- Added Prisma ORM
- Switched from better-sqlite3 to Drizzle

### 4. New Patterns or Conventions
- **New coding patterns** established
- **API design patterns** changed
- **Error handling** approach modified
- **Authentication/Authorization** patterns updated
- **File naming conventions** changed

**Example triggers**:
- Established new middleware pattern
- Changed from class-based to functional approach
- New error handling with custom error classes
- Updated authentication from JWT to OAuth2

### 5. Workspace Scripts Changes
- **New scripts** added to package.json
- **Script commands** modified
- **Build process** changed
- **Development workflow** updated

**Example triggers**:
- Added `db:migrate` script
- Changed from `npm` to `bun` commands
- Added new Turbo tasks

### 6. Development Environment Changes
- **Required tools** updated (Node version, package manager)
- **IDE configurations** changed
- **Environment variables** added/removed
- **Docker setup** added or modified

**Example triggers**:
- Minimum Node version changed from 18 to 20
- Added Docker Compose setup
- New required environment variables

### 7. Phase Progression
- **Moving to next phase** of development
- **Completing major milestones**
- **Architecture decisions** finalized

**Example triggers**:
- Completed Phase 1, moving to Phase 2
- Database layer fully implemented
- MCP tools now available

## What to Update in AGENTS.md

### Section-by-Section Guide

#### **Technology Stack** (Lines 15-39)
Update when:
- Adding new dependencies
- Upgrading major versions
- Changing core technologies

**Update approach**:
```markdown
### Backend Stack
- **Framework**: Express 5.2.1 → Express 5.3.0
+ **ORM**: Drizzle 0.30.0
```

#### **Workspace Structure** (Lines 42-107)
Update when:
- New directories created
- Module organization changes
- File structure reorganized

**Update approach**:
```markdown
**Directory Structure**:
```
apps/expenses-server/
├── src/
│   ├── api/          # REST API routes
+│   │   ├── expenses/  # Expense endpoints
+│   │   ├── reports/   # Report endpoints
+│   │   └── users/     # User endpoints
│   ├── config/       # Configuration
+│   │   ├── descope.ts  # Descope auth config
+│   │   └── index.ts    # Main config
```
```

#### **Critical Rules** (Lines 162-302)
Update when:
- New development rules established
- Package installation procedures change
- Code patterns standardized
- Breaking conventions introduced

**Update approach**:
Add new rules or update existing ones with clear examples.

#### **Code Patterns & Best Practices** (Lines 375-444)
Update when:
- New patterns established
- API design updated
- Middleware patterns change
- Database query patterns change

**Update approach**:
Add code examples showing the new patterns.

#### **Common Tasks** (Lines 460-491)
Update when:
- New common developer tasks emerge
- Workflow changes
- New scripts available

**Update approach**:
Add step-by-step instructions for new tasks.

#### **Project Phases** (Lines 534-560)
Update when:
- Phase completed
- Moving to next phase
- Phase scope changes

**Update approach**:
```markdown
### Phase 1: ✅ Completed → Phase 1: ✅ Completed
### Phase 2: 📋 Planned → Phase 2: 🚧 In Progress
```

#### **Important URLs & Endpoints** (Lines 563-575)
Update when:
- New endpoints added
- Endpoint paths change
- New services added

**Update approach**:
```markdown
### Development Server
- **Base URL**: `http://localhost:3000`
+ **Expenses API**: `GET /api/expenses`
+ **Reports API**: `POST /api/reports`
```

## Update Process

### Step 1: Identify Changes
Review the uncommitted changes:
```bash
git status
git diff
```

### Step 2: Categorize Changes
Determine which sections of AGENTS.md are affected using the guide above.

### Step 3: Update Relevant Sections
For each affected section:
1. Read the current content
2. Identify what needs to change
3. Make precise, accurate updates
4. Maintain the existing format and style

### Step 4: Verify Accuracy
- ✅ All new directories/files documented
- ✅ All new dependencies listed with versions
- ✅ Code examples are accurate and tested
- ✅ Links and paths are correct
- ✅ Phase status is current
- ✅ Scripts and commands are verified

### Step 5: Update Metadata
Update the footer:
```markdown
**Last Updated**: YYYY-MM-DD
**Current Phase**: Phase X (Description)
```

## Important Guidelines

### DO:
- ✅ Be precise and accurate with versions
- ✅ Include actual code examples that work
- ✅ Maintain consistent formatting
- ✅ Update the "Last Updated" timestamp
- ✅ Keep examples concise but complete
- ✅ Use the established emoji conventions (✅ 🚧 📋)
- ✅ Preserve the existing structure
- ✅ Cross-reference related sections

### DON'T:
- ❌ Hallucinate version numbers
- ❌ Add speculative or "nice to have" information
- ❌ Change the overall structure without good reason
- ❌ Remove historical information that's still relevant
- ❌ Add unverified code examples
- ❌ Make assumptions about future changes

## Examples of Good Updates

### Example 1: New Directory Structure
**Change**: Created `src/api/expenses/` subdirectory

**Update**:
```markdown
**Directory Structure**:
```
apps/expenses-server/
├── src/
│   ├── api/          # REST API routes
+│   │   ├── expenses/     # Expense-related endpoints
+│   │   │   ├── index.ts
+│   │   │   ├── list.ts
+│   │   │   └── submit.ts
│   │   └── index.ts
```
```

### Example 2: New Dependency
**Change**: Added Drizzle ORM

**Update** (Technology Stack section):
```markdown
### Backend Stack
- **Framework**: Express 5.2.1
+ **ORM**: Drizzle 0.30.0
- **Database**: SQLite (better-sqlite3 12.6.2)
```

**Update** (Critical Rules section):
```markdown
### Rule 9: Database Queries

Use Drizzle ORM for all database operations:

\`\`\`typescript
import { db } from '../db';
import { expenses } from '../db/schema';

// Query with Drizzle
const expense = await db.select().from(expenses).where(eq(expenses.id, id));
\`\`\`
```

### Example 3: Phase Completion
**Change**: Completed Phase 2

**Update**:
```markdown
### Phase 1: ✅ Completed
- Express server setup
- MCP wrapper integration
- Middleware (auth, RBAC, error handling)
- Type definitions
- Basic API structure

### Phase 2: ✅ Completed
- Database design
- SQLite setup
- Seed data
+ Database schema implementation
+ Query utilities
+ Migration system

### Phase 3: 🚧 In Progress
- REST API implementation
- CRUD endpoints for expenses
```

## Quick Reference Checklist

Before updating AGENTS.md, check:

- [ ] Read all uncommitted changes (`git status`, `git diff`)
- [ ] Identify new files and directories
- [ ] Note any new dependencies in package.json
- [ ] Check for new scripts in package.json
- [ ] Review changes to entry points (index.ts, etc.)
- [ ] Verify new patterns in code
- [ ] Check phase progression
- [ ] Test any code examples you add
- [ ] Update "Last Updated" date
- [ ] Ensure all paths are accurate

## Automation Hints

Future automation could:
1. Watch for changes to package.json → Auto-update Technology Stack
2. Detect new directories → Auto-update Workspace Structure
3. Parse git commits → Suggest relevant AGENTS.md updates
4. Validate code examples → Ensure they compile/run
5. Check for dead links → Update documentation links

---

**Last Updated**: 2026-02-04
**Maintained By**: AI Agents (Claude Code)
