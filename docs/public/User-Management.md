# User Management System - Unified RAG Studio

## Project Overview

This document provides comprehensive specifications for implementing a complete user management system for Unified RAG Studio, including authentication pages, user profiles, role-based access control (RBAC), and admin functionalities.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [User Roles & Permissions](#user-roles--permissions)
3. [Authentication Flow](#authentication-flow)
4. [Database Schema](#database-schema)
5. [Frontend Components](#frontend-components)
6. [Backend API Endpoints](#backend-api-endpoints)
7. [Implementation Prompts](#implementation-prompts)

---

## System Architecture

### Technology Stack
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: FastAPI (Python)
- **Database**: PostgreSQL
- **Authentication**: JWT tokens with refresh token rotation
- **State Management**: React Context API / Zustand
- **Validation**: Zod (frontend), Pydantic (backend)

### High-Level Architecture
```
┌─────────────────┐
│  Login Page     │
│  Registration   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Auth Service   │
│  (JWT)          │
└────────┬────────┘
         │
         ├─────────────┬──────────────┐
         ▼             ▼              ▼
┌──────────────┐ ┌──────────┐ ┌────────────┐
│ Normal User  │ │  Admin   │ │  Backend   │
│ Dashboard    │ │Dashboard │ │  API       │
└──────────────┘ └──────────┘ └────────────┘
```

---

## User Roles & Permissions

### 1. Normal User
**Capabilities:**
- View and edit personal profile
- View subscription plan details
- Upgrade/downgrade subscription plan
- Change password
- Enable/disable 2FA
- View usage statistics
- Manage API keys
- Access RAG studio features (based on plan)

### 2. Admin User
**Capabilities (includes all Normal User capabilities plus):**
- View all users list with filters and search
- Create/edit/delete user accounts
- Assign/modify user roles
- View user activity logs
- Manage subscription plans (create/edit/delete)
- View system analytics and metrics
- Configure system settings
- Export user data
- Send system-wide notifications
- View and manage API usage across all users

---

## Authentication Flow

### Registration Flow
1. User fills registration form (email, password, name)
2. Backend validates email uniqueness
3. Password is hashed (bcrypt)
4. User account created with default role (`user`)
5. Verification email sent (optional)
6. User redirected to login page

### Login Flow
1. User enters credentials
2. Backend validates credentials
3. Generate access token (15 min) and refresh token (7 days)
4. Store refresh token in httpOnly cookie
5. Return user data and access token
6. Redirect to appropriate dashboard

### Password Reset Flow
1. User requests password reset
2. Generate reset token (1 hour expiry)
3. Send reset link via email
4. User clicks link, enters new password
5. Validate reset token
6. Update password hash
7. Invalidate all existing sessions

---

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user', -- 'user' | 'admin'
    plan_id UUID REFERENCES subscription_plans(id),
    is_active BOOLEAN DEFAULT TRUE,
    is_email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    profile_image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

### Subscription Plans Table
```sql
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL, -- 'Free', 'Pro', 'Enterprise'
    description TEXT,
    price_monthly DECIMAL(10, 2) NOT NULL,
    price_yearly DECIMAL(10, 2) NOT NULL,
    features JSONB NOT NULL, -- {"max_documents": 100, "api_calls_limit": 1000}
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### User Subscriptions Table
```sql
CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES subscription_plans(id),
    status VARCHAR(20) NOT NULL, -- 'active', 'cancelled', 'expired'
    billing_cycle VARCHAR(20), -- 'monthly', 'yearly'
    current_period_start TIMESTAMP NOT NULL,
    current_period_end TIMESTAMP NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### API Keys Table
```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    key_name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(10) NOT NULL, -- First 8 chars for display
    last_used TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
```

### User Activity Logs Table
```sql
CREATE TABLE user_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL, -- 'login', 'logout', 'password_change', etc.
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activity_user ON user_activity_logs(user_id);
CREATE INDEX idx_activity_created ON user_activity_logs(created_at);
```

### Refresh Tokens Table
```sql
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
```

---

## Frontend Components

### Page Structure

```
/app
├── (auth)
│   ├── login
│   │   └── page.tsx
│   ├── register
│   │   └── page.tsx
│   ├── forgot-password
│   │   └── page.tsx
│   └── reset-password
│       └── page.tsx
├── (dashboard)
│   ├── profile
│   │   └── page.tsx
│   ├── settings
│   │   └── page.tsx
│   └── admin
│       ├── users
│       │   └── page.tsx
│       ├── analytics
│       │   └── page.tsx
│       └── plans
│           └── page.tsx
└── components
    ├── auth
    │   ├── LoginForm.tsx
    │   ├── RegisterForm.tsx
    │   └── PasswordResetForm.tsx
    ├── profile
    │   ├── ProfileCard.tsx
    │   ├── PlanCard.tsx
    │   ├── SecuritySettings.tsx
    │   └── APIKeyManager.tsx
    └── admin
        ├── UserTable.tsx
        ├── UserCreateModal.tsx
        ├── PlanManager.tsx
        └── AnalyticsDashboard.tsx
```

### Key Component Requirements

#### 1. Login Page (`/app/(auth)/login/page.tsx`)
**Features:**
- Email and password input fields
- "Remember me" checkbox
- "Forgot password?" link
- Social login options (Google, GitHub) - optional
- Error message display
- Loading state during authentication
- Redirect to dashboard on success
- Link to registration page

**Design Requirements:**
- Clean, modern design with Unified RAG Studio branding
- Responsive layout (mobile-first)
- Form validation with real-time feedback
- Accessibility compliant (ARIA labels, keyboard navigation)

#### 2. Registration Page (`/app/(auth)/register/page.tsx`)
**Features:**
- Full name input
- Email input with validation
- Password input with strength indicator
- Confirm password input
- Terms of service checkbox
- reCAPTCHA or similar bot protection
- Error/success message display
- Link to login page

#### 3. User Profile Page (`/app/(dashboard)/profile/page.tsx`)
**Sections:**

**A. Profile Information**
- Profile picture upload
- Full name (editable)
- Email (display only, with option to change)
- Account creation date
- Last login timestamp

**B. Current Plan**
- Plan name and description
- Features included
- Usage metrics (documents processed, API calls, storage used)
- Billing cycle
- Next billing date
- "Upgrade Plan" button
- "Cancel Subscription" button

**C. Security Settings**
- Change password form
- Enable/disable 2FA
- Active sessions list with "Logout all devices" option
- API key management section

**D. Preferences**
- Email notification settings
- Theme selection (light/dark mode)
- Language preference

#### 4. Admin Dashboard (`/app/(dashboard)/admin/users/page.tsx`)
**Features:**

**A. User Management Table**
- Columns: Name, Email, Role, Plan, Status, Last Login, Actions
- Search functionality (by name, email)
- Filters (role, plan, status, date range)
- Pagination (25/50/100 per page)
- Bulk actions (activate/deactivate, delete)
- Export to CSV

**B. User Actions**
- View user details (modal)
- Edit user (modal with form)
- Change user role
- Reset user password (send email)
- Deactivate/activate account
- View user activity logs
- Impersonate user (with audit trail)

**C. Analytics Section**
- Total users count
- Active users (last 30 days)
- New registrations (chart)
- Plan distribution (pie chart)
- Revenue metrics

**D. Plan Management**
- Create/edit/delete subscription plans
- Feature configuration
- Pricing management

---

## Backend API Endpoints

### Authentication Endpoints

#### POST /api/v1/auth/register
**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "full_name": "John Doe"
}
```
**Response (201):**
```json
{
  "message": "Registration successful. Please check your email for verification.",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "user"
  }
}
```

#### POST /api/v1/auth/login
**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```
**Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "user",
    "plan": {
      "id": "uuid",
      "name": "Free"
    }
  }
}
```

#### POST /api/v1/auth/refresh
**Request (Cookie: refresh_token):**
**Response (200):**
```json
{
  "access_token": "new_access_token"
}
```

#### POST /api/v1/auth/logout
**Request (Headers: Authorization: Bearer <token>):**
**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

#### POST /api/v1/auth/forgot-password
**Request:**
```json
{
  "email": "user@example.com"
}
```
**Response (200):**
```json
{
  "message": "Password reset link sent to your email"
}
```

#### POST /api/v1/auth/reset-password
**Request:**
```json
{
  "token": "reset_token",
  "new_password": "NewSecurePass123!"
}
```
**Response (200):**
```json
{
  "message": "Password reset successful"
}
```

### User Profile Endpoints

#### GET /api/v1/users/me
**Response (200):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "user",
  "profile_image_url": "https://...",
  "is_email_verified": true,
  "two_factor_enabled": false,
  "plan": {
    "id": "uuid",
    "name": "Pro",
    "features": {
      "max_documents": 1000,
      "api_calls_limit": 10000
    }
  },
  "subscription": {
    "status": "active",
    "billing_cycle": "monthly",
    "current_period_end": "2024-06-01T00:00:00Z"
  },
  "created_at": "2024-01-01T00:00:00Z",
  "last_login": "2024-05-09T10:30:00Z"
}
```

#### PUT /api/v1/users/me
**Request:**
```json
{
  "full_name": "John Smith",
  "profile_image_url": "https://..."
}
```

#### POST /api/v1/users/me/change-password
**Request:**
```json
{
  "current_password": "OldPass123!",
  "new_password": "NewSecurePass123!"
}
```

#### GET /api/v1/users/me/usage
**Response (200):**
```json
{
  "documents_processed": 450,
  "api_calls_used": 8500,
  "storage_used_mb": 125,
  "limits": {
    "max_documents": 1000,
    "api_calls_limit": 10000,
    "storage_limit_mb": 500
  },
  "usage_percentage": {
    "documents": 45,
    "api_calls": 85,
    "storage": 25
  }
}
```

### API Key Management Endpoints

#### GET /api/v1/api-keys
**Response (200):**
```json
{
  "api_keys": [
    {
      "id": "uuid",
      "key_name": "Production API",
      "key_prefix": "sk_prod_",
      "last_used": "2024-05-08T15:30:00Z",
      "created_at": "2024-03-01T00:00:00Z",
      "expires_at": null,
      "is_active": true
    }
  ]
}
```

#### POST /api/v1/api-keys
**Request:**
```json
{
  "key_name": "Development API",
  "expires_at": "2024-12-31T23:59:59Z"
}
```
**Response (201):**
```json
{
  "id": "uuid",
  "key_name": "Development API",
  "api_key": "sk_dev_1234567890abcdef", // Only shown once!
  "key_prefix": "sk_dev_",
  "created_at": "2024-05-09T10:30:00Z"
}
```

#### DELETE /api/v1/api-keys/{key_id}

### Subscription Management Endpoints

#### GET /api/v1/plans
**Response (200):**
```json
{
  "plans": [
    {
      "id": "uuid",
      "name": "Free",
      "price_monthly": 0,
      "price_yearly": 0,
      "features": {
        "max_documents": 100,
        "api_calls_limit": 1000,
        "storage_limit_mb": 50
      }
    },
    {
      "id": "uuid",
      "name": "Pro",
      "price_monthly": 29.99,
      "price_yearly": 299.99,
      "features": {
        "max_documents": 1000,
        "api_calls_limit": 10000,
        "storage_limit_mb": 500
      }
    }
  ]
}
```

#### POST /api/v1/subscriptions/upgrade
**Request:**
```json
{
  "plan_id": "uuid",
  "billing_cycle": "monthly"
}
```

#### POST /api/v1/subscriptions/cancel

### Admin-Only Endpoints

#### GET /api/v1/admin/users
**Query Params:** page, limit, search, role, plan, status
**Response (200):**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "full_name": "John Doe",
      "role": "user",
      "plan": "Pro",
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z",
      "last_login": "2024-05-09T10:30:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "pages": 6
}
```

#### POST /api/v1/admin/users
**Request:**
```json
{
  "email": "newuser@example.com",
  "full_name": "Jane Doe",
  "password": "TempPass123!",
  "role": "user",
  "plan_id": "uuid"
}
```

#### PUT /api/v1/admin/users/{user_id}
**Request:**
```json
{
  "full_name": "Jane Smith",
  "role": "admin",
  "is_active": false
}
```

#### DELETE /api/v1/admin/users/{user_id}

#### GET /api/v1/admin/users/{user_id}/activity
**Response (200):**
```json
{
  "activities": [
    {
      "id": "uuid",
      "action": "login",
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0...",
      "created_at": "2024-05-09T10:30:00Z"
    }
  ]
}
```

#### GET /api/v1/admin/analytics
**Response (200):**
```json
{
  "total_users": 1250,
  "active_users_30d": 850,
  "new_registrations_30d": 120,
  "plan_distribution": {
    "Free": 800,
    "Pro": 400,
    "Enterprise": 50
  },
  "revenue_monthly": 15000,
  "growth_rate": 15.5
}
```

#### POST /api/v1/admin/plans
**Request:**
```json
{
  "name": "Enterprise",
  "description": "For large teams",
  "price_monthly": 99.99,
  "price_yearly": 999.99,
  "features": {
    "max_documents": -1,
    "api_calls_limit": -1,
    "storage_limit_mb": -1,
    "priority_support": true
  }
}
```

---

## Implementation Prompts

### Prompt 1: Database Setup and Models

```markdown
I need you to implement the database layer for the Unified RAG Studio user management system.

**Requirements:**

1. Create SQL migration files for all tables defined in the Database Schema section:
   - users
   - subscription_plans
   - user_subscriptions
   - api_keys
   - user_activity_logs
   - refresh_tokens

2. Create SQLAlchemy ORM models for each table with:
   - Proper relationships between models
   - Validation constraints
   - Default values
   - Indexes for performance

3. Create Pydantic schemas for:
   - User registration (input/output)
   - User login (input/output)
   - User profile (output)
   - Subscription plan (output)
   - API key (input/output)
   - Activity log (output)

4. Implement database connection setup with:
   - Connection pooling
   - Async support (using asyncpg)
   - Environment-based configuration

**File Structure:**
```
backend/
├── alembic/
│   └── versions/
│       └── 001_initial_schema.py
├── app/
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── subscription.py
│   │   ├── api_key.py
│   │   └── activity_log.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── user.py
│   │   ├── subscription.py
│   │   └── api_key.py
│   └── database.py
└── alembic.ini
```

**Technical Stack:**
- FastAPI
- SQLAlchemy 2.0 (async)
- Pydantic v2
- PostgreSQL
- Alembic for migrations

Implement the complete database layer with proper type hints, docstrings, and error handling.
```

---

### Prompt 2: Authentication Backend Implementation

```markdown
Implement the complete authentication system for Unified RAG Studio.

**Requirements:**

1. **User Registration:**
   - Email validation and uniqueness check
   - Password hashing using bcrypt
   - Create user with default 'user' role
   - Send verification email (using background task)
   - Return user data (excluding password)

2. **User Login:**
   - Validate credentials
   - Generate JWT access token (15 min expiry)
   - Generate refresh token (7 days expiry)
   - Store refresh token hash in database
   - Set httpOnly cookie with refresh token
   - Log login activity
   - Return user data with access token

3. **Token Management:**
   - JWT token generation with custom claims
   - Token verification and validation
   - Refresh token rotation
   - Token revocation on logout
   - Middleware for authentication

4. **Password Reset:**
   - Generate secure reset token
   - Send reset email
   - Validate reset token
   - Update password and invalidate all sessions

5. **Utility Functions:**
   - Password hashing and verification
   - Email sending service
   - Activity logging decorator

**File Structure:**
```
backend/app/
├── core/
│   ├── __init__.py
│   ├── config.py
│   ├── security.py
│   └── deps.py
├── services/
│   ├── __init__.py
│   ├── auth_service.py
│   ├── email_service.py
│   └── activity_service.py
├── api/
│   └── v1/
│       ├── __init__.py
│       └── endpoints/
│           └── auth.py
└── middleware/
    └── auth_middleware.py
```

**Dependencies to use:**
- python-jose[cryptography] for JWT
- passlib[bcrypt] for password hashing
- python-multipart for form data
- emails or fastapi-mail for email sending

**Key Features:**
- Proper error handling with custom exceptions
- Rate limiting for login attempts
- Async/await throughout
- Comprehensive logging
- Type hints and docstrings

Implement all authentication endpoints as defined in the API Endpoints section.
```

---

### Prompt 3: User Profile and Settings Backend

```markdown
Implement the user profile management and settings functionality for Unified RAG Studio.

**Requirements:**

1. **Profile Management:**
   - Get current user profile with subscription details
   - Update user profile (name, image)
   - Get usage statistics (documents, API calls, storage)
   - Email change with verification
   - Account deletion (soft delete)

2. **Security Settings:**
   - Change password (require current password)
   - Enable/disable 2FA (TOTP-based)
   - View active sessions
   - Logout all devices
   - View activity log

3. **API Key Management:**
   - Generate new API key
   - List user's API keys
   - Revoke API key
   - Track API key usage
   - API key authentication middleware

4. **Subscription Management:**
   - Get available plans
   - Upgrade/downgrade subscription
   - Cancel subscription
   - View billing history

**File Structure:**
```
backend/app/
├── services/
│   ├── user_service.py
│   ├── api_key_service.py
│   └── subscription_service.py
├── api/
│   └── v1/
│       └── endpoints/
│           ├── users.py
│           ├── api_keys.py
│           └── subscriptions.py
└── utils/
    ├── api_key_generator.py
    └── totp.py
```

**Key Implementations:**

1. API Key Generation:
   - Format: `sk_{env}_{random_32_chars}`
   - Store only hash in database
   - Return full key only once
   - Track creation and last usage

2. 2FA Implementation:
   - Use pyotp library
   - Generate QR code for setup
   - Validate TOTP codes
   - Backup codes generation

3. Usage Tracking:
   - Real-time usage calculation
   - Caching for performance
   - Percentage calculations
   - Limit enforcement

Implement all endpoints defined in the User Profile and Subscription sections of the API Endpoints.
```

---

### Prompt 4: Admin Panel Backend

```markdown
Implement the complete admin panel backend for Unified RAG Studio.

**Requirements:**

1. **User Management:**
   - List all users with pagination, search, and filters
   - Create new user (admin can set password)
   - Update user details and role
   - Activate/deactivate user accounts
   - Delete users (hard delete with confirmation)
   - View user activity logs
   - Export users to CSV

2. **Analytics and Reporting:**
   - Total users count
   - Active users (last 30 days)
   - New registrations over time
   - Plan distribution statistics
   - Revenue metrics
   - Usage trends

3. **Plan Management:**
   - Create/update/delete subscription plans
   - Feature configuration
   - Pricing management
   - Plan activation/deactivation

4. **System Settings:**
   - Email templates management
   - System configuration
   - Feature flags

**File Structure:**
```
backend/app/
├── services/
│   ├── admin_service.py
│   └── analytics_service.py
├── api/
│   └── v1/
│       └── endpoints/
│           └── admin/
│               ├── __init__.py
│               ├── users.py
│               ├── analytics.py
│               └── plans.py
└── utils/
    ├── export.py
    └── permissions.py
```

**RBAC Implementation:**

1. Create role-based permission decorator:
```python
@require_role("admin")
async def admin_only_endpoint():
    pass
```

2. Permission checks:
   - Verify user role in JWT token
   - Check if user is active
   - Log admin actions

3. Audit Trail:
   - Log all admin actions
   - Include admin user ID, action, target, timestamp
   - Store in separate audit table

**Key Features:**
- Advanced filtering and sorting
- Bulk operations
- CSV export with streaming
- Real-time statistics caching
- Comprehensive error handling

Implement all admin endpoints as defined in the Admin-Only Endpoints section.
```

---

### Prompt 5: Frontend Authentication Pages

```markdown
Implement the authentication pages for Unified RAG Studio using Next.js 14, TypeScript, and shadcn/ui.

**Requirements:**

1. **Login Page** (`/app/(auth)/login/page.tsx`):
   - Email and password inputs with validation
   - "Remember me" checkbox
   - "Forgot password?" link
   - Form submission with loading state
   - Error message display
   - Redirect to dashboard on success
   - Link to registration page

2. **Registration Page** (`/app/(auth)/register/page.tsx`):
   - Full name, email, password, confirm password inputs
   - Real-time password strength indicator
   - Form validation (Zod schema)
   - Terms of service checkbox
   - Success message with redirect
   - Link to login page

3. **Forgot Password Page** (`/app/(auth)/forgot-password/page.tsx`):
   - Email input
   - Submit button with loading state
   - Success message
   - Link back to login

4. **Reset Password Page** (`/app/(auth)/reset-password/page.tsx`):
   - Token validation
   - New password and confirm password inputs
   - Password strength indicator
   - Success redirect to login

**File Structure:**
```
frontend/app/
├── (auth)/
│   ├── layout.tsx
│   ├── login/
│   │   └── page.tsx
│   ├── register/
│   │   └── page.tsx
│   ├── forgot-password/
│   │   └── page.tsx
│   └── reset-password/
│       └── page.tsx
├── components/
│   └── auth/
│       ├── LoginForm.tsx
│       ├── RegisterForm.tsx
│       ├── ForgotPasswordForm.tsx
│       ├── ResetPasswordForm.tsx
│       └── PasswordStrength.tsx
├── lib/
│   ├── api/
│   │   └── auth.ts
│   ├── validations/
│   │   └── auth.ts
│   └── auth.ts
└── hooks/
    └── use-auth.ts
```

**Design Requirements:**

1. **Layout:**
   - Centered card on gradient background
   - Unified RAG Studio logo and branding
   - Responsive design (mobile-first)
   - Dark mode support

2. **Form Validation:**
   - Use Zod for schema validation
   - Real-time field validation
   - Display errors under fields
   - Disable submit while invalid

3. **API Integration:**
   - Use React Query for data fetching
   - Axios for HTTP requests
   - Token storage in httpOnly cookies
   - Auto-redirect if already authenticated

4. **Components to use (shadcn/ui):**
   - Card, CardHeader, CardTitle, CardDescription, CardContent
   - Input, Label, Button
   - Form (react-hook-form)
   - Alert for error messages
   - Progress for password strength

**Technical Requirements:**
- TypeScript strict mode
- Server-side rendering where appropriate
- Loading skeletons
- Accessibility (ARIA labels, keyboard navigation)
- Form persistence (save draft)

Implement all authentication pages with beautiful, modern design matching the Unified RAG Studio brand.
```

---

### Prompt 6: User Profile and Settings Frontend

```markdown
Implement the user profile and settings pages for Unified RAG Studio.

**Requirements:**

1. **Profile Page** (`/app/(dashboard)/profile/page.tsx`):
   
   **Section A: Profile Information**
   - Profile picture upload with preview
   - Editable full name
   - Display email (with change email dialog)
   - Account creation date
   - Last login timestamp
   - Save changes button

   **Section B: Current Plan**
   - Plan name badge
   - Feature list with checkmarks
   - Usage progress bars (documents, API calls, storage)
   - Next billing date countdown
   - Upgrade/Downgrade buttons
   - Cancel subscription link

   **Section C: Security Settings**
   - Change password form (expand/collapse)
   - 2FA toggle with setup wizard
   - Active sessions list with device info
   - "Logout all devices" button

   **Section D: API Keys**
   - List of API keys with name, prefix, last used
   - Create new API key dialog
   - Copy key to clipboard
   - Revoke key confirmation dialog

   **Section E: Preferences**
   - Email notification toggles
   - Theme selector (light/dark/system)
   - Language dropdown

2. **Upgrade Plan Modal:**
   - Display all available plans
   - Highlight current plan
   - Feature comparison table
   - Billing cycle toggle (monthly/yearly)
   - Pricing display with savings badge
   - Upgrade confirmation

**File Structure:**
```
frontend/app/
├── (dashboard)/
│   ├── layout.tsx
│   ├── profile/
│   │   └── page.tsx
│   └── settings/
│       └── page.tsx
└── components/
    ├── profile/
    │   ├── ProfileCard.tsx
    │   ├── ProfileImageUpload.tsx
    │   ├── PlanCard.tsx
    │   ├── UsageBar.tsx
    │   ├── SecuritySettings.tsx
    │   ├── ChangePasswordForm.tsx
    │   ├── TwoFactorSetup.tsx
    │   ├── ActiveSessions.tsx
    │   ├── APIKeyManager.tsx
    │   ├── APIKeyCreateDialog.tsx
    │   └── APIKeyDisplay.tsx
    └── subscription/
        ├── PlanSelector.tsx
        ├── UpgradeModal.tsx
        └── CancelSubscriptionDialog.tsx
```

**Key Features:**

1. **Profile Image Upload:**
   - Drag and drop or click to upload
   - Image preview and cropping
   - Size limit (5MB)
   - Format validation (jpg, png, webp)
   - Upload to S3/cloud storage

2. **Usage Visualization:**
   - Animated progress bars
   - Percentage display
   - Color coding (green < 70%, yellow < 90%, red >= 90%)
   - Tooltip with exact numbers

3. **2FA Setup:**
   - QR code generation
   - Manual entry key
   - Verification code input
   - Backup codes download

4. **API Key Management:**
   - Secure display (mask full key)
   - One-time full key reveal
   - Copy to clipboard with feedback
   - Creation timestamp and last used

**Design Requirements:**
- Use shadcn/ui components throughout
- Tailwind CSS for styling
- Responsive grid layout
- Smooth animations and transitions
- Loading states for async operations
- Optimistic UI updates

Implement the complete profile management system with a polished, professional UI.
```

---

### Prompt 7: Admin Dashboard Frontend

```markdown
Implement the admin dashboard for Unified RAG Studio.

**Requirements:**

1. **Users Management Page** (`/app/(dashboard)/admin/users/page.tsx`):
   
   **Features:**
   - DataTable with columns: Avatar, Name, Email, Role, Plan, Status, Last Login, Actions
   - Search bar (name/email)
   - Filters: Role dropdown, Plan dropdown, Status toggle, Date range picker
   - Bulk actions: Activate, Deactivate, Delete (with confirmation)
   - Pagination (25/50/100 per page)
   - Export to CSV button
   - "Create User" button (opens modal)
   - Sorting on all columns

   **Actions Menu (dropdown):**
   - View Details (opens drawer)
   - Edit User (opens modal)
   - Change Role (inline or modal)
   - Reset Password (sends email)
   - View Activity Log (opens drawer)
   - Deactivate/Activate
   - Delete (confirmation dialog)

2. **User Details Drawer:**
   - Profile section (avatar, name, email, role badge)
   - Subscription details
   - Usage statistics
   - Activity timeline (recent 20 activities)
   - API keys list
   - Quick actions (edit, change role, reset password)

3. **Create/Edit User Modal:**
   - Full name input
   - Email input
   - Role selector (user/admin)
   - Plan selector
   - Password field (create only)
   - Is Active toggle
   - Submit button

4. **Analytics Page** (`/app/(dashboard)/admin/analytics/page.tsx`):
   
   **Metrics Cards:**
   - Total Users (with growth %)
   - Active Users (last 30 days)
   - New Registrations (this month)
   - Monthly Revenue
   
   **Charts:**
   - User Growth Chart (line chart, last 12 months)
   - Plan Distribution (pie chart)
   - New Registrations Trend (bar chart, last 30 days)
   - Revenue Over Time (area chart, last 12 months)

5. **Plan Management Page** (`/app/(dashboard)/admin/plans/page.tsx`):
   - List of plans (card layout)
   - Create new plan button
   - Edit plan (inline or modal)
   - Delete plan (confirmation)
   - Activate/deactivate toggle
   - Feature editor (key-value pairs)

**File Structure:**
```
frontend/app/
├── (dashboard)/
│   └── admin/
│       ├── layout.tsx
│       ├── users/
│       │   └── page.tsx
│       ├── analytics/
│       │   └── page.tsx
│       └── plans/
│           └── page.tsx
└── components/
    └── admin/
        ├── users/
        │   ├── UserTable.tsx
        │   ├── UserTableRow.tsx
        │   ├── UserFilters.tsx
        │   ├── UserActionsMenu.tsx
        │   ├── UserDetailsDrawer.tsx
        │   ├── CreateUserModal.tsx
        │   ├── EditUserModal.tsx
        │   └── BulkActionsBar.tsx
        ├── analytics/
        │   ├── MetricCard.tsx
        │   ├── UserGrowthChart.tsx
        │   ├── PlanDistributionChart.tsx
        │   └── RevenueChart.tsx
        └── plans/
            ├── PlanCard.tsx
            ├── PlanEditor.tsx
            └── FeatureEditor.tsx
```

**Technical Requirements:**

1. **Data Table:**
   - Use @tanstack/react-table
   - Server-side pagination, filtering, sorting
   - Column visibility toggle
   - Row selection
   - Responsive (stack on mobile)

2. **Charts:**
   - Use recharts library
   - Responsive sizing
   - Tooltips with formatted data
   - Smooth animations
   - Theme-aware colors

3. **State Management:**
   - React Query for server state
   - Optimistic updates
   - Cache invalidation
   - Loading and error states

4. **Permissions:**
   - Route protection (admin only)
   - Conditional rendering based on role
   - Audit logging for admin actions

**Design Requirements:**
- Professional admin dashboard aesthetic
- Consistent spacing and typography
- Hover effects and transitions
- Skeleton loading states
- Empty states with helpful messages
- Confirmation dialogs for destructive actions

Implement the complete admin dashboard with a focus on usability and data clarity.
```

---

### Prompt 8: Authentication Context and API Integration

```markdown
Implement the authentication context, API client, and hooks for Unified RAG Studio.

**Requirements:**

1. **Authentication Context:**
   - User state management
   - Login/logout functions
   - Token refresh logic
   - Protected route wrapper
   - Role-based access control

2. **API Client:**
   - Axios instance with interceptors
   - Automatic token attachment
   - Token refresh on 401
   - Request/response logging
   - Error handling and formatting

3. **React Hooks:**
   - useAuth (access auth context)
   - useUser (current user data)
   - useLogin (login mutation)
   - useRegister (register mutation)
   - useLogout (logout function)
   - useProfile (profile data and update)
   - useSubscription (subscription data)

4. **Route Protection:**
   - ProtectedRoute component
   - AdminRoute component
   - Redirect to login if unauthenticated
   - Role-based rendering

**File Structure:**
```
frontend/
├── lib/
│   ├── api/
│   │   ├── client.ts
│   │   ├── auth.ts
│   │   ├── users.ts
│   │   ├── subscriptions.ts
│   │   ├── admin.ts
│   │   └── types.ts
│   ├── context/
│   │   └── AuthContext.tsx
│   └── utils/
│       ├── tokens.ts
│       └── permissions.ts
├── hooks/
│   ├── use-auth.ts
│   ├── use-user.ts
│   ├── use-login.ts
│   ├── use-register.ts
│   └── use-profile.ts
└── components/
    ├── providers/
    │   ├── AuthProvider.tsx
    │   └── QueryProvider.tsx
    └── guards/
        ├── ProtectedRoute.tsx
        └── AdminRoute.tsx
```

**Key Implementations:**

1. **API Client (`lib/api/client.ts`):**
```typescript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true, // For httpOnly cookies
});

// Request interceptor: attach access token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Attempt token refresh
      try {
        const { data } = await axios.post('/api/v1/auth/refresh');
        localStorage.setItem('access_token', data.access_token);
        // Retry original request
        return apiClient(error.config);
      } catch {
        // Refresh failed, redirect to login
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
```

2. **Auth Context (`lib/context/AuthContext.tsx`):**
```typescript
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: string) => boolean;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load user on mount
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const { data } = await apiClient.get('/api/v1/users/me');
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // ... login, logout, hasRole implementations
}
```

3. **Protected Route (`components/guards/ProtectedRoute.tsx`):**
```typescript
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return null;

  return <>{children}</>;
}
```

**API Functions:**
Implement wrapper functions for all endpoints:
- authAPI.login()
- authAPI.register()
- authAPI.forgotPassword()
- authAPI.resetPassword()
- userAPI.getProfile()
- userAPI.updateProfile()
- userAPI.changePassword()
- subscriptionAPI.getPlans()
- subscriptionAPI.upgrade()
- adminAPI.getUsers()
- adminAPI.createUser()
- etc.

**React Query Setup:**
- Configure query client with default options
- Setup mutations with optimistic updates
- Implement error handling
- Add query invalidation

Implement complete API integration layer with proper TypeScript types and error handling.
```

---

### Prompt 9: Email Templates and Notifications

```markdown
Implement email templates and notification system for Unified RAG Studio.

**Requirements:**

1. **Email Templates:**
   - Welcome email (after registration)
   - Email verification
   - Password reset
   - Password changed confirmation
   - Subscription upgrade/downgrade
   - Payment receipt
   - Account deletion confirmation
   - Admin notification (new user, etc.)

2. **Email Service:**
   - Template rendering engine
   - Email sending with SendGrid/AWS SES
   - Background task processing (Celery or FastAPI BackgroundTasks)
   - Email tracking and logging
   - Retry logic on failure

3. **In-App Notifications:**
   - Real-time notifications (WebSocket or polling)
   - Notification center UI
   - Mark as read functionality
   - Notification preferences

**File Structure:**
```
backend/app/
├── services/
│   ├── email_service.py
│   └── notification_service.py
├── templates/
│   └── emails/
│       ├── base.html
│       ├── welcome.html
│       ├── verification.html
│       ├── password_reset.html
│       ├── password_changed.html
│       ├── subscription_upgraded.html
│       └── account_deleted.html
└── tasks/
    └── email_tasks.py

frontend/components/
├── notifications/
│   ├── NotificationCenter.tsx
│   ├── NotificationItem.tsx
│   └── NotificationBell.tsx
└── emails/ (for preview)
    └── EmailPreview.tsx
```

**Email Template Design:**
- Responsive HTML templates
- Unified RAG Studio branding
- Clear call-to-action buttons
- Footer with unsubscribe link
- Plain text alternative

**Key Features:**
- Template variables (user name, link, etc.)
- HTML and plain text versions
- Inline CSS for email clients
- Testing in different email clients
- Preview functionality in admin panel

**Technical Stack:**
- Jinja2 for template rendering
- SendGrid or AWS SES for sending
- Celery for background tasks
- Redis for task queue

Implement complete email system with beautiful, professional templates.
```

---

### Prompt 10: Testing and Documentation

```markdown
Implement comprehensive testing and documentation for the Unified RAG Studio user management system.

**Requirements:**

1. **Backend Testing:**
   - Unit tests for all services
   - Integration tests for API endpoints
   - Database tests with fixtures
   - Authentication flow tests
   - Permission/authorization tests
   - Test coverage > 80%

2. **Frontend Testing:**
   - Component tests (React Testing Library)
   - Integration tests for forms
   - E2E tests (Playwright)
   - Accessibility tests
   - Visual regression tests

3. **API Documentation:**
   - OpenAPI/Swagger documentation
   - Interactive API explorer
   - Request/response examples
   - Authentication documentation
   - Error code reference

4. **User Documentation:**
   - Getting started guide
   - User manual
   - Admin guide
   - API integration guide
   - FAQ

**File Structure:**
```
backend/
├── tests/
│   ├── conftest.py
│   ├── test_auth.py
│   ├── test_users.py
│   ├── test_subscriptions.py
│   ├── test_admin.py
│   └── fixtures/
│       └── user_fixtures.py
└── docs/
    ├── api/
    │   └── openapi.yaml
    └── guides/
        └── authentication.md

frontend/
├── __tests__/
│   ├── components/
│   │   ├── LoginForm.test.tsx
│   │   ├── ProfileCard.test.tsx
│   │   └── UserTable.test.tsx
│   └── e2e/
│       ├── auth.spec.ts
│       ├── profile.spec.ts
│       └── admin.spec.ts
└── docs/
    ├── user-guide.md
    └── admin-guide.md
```

**Backend Tests:**

1. **Authentication Tests:**
```python
@pytest.mark.asyncio
async def test_user_registration(client):
    response = await client.post("/api/v1/auth/register", json={
        "email": "test@example.com",
        "password": "SecurePass123!",
        "full_name": "Test User"
    })
    assert response.status_code == 201
    assert "user" in response.json()

@pytest.mark.asyncio
async def test_login_success(client, test_user):
    response = await client.post("/api/v1/auth/login", json={
        "email": "test@example.com",
        "password": "SecurePass123!"
    })
    assert response.status_code == 200
    assert "access_token" in response.json()
```

2. **Permission Tests:**
```python
@pytest.mark.asyncio
async def test_admin_only_endpoint_as_user(client, user_token):
    response = await client.get(
        "/api/v1/admin/users",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert response.status_code == 403
```

**Frontend Tests:**

1. **Component Tests:**
```typescript
describe('LoginForm', () => {
  it('submits form with valid credentials', async () => {
    const mockLogin = jest.fn();
    render(<LoginForm onSubmit={mockLogin} />);
    
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /login/i }));
    
    expect(mockLogin).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123'
    });
  });
});
```

2. **E2E Tests:**
```typescript
test('complete registration flow', async ({ page }) => {
  await page.goto('/register');
  await page.fill('[name="email"]', 'newuser@example.com');
  await page.fill('[name="password"]', 'SecurePass123!');
  await page.fill('[name="confirmPassword"]', 'SecurePass123!');
  await page.check('[name="terms"]');
  await page.click('button[type="submit"]');
  
  await expect(page).toHaveURL('/login');
  await expect(page.locator('text=Registration successful')).toBeVisible();
});
```

**Documentation Requirements:**
- Clear API endpoint descriptions
- Code examples in multiple languages
- Common use cases and patterns
- Troubleshooting section
- Migration guides

**Tools:**
- pytest for backend testing
- pytest-asyncio for async tests
- pytest-cov for coverage
- Jest + React Testing Library for frontend
- Playwright for E2E
- Swagger UI for API docs

Implement comprehensive test suite and documentation for production readiness.
```

---

## Additional Considerations

### Security Best Practices

1. **Password Requirements:**
   - Minimum 8 characters
   - At least one uppercase, lowercase, number, and special character
   - Not in common password list
   - Different from email

2. **Rate Limiting:**
   - Login attempts: 5 per 15 minutes per IP
   - Registration: 3 per hour per IP
   - Password reset: 3 per hour per email
   - API calls: Based on subscription plan

3. **Data Protection:**
   - HTTPS only
   - httpOnly cookies for refresh tokens
   - CSRF protection
   - XSS prevention
   - SQL injection prevention (parameterized queries)

4. **Logging and Monitoring:**
   - Failed login attempts
   - Password changes
   - Role changes
   - Admin actions
   - API key usage

### Performance Optimization

1. **Caching:**
   - User profile data (5 min TTL)
   - Subscription plan data (1 hour TTL)
   - Usage statistics (1 min TTL)
   - Admin analytics (5 min TTL)

2. **Database Optimization:**
   - Indexes on frequently queried columns
   - Connection pooling
   - Query optimization
   - Pagination for large datasets

3. **Frontend Optimization:**
   - Code splitting
   - Lazy loading components
   - Image optimization
   - Caching API responses

### Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] SSL certificates installed
- [ ] Email service configured
- [ ] Monitoring and logging setup
- [ ] Backup strategy implemented
- [ ] Rate limiting configured
- [ ] CORS settings verified
- [ ] Error tracking (Sentry) setup
- [ ] Performance monitoring
- [ ] Load testing completed
- [ ] Security audit passed

---

## Quick Start Guide

### Backend Setup
```bash
# Install dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload
```

### Frontend Setup
```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

### Environment Variables
```bash
# Backend (.env)
DATABASE_URL=postgresql://user:pass@localhost/ragstudio
SECRET_KEY=your-secret-key
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
EMAIL_PROVIDER=sendgrid
EMAIL_API_KEY=your-sendgrid-key

# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

**Document Version:** 1.0  
**Last Updated:** May 9, 2026  
**Author:** Unified RAG Studio Team
