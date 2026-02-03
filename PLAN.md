# Comprehensive Implementation Plan: Expense Management MCP Server

## 1. Database Design

### **Schema Design (SQL)**

```sql
-- Users table (synced from Descope or stored locally)
CREATE TABLE users (
    user_id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- 'employee', 'manager', 'finance_admin'
    department VARCHAR(100),
    manager_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES users(user_id)
);

-- Expense categories
CREATE TABLE expense_categories (
    category_id INT PRIMARY KEY AUTO_INCREMENT,
    category_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    requires_receipt BOOLEAN DEFAULT FALSE,
    max_amount DECIMAL(10, 2), -- NULL means no limit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Expenses
CREATE TABLE expenses (
    expense_id VARCHAR(36) PRIMARY KEY, -- UUID
    submitter_id VARCHAR(255) NOT NULL,
    category_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    description TEXT NOT NULL,
    expense_date DATE NOT NULL,
    receipt_url VARCHAR(500),
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'paid'
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (submitter_id) REFERENCES users(user_id),
    FOREIGN KEY (category_id) REFERENCES expense_categories(category_id),
    INDEX idx_submitter_status (submitter_id, status),
    INDEX idx_status_date (status, expense_date),
    INDEX idx_expense_date (expense_date)
);

-- Approval workflow
CREATE TABLE expense_approvals (
    approval_id INT PRIMARY KEY AUTO_INCREMENT,
    expense_id VARCHAR(36) NOT NULL,
    approver_id VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'approved', 'rejected'
    notes TEXT,
    approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (expense_id) REFERENCES expenses(expense_id) ON DELETE CASCADE,
    FOREIGN KEY (approver_id) REFERENCES users(user_id),
    INDEX idx_expense (expense_id),
    INDEX idx_approver (approver_id)
);

-- Audit log for tracking all actions
CREATE TABLE audit_log (
    log_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL, -- 'expense', 'approval', 'report'
    resource_id VARCHAR(255),
    details JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    INDEX idx_user_action (user_id, action),
    INDEX idx_timestamp (timestamp)
);
```

### **Database Indexes Strategy:**
- **Performance indexes**: On frequently queried columns (submitter_id, status, expense_date)
- **Composite indexes**: For common query patterns (submitter + status)
- **Foreign key indexes**: Automatic referential integrity

### **Sample Data Seeds:**

```sql
-- Categories
INSERT INTO expense_categories (category_name, description, requires_receipt, max_amount) VALUES
('Meals', 'Business meals and client entertainment', TRUE, 100.00),
('Travel', 'Transportation and accommodation', TRUE, 5000.00),
('Office Supplies', 'Stationery, equipment, etc.', FALSE, 500.00),
('Software', 'Software subscriptions and licenses', FALSE, 1000.00),
('Training', 'Courses, conferences, certifications', TRUE, 3000.00);
```

---

## 2. API Design

### **Base URL Structure:**
```
https://api.yourcompany.com/v1/expenses
```

### **Authentication:**
All endpoints require:
```
Authorization: Bearer <descope_access_token>
```

### **API Endpoints Specification:**

#### **2.1 Submit Expense**
```
POST /expenses
```

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "category_id": 1,
  "amount": 45.50,
  "currency": "USD",
  "description": "Team lunch with client",
  "expense_date": "2026-02-01",
  "receipt_url": "https://storage.example.com/receipts/abc123.pdf"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "expense_id": "550e8400-e29b-41d4-a716-446655440000",
    "submitter_id": "user_alice",
    "category": "Meals",
    "amount": 45.50,
    "currency": "USD",
    "description": "Team lunch with client",
    "expense_date": "2026-02-01",
    "receipt_url": "https://storage.example.com/receipts/abc123.pdf",
    "status": "pending",
    "submitted_at": "2026-02-03T10:30:00Z"
  }
}
```

**Required Scope:** `expense:submit`  
**RBAC Check:** Any authenticated user

---

#### **2.2 List Own Expenses**
```
GET /expenses/me
```

**Query Parameters:**
```
?status=pending,approved      # Filter by status (comma-separated)
&from_date=2026-01-01         # Start date
&to_date=2026-02-03           # End date
&category_id=1,2              # Filter by category
&page=1                       # Pagination
&limit=20                     # Items per page
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "expenses": [
      {
        "expense_id": "550e8400-e29b-41d4-a716-446655440000",
        "category": "Meals",
        "amount": 45.50,
        "currency": "USD",
        "description": "Team lunch with client",
        "expense_date": "2026-02-01",
        "receipt_url": "https://storage.example.com/receipts/abc123.pdf",
        "status": "pending",
        "submitted_at": "2026-02-03T10:30:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 3,
      "total_items": 45,
      "items_per_page": 20
    },
    "summary": {
      "total_amount": 1250.75,
      "pending_amount": 345.50,
      "approved_amount": 905.25
    }
  }
}
```

**Required Scope:** `expense:view:own`  
**RBAC Check:** User can only see their own expenses

---

#### **2.3 List Team Expenses**
```
GET /expenses/team/{team_id}
```

**Path Parameters:**
- `team_id`: Department or team identifier (optional, defaults to user's team)

**Query Parameters:** Same as List Own Expenses

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "team_name": "Engineering",
    "expenses": [
      {
        "expense_id": "660e8400-e29b-41d4-a716-446655440001",
        "submitter": {
          "user_id": "user_bob",
          "full_name": "Bob Smith",
          "email": "bob@company.com"
        },
        "category": "Software",
        "amount": 299.00,
        "currency": "USD",
        "description": "Annual IDE license",
        "expense_date": "2026-01-15",
        "status": "pending",
        "submitted_at": "2026-01-16T09:00:00Z"
      }
    ],
    "pagination": { ... },
    "summary": { ... }
  }
}
```

