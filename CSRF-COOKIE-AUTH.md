# CSRF Token & Cookie Authentication Guide

This document explains how CSRF tokens work in this application and how to properly implement new admin pages that require authentication.

## Architecture Overview

The application uses **cookie-based authentication** with CSRF tokens for security:

1. **Backend** sends JWT access tokens as HttpOnly cookies
2. **JWT contains CSRF token** in the payload
3. **Frontend cannot read HttpOnly cookies** from JavaScript
4. **CSRF token is passed through SvelteKit's data flow** to pages

## Data Flow

```
Backend JWT (HttpOnly Cookie)
    ↓
hooks.server.js decodes JWT → locals.csrfToken
    ↓
+layout.server.js → data.csrfToken
    ↓
Page receives via export let data
    ↓
Store in auth store
    ↓
apiFetch reads from auth store
    ↓
Sent as x-csrf-token header
```

## How to Create New Admin Pages

### 1. Page Component Setup

```svelte
<script>
    import { apiFetch } from "$lib/utils/api.js";
    import { auth } from "$lib/stores/auth.store.js";

    // REQUIRED: Receive data prop from layout
    export let data;

    // REQUIRED: Set CSRF token in auth store
    $: if (data?.csrfToken) {
        if ($auth.csrfToken !== data.csrfToken) {
            auth.setCsrfToken(data.csrfToken);
        }
    }

    // Use apiFetch for all API calls
    async function saveData() {
        const response = await apiFetch("/api/your-endpoint", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
        });
        // Handle response...
    }
</script>
```

### 2. Backend Route Setup

```javascript
import express from "express";
import prismaPkg from "@prisma/client";
import asyncHandler from "../middleware/asyncHandler.js";
import authenticateToken from "../middleware/authenticateToken.js";
import requireAdmin from "../middleware/requireAdmin.js";

const { PrismaClient } = prismaPkg;
const router = express.Router();
const prisma = new PrismaClient();

// Public routes (no auth)
router.get(
    "/api/public-data",
    asyncHandler(async (req, res) => {
        // Anyone can access
    })
);

// Admin-only routes (auth + admin check)
router.post(
    "/api/admin-action",
    authenticateToken,
    requireAdmin,
    asyncHandler(async (req, res) => {
        // Only admins can access
        // req.user contains authenticated user
    })
);

export default router;
```

### 3. Register Route in index.js

```javascript
// In apps/backend/src/index.js
import yourRoutes from "./routes/your.routes.js";

// Add after other routes
app.use("/api", yourRoutes);
```

## Common Issues & Solutions

### Issue: "CSRF token validation failed"

**Symptoms:**

- Browser console: `No CSRF token available for POST request`
- Backend log: `CSRF token validation failed {headerToken: 'missing'}`

**Solution:**

1. ✅ Page must receive `data` prop: `export let data;`
2. ✅ CSRF token must be set in store: `auth.setCsrfToken(data.csrfToken)`
3. ✅ Use `apiFetch` (not `fetch` directly)
4. ✅ Header must be lowercase: `"x-csrf-token"` not `"X-CSRF-Token"`

### Issue: "Access token cookie exists: false"

**Cause:** Trying to read HttpOnly cookies from JavaScript (security prevents this)

**Solution:** Don't try to read cookies directly. Use the data flow through SvelteKit's `data` prop.

### Issue: Store value not accessible in utility functions

**Wrong:**

```javascript
const csrfToken = auth?.csrfToken; // ❌ Accesses store object, not value
```

**Correct:**

```javascript
import { get } from "svelte/store";
const authValue = get(auth);
const csrfToken = authValue?.csrfToken; // ✅ Gets actual value
```

## Key Files

- **Frontend:**
    - `apps/frontend/src/hooks.server.js` - Decodes JWT, sets locals.csrfToken
    - `apps/frontend/src/routes/+layout.server.js` - Passes csrfToken to all pages
    - `apps/frontend/src/lib/utils/api.js` - Handles CSRF token in requests
    - `apps/frontend/src/lib/stores/auth.store.js` - Stores CSRF token in memory

- **Backend:**
    - `apps/backend/src/middleware/authenticateToken.js` - Validates JWT & CSRF
    - `apps/backend/src/middleware/requireAdmin.js` - Checks admin role

## Example: Sellers Management Page

See `apps/frontend/src/routes/admin/sellers/+page.svelte` for a complete working example that:

- Receives CSRF token via data prop
- Sets it in auth store
- Uses apiFetch for all API calls
- Handles create, update, delete operations

## Security Notes

- ✅ Cookies are HttpOnly (JavaScript cannot read them)
- ✅ CSRF tokens prevent cross-site request forgery
- ✅ Tokens are in-memory only (not localStorage)
- ✅ Backend validates both JWT and CSRF on mutations
- ✅ GET requests don't require CSRF tokens
