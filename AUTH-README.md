# YangkarSvelteKit Authentication System

This document provides details about the authentication system implemented in the YangkarSvelteKit application.

## Overview

The authentication system uses a modern, secure approach with JWT (JSON Web Tokens) featuring:

- Short-lived access tokens (15 minutes)
- Longer-lived refresh tokens (7 days)
- CSRF protection for state-changing requests
- Argon2id password hashing
- HttpOnly, Secure cookies
- Rate limiting for authentication endpoints
- Automatic token refresh mechanism

## Architecture

### Tokens

1. **Access Token** - Short-lived JWT stored in HttpOnly cookie that contains user identity and a CSRF token
2. **Refresh Token** - Longer-lived JWT stored in HttpOnly cookie, used to get new access tokens
3. **CSRF Token** - A random string embedded in the access token and sent to the client for protection against CSRF attacks

### Authentication Flow

1. **Login/Signup**
    - User submits credentials
    - Server validates and issues access and refresh tokens
    - Tokens are stored in HttpOnly cookies
    - CSRF token is returned in the response body

2. **Authenticated Requests**
    - For read operations (GET), only the access token cookie is required
    - For state-changing operations (POST/PUT/DELETE), the CSRF token must be included in the `X-CSRF-Token` header

3. **Token Refresh**
    - When the access token expires, the client calls the `/api/refresh` endpoint
    - Server validates the refresh token and issues new tokens

## Setup Instructions

### Environment Variables

Add these to your backend `.env` file:

```
JWT_ACCESS_SECRET=your-very-secure-access-token-secret
JWT_REFRESH_SECRET=your-very-secure-refresh-token-secret
JWT_RESET_SECRET=your-very-secure-reset-token-secret
```

### Install Dependencies

Run this in the backend directory:

```bash
pnpm install
```

## Client-Side Implementation

### CSRF Protection

For any state-changing API calls, include the CSRF token in the headers:

```javascript
import { createAuthFetch } from "$lib/utils/csrf";

// In a component or action
const csrfToken = data.csrfToken; // From +layout.svelte data prop
const authFetch = createAuthFetch(csrfToken);

// Use the authenticated fetch
const response = await authFetch("/api/some-endpoint", {
    method: "POST",
    body: JSON.stringify(payload),
});
```

## Security Best Practices

- Access tokens expire after 15 minutes
- All tokens are stored in HttpOnly cookies to prevent JavaScript access
- Password reset tokens expire after 10 minutes
- Authentication requests are rate-limited to prevent brute force attacks
- Passwords are hashed using Argon2id (memory-hard hashing algorithm)
- All sessions for a user are invalidated when their password is reset
- Password requirements enforced: minimum 8 characters, uppercase, lowercase, and numbers