**Required Scope:** `expense:view:team`  
**RBAC Check:** User must be a Manager or Finance Admin

---

#### **2.4 List All Expenses (Company-wide)**
```
GET /expenses/all
```

**Query Parameters:** Same as above, plus:
```
?department=Engineering,Sales  # Filter by department
&submitter_id=user_alice      # Filter by specific user
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "expenses": [ ... ],
    "pagination": { ... },
    "summary": {
      "total_amount": 125000.50,
      "pending_amount": 34500.75,
      "approved_amount": 90499.75,
      "by_department": {
        "Engineering": 45000.00,
        "Sales": 60000.50,
        "Marketing": 20000.00
      }
    }
  }
}
```

**Required Scope:** `expense:view:all`  
**RBAC Check:** User must be Finance Admin

---

#### **2.5 Get Expense Details**
```
GET /expenses/{expense_id}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "expense_id": "550e8400-e29b-41d4-a716-446655440000",
    "submitter": {
      "user_id": "user_alice",
      "full_name": "Alice Johnson",
      "email": "alice@company.com",
      "department": "Sales"
    },
    "category": "Meals",
    "amount": 45.50,
    "currency": "USD",
    "description": "Team lunch with client",
    "expense_date": "2026-02-01",
    "receipt_url": "https://storage.example.com/receipts/abc123.pdf",
    "status": "approved",
    "submitted_at": "2026-02-03T10:30:00Z",
    "updated_at": "2026-02-03T14:22:00Z",
    "approval_history": [
      {
        "approver": {
          "user_id": "user_manager",
          "full_name": "Manager Mike",
          "email": "mike@company.com"
        },
        "action": "approved",
        "notes": "Looks good",
        "approved_at": "2026-02-03T14:22:00Z"
      }
    ]
  }
}
```

**Required Scope:** `expense:view:own` (if own) OR `expense:view:team` (if team) OR `expense:view:all` (if finance)  
**RBAC Check:** Based on relationship to expense

---

#### **2.6 Approve Expense**
```
POST /expenses/{expense_id}/approve
```

**Request Body:**
```json
{
  "notes": "Approved - valid business expense"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "expense_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "approved",
    "approver": {
      "user_id": "user_manager",
      "full_name": "Manager Mike"
    },
    "notes": "Approved - valid business expense",
    "approved_at": "2026-02-03T14:22:00Z"
  }
}
```

**Required Scope:** `expense:approve`  
**RBAC Check:** User must be Manager or Finance Admin

---

#### **2.7 Reject Expense**
```
POST /expenses/{expense_id}/reject
```

**Request Body:**
```json
{
  "reason": "Missing receipt attachment"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "expense_id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "rejected",
    "approver": {
      "user_id": "user_manager",
      "full_name": "Manager Mike"
    },
    "reason": "Missing receipt attachment",
    "rejected_at": "2026-02-03T14:25:00Z"
  }
}
```

**Required Scope:** `expense:approve`  
**RBAC Check:** User must be Manager or Finance Admin

---

#### **2.8 Generate Expense Report**
```
POST /expenses/reports/generate
```

**Request Body:**
```json
{
  "report_type": "summary",  // 'summary', 'detailed', 'by_category'
  "from_date": "2026-01-01",
  "to_date": "2026-01-31",
  "department": "Engineering",  // Optional
  "status": "approved",  // Optional: filter by status
  "format": "json"  // 'json', 'csv', 'pdf'
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "report_id": "report_20260203_142500",
    "report_type": "summary",
    "period": {
      "from_date": "2026-01-01",
      "to_date": "2026-01-31"
    },
    "filters": {
      "department": "Engineering",
      "status": "approved"
    },
    "summary": {
      "total_expenses": 42,
      "total_amount": 12450.75,
      "currency": "USD",
      "by_category": {
        "Meals": 1250.50,
        "Travel": 8500.00,
        "Software": 2700.25
      },
      "by_status": {
        "approved": 12450.75
      }
    },
    "expenses": [ ... ],  // Detailed list if report_type is 'detailed'
    "generated_at": "2026-02-03T14:25:00Z",
    "generated_by": {
      "user_id": "user_finance",
      "full_name": "Carol Finance"
    }
  }
}
```

**Required Scope:** `expense:report:generate`  
**RBAC Check:** User must be Finance Admin

---

### **Error Response Format:**

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "You do not have permission to access this resource",
    "details": {
      "required_scope": "expense:view:team",
      "user_scopes": ["expense:view:own", "expense:submit"]
    }
  }
}
```

**Common Error Codes:**
- `UNAUTHORIZED` (401): Invalid or missing token
- `INSUFFICIENT_PERMISSIONS` (403): Missing required scope
- `RESOURCE_NOT_FOUND` (404): Expense doesn't exist
- `VALIDATION_ERROR` (400): Invalid request data
- `CONFLICT` (409): Cannot approve already-approved expense
- `INTERNAL_ERROR` (500): Server error

---

## 3. MCP Tools Architecture

### **3.1 MCP Server Overview**

```
MCP Server (Your Implementation)
├── Token Validation Layer
│   ├── Validate Descope JWT signature
│   ├── Verify audience (aud) claim
│   └── Extract scopes and user claims
├── Authorization Layer
│   ├── Check required scope for tool
│   ├── Enforce RBAC rules
│   └── Log access attempts
├── Tool Implementation Layer
│   ├── 6 MCP tools (defined below)
│   └── Backend API client
└── Error Handling
    ├── Transform API errors to MCP format
    └── Return user-friendly messages
```

---

### **3.2 MCP Tools Specification**

#### **Tool 1: submit_expense**

```json
{
  "name": "submit_expense",
  "description": "Submit a new expense for approval. Employees can submit expenses for reimbursement with receipt attachments.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "category": {
        "type": "string",
        "description": "Expense category",
        "enum": ["Meals", "Travel", "Office Supplies", "Software", "Training"]
      },
      "amount": {
        "type": "number",
        "description": "Expense amount in USD",
        "minimum": 0.01
      },
      "description": {
        "type": "string",
        "description": "Detailed description of the expense",
        "minLength": 10
      },
      "expense_date": {
        "type": "string",
        "format": "date",
        "description": "Date when expense occurred (YYYY-MM-DD)"
      },
      "receipt_url": {
        "type": "string",
        "format": "uri",
        "description": "URL to receipt image or PDF (optional for small amounts)"
      }
    },
    "required": ["category", "amount", "description", "expense_date"]
  }
}
```

**Required Scope:** `expense:submit`  
**RBAC Logic:**
```
1. Extract user_id from token
2. Verify scope contains 'expense:submit'
3. Call API: POST /expenses with user_id as submitter
4. Return formatted response
```

---

#### **Tool 2: list_my_expenses**

```json
{
  "name": "list_my_expenses",
  "description": "View your own submitted expenses with optional filters for status and date range.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "status": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": ["pending", "approved", "rejected", "paid"]
        },
        "description": "Filter by expense status (optional)"
      },
      "from_date": {
        "type": "string",
        "format": "date",
        "description": "Start date for filtering (YYYY-MM-DD)"
      },
      "to_date": {
        "type": "string",
        "format": "date",
        "description": "End date for filtering (YYYY-MM-DD)"
      },
      "limit": {
        "type": "integer",
        "minimum": 1,
        "maximum": 100,
        "default": 20,
        "description": "Number of results to return"
      }
    }
  }
}
```

**Required Scope:** `expense:view:own`  
**RBAC Logic:**
```
1. Extract user_id from token
2. Verify scope contains 'expense:view:own'
3. Call API: GET /expenses/me?{filters}
4. Format and return results
```

---

#### **Tool 3: list_team_expenses**

```json
{
  "name": "list_team_expenses",
  "description": "View expenses submitted by your team members. Only available to managers and finance admins.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "team_id": {
        "type": "string",
        "description": "Team/department ID (optional, defaults to your team)"
      },
      "status": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": ["pending", "approved", "rejected", "paid"]
        },
        "description": "Filter by expense status"
      },
      "from_date": {
        "type": "string",
        "format": "date",
        "description": "Start date for filtering"
      },
      "to_date": {
        "type": "string",
        "format": "date",
        "description": "End date for filtering"
      }
    }
  }
}
```

**Required Scope:** `expense:view:team`  
**RBAC Logic:**
```
1. Extract user_id and role from token
2. Verify scope contains 'expense:view:team'
3. Verify role is 'manager' or 'finance_admin'
4. If team_id not provided, default to user's team from token
5. Call API: GET /expenses/team/{team_id}?{filters}
6. Return results
```

---

#### **Tool 4: approve_expense**

```json
{
  "name": "approve_expense",
  "description": "Approve a pending expense. Only managers and finance admins can approve expenses from their team or company.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "expense_id": {
        "type": "string",
        "description": "Unique identifier of the expense to approve"
      },
      "notes": {
        "type": "string",
        "description": "Optional notes about the approval",
        "maxLength": 500
      }
    },
    "required": ["expense_id"]
  }
}
```

**Required Scope:** `expense:approve`  
**RBAC Logic:**
```
1. Extract user_id and role from token
2. Verify scope contains 'expense:approve'
3. Verify role is 'manager' or 'finance_admin'
4. Call API: GET /expenses/{expense_id} to check ownership
5. If user is 'manager': verify submitter is in user's team
6. If user is 'finance_admin': allow all
7. Call API: POST /expenses/{expense_id}/approve
8. Return result
```

---

#### **Tool 5: reject_expense**

```json
{
  "name": "reject_expense",
  "description": "Reject a pending expense with a reason. Only managers and finance admins can reject expenses.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "expense_id": {
        "type": "string",
        "description": "Unique identifier of the expense to reject"
      },
      "reason": {
        "type": "string",
        "description": "Reason for rejection (required)",
        "minLength": 10
      }
    },
    "required": ["expense_id", "reason"]
  }
}
```

**Required Scope:** `expense:approve`  
**RBAC Logic:** Same as approve_expense

---

#### **Tool 6: generate_expense_report**

```json
{
  "name": "generate_expense_report",
  "description": "Generate comprehensive expense reports with summaries and analytics. Only available to finance admins.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "report_type": {
        "type": "string",
        "enum": ["summary", "detailed", "by_category"],
        "default": "summary",
        "description": "Type of report to generate"
      },
      "from_date": {
        "type": "string",
        "format": "date",
        "description": "Report start date (YYYY-MM-DD)"
      },
      "to_date": {
        "type": "string",
        "format": "date",
        "description": "Report end date (YYYY-MM-DD)"
      },
      "department": {
        "type": "string",
        "description": "Filter by specific department (optional)"
      },
      "status": {
        "type": "string",
        "enum": ["pending", "approved", "rejected", "paid"],
        "description": "Filter by expense status (optional)"
      }
    },
    "required": ["from_date", "to_date"]
  }
}
```

**Required Scope:** `expense:report:generate`  
**RBAC Logic:**
```
1. Extract user_id and role from token
2. Verify scope contains 'expense:report:generate'
3. Verify role is 'finance_admin'
4. Call API: POST /expenses/reports/generate
5. Return formatted report
```

---

## 4. Authentication & Authorization Flow

### **4.1 Complete Flow Diagram**

```
┌─────────────┐          ┌──────────────┐          ┌──────────────┐          ┌─────────────┐
│   AI Agent  │          │  MCP Client  │          │  MCP Server  │          │  Backend    │
│  (Claude)   │          │  (Inspector) │          │   (You)      │          │     API     │
└─────┬───────┘          └──────┬───────┘          └──────┬───────┘          └──────┬──────┘
      │                         │                         │                         │
      │  1. User: "Submit      │                         │                         │
      │     lunch expense"      │                         │                         │
      ├────────────────────────>│                         │                         │
      │                         │                         │                         │
      │                         │  2. Discover OAuth      │                         │
      │                         │     (if not cached)     │                         │
      │                         ├────────────────────────>│                         │
      │                         │  3. 401 + WWW-Auth     │                         │
      │                         │     header              │                         │
      │                         │<────────────────────────┤                         │
      │                         │                         │                         │
      │                         │  4. Fetch .well-known  │                         │
      │                         │     from Descope        │                         │
      │                         ├─────────────────────────┼────> Descope           │
      │                         │<─────────────────────────────── (OAuth metadata)  │
      │                         │                         │                         │
      │                         │  5. DCR (first time)   │                         │
      │                         ├─────────────────────────┼────> Descope           │
      │                         │  6. client_id + secret │                         │
      │                         │<─────────────────────────────── (Registration)   │
      │                         │                         │                         │
      │                         │  7. Redirect user to   │                         │
      │                         │     Descope auth flow   │                         │
      │                         ├─────────────────────────┼────> Descope           │
      │                         │                         │      (User Consent Flow)│
      │  8. User authenticates  │                         │                         │
      │      & approves scopes  │                         │                         │
      │     in Descope UI       │                         │                         │
      │                         │  9. Auth code          │                         │
      │                         │<─────────────────────────────── (redirect)       │
      │                         │                         │                         │
      │                         │  10. Exchange code     │                         │
      │                         │      for token          │                         │
      │                         ├─────────────────────────┼────> Descope           │
      │                         │  11. Access token      │                         │
      │                         │<────────────────────────┤       (with scopes)    │
      │                         │                         │                         │
      │                         │  12. Call tool:        │                         │
      │                         │      submit_expense     │                         │
      │                         │      + Bearer token     │                         │
      │                         ├────────────────────────>│                         │
      │                         │                         │                         │
      │                         │                         │  13. Validate token    │
      │                         │                         │      (JWKS from        │
      │                         │                         │       Descope)          │
      │                         │                         │                         │
      │                         │                         │  14. Check scope:      │
      │                         │                         │      'expense:submit'  │
      │                         │                         │                         │
      │                         │                         │  15. Extract user_id   │
      │                         │                         │      from token         │
      │                         │                         │                         │
      │                         │                         │  16. POST /expenses    │
      │                         │                         │      + user context     │
      │                         │                         ├────────────────────────>│
      │                         │                         │                         │
      │                         │                         │                         │  17. Validate
      │                         │                         │                         │      user exists
      │                         │                         │                         │
      │                         │                         │                         │  18. Create
      │                         │                         │                         │      expense in DB
      │                         │                         │                         │
      │                         │                         │  19. Expense created   │
      │                         │                         │<────────────────────────┤
      │                         │                         │                         │
      │                         │  20. Tool response     │                         │
      │                         │<────────────────────────┤                         │
      │                         │                         │                         │
      │  21. "Your expense     │                         │                         │
      │      has been          │                         │                         │
      │      submitted!"        │                         │                         │
      │<────────────────────────┤                         │                         │
      │                         │                         │                         │
```

---

### **4.2 Token Validation Logic (MCP Server)**

```
FUNCTION validate_token(bearer_token):
    // Step 1: Extract token from Authorization header
    IF NOT bearer_token.startsWith("Bearer "):
        RETURN error(401, "Invalid Authorization header format")
    
    token = bearer_token.substring(7)
    
    // Step 2: Decode JWT header to get 'kid' (key ID)
    header = jwt_decode_header(token)
    kid = header['kid']
    
    // Step 3: Fetch public keys from Descope JWKS endpoint
    jwks_url = "https://api.descope.com/{PROJECT_ID}/.well-known/jwks.json"
    jwks = http_get(jwks_url)
    public_key = jwks.find_key(kid)
    
    IF NOT public_key:
        RETURN error(401, "Unknown signing key")
    
    // Step 4: Verify signature and decode payload
    TRY:
        payload = jwt_verify_and_decode(token, public_key)
    CATCH signature_error:
        RETURN error(401, "Invalid token signature")
    
    // Step 5: Validate standard claims
    current_time = unix_timestamp_now()
    
    IF payload['exp'] < current_time:
        RETURN error(401, "Token expired")
    
    IF payload['iat'] > current_time:
        RETURN error(401, "Token used before issued")
    
    // Step 6: Validate audience claim
    expected_audience = "https://your-mcp-server.com/mcp"
    IF payload['aud'] != expected_audience:
        RETURN error(401, "Invalid audience - token not for this server")
    
    // Step 7: Validate issuer
    expected_issuer = "https://api.descope.com/v1/apps/agentic/{PROJECT_ID}/{MCP_SERVER_ID}"
    IF payload['iss'] != expected_issuer:
        RETURN error(401, "Invalid issuer")
    
    // Step 8: Extract user and scope information
    user_context = {
        'user_id': payload['sub'],
        'email': payload['email'],
        'name': payload['name'],
        'roles': payload['roles'] OR [],
        'scopes': payload['scope'].split(' '),  // Space-separated scopes
        'tenant_id': payload['tenant_id'] OR null
    }
    
    RETURN success(user_context)
END FUNCTION
```

---

### **4.3 Scope Validation Logic**

```
FUNCTION check_scope(user_context, required_scope):
    user_scopes = user_context['scopes']
    
    IF required_scope NOT IN user_scopes:
        RETURN error(403, {
            'code': 'INSUFFICIENT_PERMISSIONS',
            'message': 'Missing required scope',
            'required_scope': required_scope,
            'user_scopes': user_scopes
        })
    
    RETURN success()
END FUNCTION
```

---

### **4.4 RBAC Enforcement Logic**

```
FUNCTION enforce_rbac(user_context, resource_type, resource_id, action):
    user_role = user_context['roles'][0]  // Primary role
    user_id = user_context['user_id']
    
    SWITCH resource_type:
        CASE "expense":
            expense = db_get_expense(resource_id)
            
            IF action == "approve" OR action == "reject":
                // Only managers and finance can approve
                IF user_role NOT IN ['manager', 'finance_admin']:
                    RETURN error(403, "Insufficient role for approval")
                
                // Managers can only approve team expenses
                IF user_role == 'manager':
                    submitter = db_get_user(expense.submitter_id)
                    IF submitter.manager_id != user_id:
                        RETURN error(403, "Can only approve team member expenses")
                
                RETURN success()
            
            IF action == "view":
                // Check scope determines visibility
                scopes = user_context['scopes']
                
                IF 'expense:view:all' IN scopes:
                    RETURN success()  // Finance admin sees all
                
                IF 'expense:view:team' IN scopes:
                    submitter = db_get_user(expense.submitter_id)
                    IF submitter.manager_id == user_id OR user_role == 'finance_admin':
                        RETURN success()
                    RETURN error(403, "Not your team member")
                
                IF 'expense:view:own' IN scopes:
                    IF expense.submitter_id == user_id:
                        RETURN success()
                    RETURN error(403, "Not your expense")
        
        CASE "report":
            IF user_role != 'finance_admin':
                RETURN error(403, "Only finance admins can generate reports")
            RETURN success()
    
    RETURN error(403, "Unknown resource type")
END FUNCTION
```

---

## 5. Integration Architecture

### **5.1 Component Interaction Map**

```
┌───────────────────────────────────────────────────────────────────────┐
│                         DESCOPE (Authorization Server)                │
│                                                                       │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │  User Consent   │  │   Client Reg     │  │   Token Issuer   │   │
│  │      Flow       │  │  (DCR Endpoint)  │  │   & Validator    │   │
│  └─────────────────┘  └──────────────────┘  └──────────────────┘   │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  MCP Server Configuration:                                   │   │
│  │  - Scopes: expense:submit, expense:view:own, etc.          │   │
│  │  - Issuer URL: https://api.descope.com/v1/apps/...         │   │
│  │  - JWKS URI: https://api.descope.com/{project}/.well-known │   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬──────────────────────────────────────┘
                                 │ OAuth 2.1 Flow
                                 │ (Discovery, Auth, Token)
                                 │
        ┌────────────────────────┴──────────────────────────┐
        │                                                    │
        v                                                    v
┌────────────────┐                                  ┌────────────────┐
│   MCP Client   │                                  │   AI Agent     │
│  (Inspector)   │                                  │   (Claude)     │
└────────┬───────┘                                  └────────┬───────┘
         │                                                   │
         │ MCP Protocol (with Bearer token)                 │
         │                                                   │
         └─────────────────────┬──────────────────────────┘
                               │
                               v
        ┌────────────────────────────────────────────┐
        │          MCP SERVER (Your Code)            │
        │                                            │
        │  ┌──────────────────────────────────┐    │
        │  │  Token Validation Layer          │    │
        │  │  - Verify JWT signature (JWKS)   │    │
        │  │  - Check aud, iss, exp claims    │    │
        │  │  - Extract user_id & scopes      │    │
        │  └─────────────┬────────────────────┘    │
        │                │                          │
        │  ┌─────────────v────────────────────┐    │
        │  │  Authorization Layer             │    │
        │  │  - Scope validation              │    │
        │  │  - RBAC enforcement              │    │
        │  │  - Audit logging                 │    │
        │  └─────────────┬────────────────────┘    │
        │                │                          │
        │  ┌─────────────v────────────────────┐    │
        │  │  MCP Tools (6 tools)             │    │
        │  │  - submit_expense                │    │
        │  │  - list_my_expenses              │    │
        │  │  - list_team_expenses            │    │
        │  │  - approve_expense               │    │
        │  │  - reject_expense                │    │
        │  │  - generate_expense_report       │    │
        │  └─────────────┬────────────────────┘    │
        │                │                          │
        │  ┌─────────────v────────────────────┐    │
        │  │  Backend API Client              │    │
        │  │  - HTTP client to Backend API    │    │
        │  │  - Request/response mapping      │    │
        │  └─────────────┬────────────────────┘    │
        └────────────────┼────────────────────────┘
                         │ HTTP/REST
                         │
                         v
        ┌─────────────────────────────────────────┐
        │       BACKEND API (Your Code)            │
        │                                          │
        │  ┌────────────────────────────────┐     │
        │  │  REST API Endpoints             │     │
        │  │  - POST /expenses               │     │
        │  │  - GET /expenses/me             │     │
        │  │  - GET /expenses/team/{id}      │     │
        │  │  - POST /expenses/{id}/approve  │     │
        │  │  - etc.                         │     │
        │  └────────────┬───────────────────┘     │
        │               │                          │
        │  ┌────────────v───────────────────┐     │
        │  │  Business Logic Layer           │     │
        │  │  - Expense validation           │     │
        │  │  - Approval workflow            │     │
        │  │  - Report generation            │     │
        │  └────────────┬───────────────────┘     │
        │               │                          │
        │  ┌────────────v───────────────────┐     │
        │  │  Data Access Layer              │     │
        │  │  - CRUD operations               │     │
        │  │  - Query builders               │     │
        │  │  - Transaction management       │     │
        │  └────────────┬───────────────────┘     │
        └───────────────┼──────────────────────────┘
                        │ SQL
                        │
                        v
        ┌────────────────────────────────────────┐
        │          SQL DATABASE                   │
        │  - users                                │
        │  - expenses                             │
        │  - expense_categories                   │
        │  - expense_approvals                    │
        │  - audit_log                            │
        └────────────────────────────────────────┘
```

---

### **5.2 Configuration Files**

#### **Descope MCP Server Configuration (via Console)**

```yaml
mcp_server:
  name: "Company Expense Management"
  description: "OAuth-protected MCP server for expense submission and approval"
  mcp_server_url: "https://your-mcp-server.com/mcp"
  
  client_registration:
    dcr_enabled: true
    cimd_enabled: false  # Can enable later
  
  scopes:
    - name: "expense:submit"
      description: "Submit expense reports for reimbursement"
      mandatory: false
      connection_scopes: []  # No third-party OAuth needed
    
    - name: "expense:view:own"
      description: "View your own submitted expenses"
      mandatory: false
      connection_scopes: []
    
    - name: "expense:view:team"
      description: "View expenses submitted by your team members"
      mandatory: false
      connection_scopes: []
    
    - name: "expense:approve"
      description: "Approve or reject expense reports"
      mandatory: false
      connection_scopes: []
    
    - name: "expense:view:all"
      description: "View all company expenses across all departments"
      mandatory: false
      connection_scopes: []
    
    - name: "expense:report:generate"
      description: "Generate detailed expense reports and analytics"
      mandatory: false
      connection_scopes: []
  
  flows:
    user_consent_flow: "expense-consent-flow"  # Create in Descope Flows
    client_registration_flow: "client-verification-flow"  # Create in Descope Flows
```

---

#### **MCP Server OAuth Protected Metadata**
*Host this at: `https://your-mcp-server.com/.well-known/oauth-protected-metadata`*

```json
{
  "authorization_servers": [
    "https://api.descope.com/v1/apps/agentic/{YOUR_PROJECT_ID}/{YOUR_MCP_SERVER_ID}"
  ],
  "bearer_methods_supported": ["header"],
  "resource": "https://your-mcp-server.com/mcp",
  "resource_documentation": "https://your-mcp-server.com/docs",
  "scopes_supported": [
    "expense:submit",
    "expense:view:own",
    "expense:view:team",
    "expense:approve",
    "expense:view:all",
    "expense:report:generate"
  ]
}
```

---

## 6. Testing Scenarios

### **Scenario 1: Employee Submits Expense**
```
User: Alice (Employee)
Token Scopes: expense:submit, expense:view:own
Action: Submit lunch expense

Expected Flow:
1. Alice authenticates via Descope
2. Approves scopes: expense:submit
3. AI calls submit_expense tool
4. MCP validates token, checks 'expense:submit' scope
5. MCP calls Backend API POST /expenses
6. Backend creates expense with Alice as submitter
7. ✅ Success: Expense created

Validation Points:
- Token has valid signature
- Scope 'expense:submit' present
- user_id extracted correctly
- Expense stored in DB with correct submitter_id
```

---

### **Scenario 2: Manager Approves Team Expense**
```
User: Bob (Manager)
Token Scopes: expense:view:team, expense:approve
Action: Approve Alice's expense

Expected Flow:
1. Bob authenticates and gets token
2. AI calls approve_expense(expense_id="alice_expense_123")
3. MCP validates token, checks 'expense:approve' scope
4. MCP calls Backend API GET /expenses/alice_expense_123
5. Backend verifies Alice is Bob's team member
6. MCP calls Backend API POST /expenses/alice_expense_123/approve
7. ✅ Success: Expense approved

Validation Points:
- Token has 'expense:approve' scope
- Bob's role is 'manager'
- Alice reports to Bob (manager_id check)
- Approval recorded in expense_approvals table
```

---

### **Scenario 3: Employee Tries to Approve (Should Fail)**
```
User: Alice (Employee)
Token Scopes: expense:submit, expense:view:own
Action: Approve Bob's expense

Expected Flow:
1. Alice tries to call approve_expense(expense_id="bob_expense_456")
2. MCP validates token
3. MCP checks scope: 'expense:approve' NOT FOUND
4. ❌ Error: 403 INSUFFICIENT_PERMISSIONS

Validation Points:
- Token validation succeeds
- Scope check fails
- No API call made to Backend
- User-friendly error returned
```

---

### **Scenario 4: Finance Admin Generates Report**
```
User: Carol (Finance Admin)
Token Scopes: expense:view:all, expense:report:generate
Action: Generate Q4 expense report

Expected Flow:
1. Carol authenticates with all scopes
2. AI calls generate_expense_report(from_date="2026-10-01", to_date="2026-12-31")
3. MCP validates token, checks 'expense:report:generate' scope
4. MCP verifies Carol's role is 'finance_admin'
5. MCP calls Backend API POST /expenses/reports/generate
6. Backend aggregates all expenses for Q4
7. ✅ Success: Report generated with company-wide data

Validation Points:
- Token has 'expense:report:generate' scope
- Carol's role is 'finance_admin'
- Report includes all departments
- Summary calculations correct
```

---

### **Scenario 5: Manager Tries to View Other Team's Expenses (Should Fail)**
```
User: Bob (Manager of Engineering)
Token Scopes: expense:view:team, expense:approve
Action: View Sales team expenses

Expected Flow:
1. Bob calls list_team_expenses(team_id="sales")
2. MCP validates token, scope check passes
3. MCP calls Backend API GET /expenses/team/sales
4. Backend checks if Bob is manager of Sales team
5. Backend finds Bob manages Engineering, NOT Sales
6. ❌ Error: 403 FORBIDDEN - "Not authorized to view this team"

Validation Points:
- Scope check passes (has expense:view:team)
- RBAC enforcement at Backend level
- Team hierarchy respected
```

---

## 7. Implementation Checklist

### **Phase 1: Database Setup**
- [ ] Create SQL database
- [ ] Run schema creation scripts
- [ ] Insert seed data (categories, test users)
- [ ] Create database indexes
- [ ] Set up database connection pooling

### **Phase 2: Backend API Implementation**
- [ ] Implement 8 REST endpoints
- [ ] Add request validation middleware
- [ ] Implement RBAC checks in each endpoint
- [ ] Add audit logging
- [ ] Write unit tests for business logic
- [ ] Write integration tests for API endpoints

### **Phase 3: Descope Configuration**
- [ ] Create Descope project
- [ ] Create MCP Server in Descope console
- [ ] Configure scopes (6 scopes)
- [ ] Enable DCR
- [ ] Create User Consent Flow
- [ ] Create Client Registration Flow
- [ ] Add test users with different roles
- [ ] Test OAuth flow manually

### **Phase 4: MCP Server Implementation**
- [ ] Implement token validation logic
- [ ] Implement scope checking
- [ ] Implement RBAC enforcement
- [ ] Implement 6 MCP tools
- [ ] Create Backend API client
- [ ] Host OAuth Protected Metadata endpoint
- [ ] Implement error handling
- [ ] Add logging and monitoring

### **Phase 5: Testing**
- [ ] Test with MCP Inspector
- [ ] Test all 6 tools with different roles
- [ ] Test negative cases (insufficient permissions)
- [ ] Test token expiration handling
- [ ] Test RBAC enforcement
- [ ] Load testing (optional)

### **Phase 6: Documentation**
- [ ] API documentation (OpenAPI/Swagger)
- [ ] MCP tools documentation
- [ ] Setup guide for developers
- [ ] User guide for different roles
- [ ] Troubleshooting guide

---

This implementation plan is **tech stack agnostic** and can be implemented in:
- **Python** (FastAPI/Flask + SQLAlchemy)
- **Node.js** (Express + Prisma/TypeORM)
- **Go** (Gin/Echo + GORM)
- **Java** (Spring Boot + JPA)
- **.NET** (ASP.NET Core + Entity Framework)

Would you like me to proceed with implementation code for a specific tech stack, or do you need any clarification on this architecture?