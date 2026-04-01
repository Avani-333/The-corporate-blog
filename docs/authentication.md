# Authentication System Documentation

## Overview

The Corporate Blog implements a comprehensive authentication system with JWT tokens, refresh token rotation, role-based access control, and Google OAuth integration. This system is designed for production use with security best practices.

## Features

- ✅ **JWT Authentication**: Secure access tokens with configurable expiration
- ✅ **Refresh Token Rotation**: Automatic token rotation for enhanced security
- ✅ **Role-Based Access Control (RBAC)**: Granular permissions system
- ✅ **Google OAuth Integration**: Single sign-on with Google accounts
- ✅ **Rate Limiting**: Protection against brute force attacks
- ✅ **Security Monitoring**: Suspicious activity detection
- ✅ **Device Management**: Track and manage user sessions across devices
- ✅ **Account Linking**: Link Google accounts to existing users

## Architecture

### Token System

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Access Token  │    │  Refresh Token  │    │   User Session  │
│   (15 minutes)  │    │    (7 days)     │    │   (Database)    │
│                 │    │                 │    │                 │
│ • User info     │    │ • Token ID      │    │ • Device info   │
│ • Permissions   │    │ • Expiration    │    │ • IP tracking   │
│ • Short-lived   │    │ • Rotation      │    │ • Security logs │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Role Hierarchy

```
SUPER_ADMIN (1000) ── Full system control
     │
ADMIN (800) ────────── Administrative functions
     │
MODERATOR (600) ────── Content and user moderation
     │
EDITOR (400) ─────────── Content editing and publishing
     │
AUTHOR (300) ─────────── Content creation
     │
CONTRIBUTOR (200) ───── Limited content creation
     │
SUBSCRIBER (100) ────── Premium content access
     │
GUEST (50) ─────────────── Basic access
```

## API Endpoints

### Authentication

#### POST `/api/auth/login`
Login with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "rememberMe": false
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "123",
    "email": "user@example.com",
    "role": "AUTHOR",
    "status": "ACTIVE"
  },
  "tokens": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

#### POST `/api/auth/logout`
Logout user and revoke tokens.

**Request:**
```json
{
  "logoutAll": false  // Optional: logout from all devices
}
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully",
  "tokensRevoked": 1
}
```

#### POST `/api/auth/refresh`
Refresh expired access token.

**Request:**
```json
{
  "refreshToken": "eyJ..."  // Optional if provided in cookie
}
```

**Response:**
```json
{
  "success": true,
  "tokens": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  },
  "user": { /* user data */ }
}
```

### Google OAuth

#### GET `/api/auth/google`
Initiate Google OAuth flow.

**Query Parameters:**
- `redirect`: Redirect URL after successful authentication
- `state`: Custom state data

**Response:**
```json
{
  "success": true,
  "authUrl": "https://accounts.google.com/oauth2/auth?...",
  "state": "encoded_state"
}
```

#### GET `/api/auth/google/callback`
Handle Google OAuth callback.

**Query Parameters:**
- `code`: Authorization code from Google
- `state`: State parameter for CSRF protection

**Response:** Redirect to success/error page with tokens set in cookies.

## Usage Examples

### Client-Side Authentication

```typescript
// Login
const login = async (email: string, password: string) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  
  const data = await response.json();
  if (data.success) {
    // Tokens are automatically stored in httpOnly cookies
    window.location.href = '/dashboard';
  }
};

// Logout
const logout = async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login';
};

// Google OAuth
const loginWithGoogle = async () => {
  const response = await fetch('/api/auth/google');
  const data = await response.json();
  if (data.success) {
    window.location.href = data.authUrl;
  }
};
```

### Middleware Protection

```typescript
// middleware.ts
import { withAuth, requireRole, adminOnly } from '@/lib/auth/middleware';

// Protect all dashboard routes
export const middleware = withAuth({
  requiredRoles: [UserRole.SUBSCRIBER], // Minimum role required
});

// Protect specific admin routes
export const adminMiddleware = adminOnly({
  unauthorizedRedirect: '/login',
});

// Custom authorization
export const customMiddleware = withAuth({
  customCheck: async (user, request) => {
    // Custom logic here
    return user.status === 'ACTIVE';
  },
});

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*']
};
```

### API Route Protection

```typescript
// app/api/admin/users/route.ts
import { withApiAuth } from '@/lib/auth/middleware';
import { UserRole } from '@/types';

export const GET = withApiAuth(
  async (request, { user }) => {
    // Only admins can access
    return NextResponse.json({ users: [] });
  },
  { requiredRoles: [UserRole.ADMIN] }
);
```

### Role-Based UI

```typescript
// components/RoleGuard.tsx
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/types';

interface RoleGuardProps {
  roles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGuard({ roles, children, fallback }: RoleGuardProps) {
  const { user, hasAnyRole } = useAuth();
  
  if (!user || !hasAnyRole(roles)) {
    return fallback || null;
  }
  
  return <>{children}</>;
}

// Usage
<RoleGuard roles={[UserRole.ADMIN, UserRole.EDITOR]}>
  <AdminPanel />
</RoleGuard>
```

## Security Features

### Rate Limiting

```typescript
// Automatic rate limiting on login endpoint
- Max 5 login attempts per IP per 15 minutes
- Max 20 refresh attempts per IP per 5 minutes
- Automatic lockout with exponential backoff
```

### CSRF Protection

```typescript
// OAuth state parameter validation
- Random state generation
- State verification in callback
- Timestamp-based expiration
```

### Token Security

```typescript
// JWT token security
- HS256 algorithm with strong secrets
- Short-lived access tokens (15 minutes)
- Secure refresh token rotation
- httpOnly cookies for token storage
```

### Suspicious Activity Detection

```typescript
// Automatic monitoring
- Multiple IPs in short timeframe
- Rapid token creation patterns
- Device fingerprinting
- Geographic anomalies (future enhancement)
```

## Configuration

### Environment Variables

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
REFRESH_SECRET=your-super-secret-refresh-key-minimum-32-characters

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/google/callback

# Security Settings
BCRYPT_ROUNDS=12
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000

# Token Expiration
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
```

### Google OAuth Setup

1. **Go to Google Cloud Console**: https://console.cloud.google.com
2. **Create a new project** or select existing one
3. **Enable Google+ API** and **OAuth2 API**
4. **Create OAuth 2.0 credentials**:
   - Application type: Web application
   - Authorized redirect URIs: `https://yourdomain.com/api/auth/google/callback`
5. **Copy Client ID and Secret** to your environment variables

### Database Migration

```bash
# Generate Prisma client
npx prisma generate

# Run database migration
npx prisma db push

# Or create and run migration
npx prisma migrate dev --name add-authentication
```

## Hooks and Utilities

### useAuth Hook

```typescript
// hooks/useAuth.ts
export function useAuth() {
  return {
    user,
    isAuthenticated,
    hasRole: (role: UserRole) => boolean,
    hasAnyRole: (roles: UserRole[]) => boolean,
    canAccess: (resource: string, action: string) => boolean,
    login: (email: string, password: string) => Promise<void>,
    logout: () => Promise<void>,
    refresh: () => Promise<void>,
  };
}
```

### Permission Utilities

```typescript
import { hasPermission, hasRole } from '@/lib/auth/middleware';

// Check specific permission
const canEdit = hasPermission(user, 'content', 'edit');

// Check role hierarchy
const isStaff = hasRole(user, UserRole.EDITOR); // Editor or higher
```

## Error Handling

### Authentication Errors

```typescript
export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  USER_NOT_FOUND: 'User not found',
  USER_INACTIVE: 'Account is inactive',
  USER_SUSPENDED: 'Account is suspended',
  EMAIL_NOT_VERIFIED: 'Email address not verified',
  TOKEN_EXPIRED: 'Token has expired',
  TOKEN_INVALID: 'Invalid token',
  REFRESH_TOKEN_EXPIRED: 'Refresh token has expired',
  REFRESH_TOKEN_INVALID: 'Invalid refresh token',
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions',
  RATE_LIMITED: 'Too many attempts',
  INTERNAL_ERROR: 'Internal error occurred',
};
```

### Error Response Format

```json
{
  "success": false,
  "error": "INVALID_CREDENTIALS",
  "message": "Invalid email or password",
  "details": ["Email is required", "Password is too short"]
}
```

## Performance Considerations

### Token Storage

- **Access tokens**: Stored in httpOnly cookies and memory
- **Refresh tokens**: Stored in httpOnly cookies and database
- **User sessions**: Cached in memory with database persistence

### Database Optimization

```sql
-- Optimized indexes for authentication
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_id ON refresh_tokens(token_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
```

### Cleanup Tasks

```typescript
// Scheduled cleanup (run daily)
import { performTokenMaintenance } from '@/lib/auth/refresh-tokens';

// Remove expired and old revoked tokens
const cleanup = await performTokenMaintenance();
console.log(`Cleaned up ${cleanup.expiredRemoved} expired tokens`);
```

## Monitoring and Analytics

### Security Metrics

- Failed login attempts per IP/user
- Token refresh patterns
- OAuth conversion rates
- Device distribution
- Geographic access patterns

### Health Checks

```typescript
// Check authentication system health
GET /api/health/auth

{
  "status": "healthy",
  "checks": {
    "jwt_secret": "configured",
    "google_oauth": "configured",
    "database": "connected",
    "rate_limiting": "active"
  }
}
```

## Troubleshooting

### Common Issues

1. **JWT Secret Not Set**
   ```
   Error: JWT_SECRET environment variable is required
   Solution: Set JWT_SECRET in your .env file
   ```

2. **Google OAuth Mismatch**
   ```
   Error: redirect_uri_mismatch
   Solution: Update redirect URI in Google Console
   ```

3. **Token Refresh Fails**
   ```
   Error: Invalid refresh token
   Solution: Clear cookies and re-authenticate
   ```

4. **Rate Limiting Triggered**
   ```
   Error: Too many login attempts
   Solution: Wait 15 minutes or adjust rate limits
   ```

### Debug Mode

```env
# Enable authentication debugging
AUTH_DEBUG=true
JWT_DEBUG=true
```

## Future Enhancements

- [ ] **Multi-factor Authentication (MFA)**
- [ ] **Social OAuth** (GitHub, LinkedIn, Twitter)
- [ ] **Passwordless Authentication** (Magic links, WebAuthn)
- [ ] **Session Management Dashboard**
- [ ] **Advanced Security Analytics**
- [ ] **API Key Management**
- [ ] **Device Trust Levels**

## Contributing

When contributing to the authentication system:

1. **Security First**: Always consider security implications
2. **Test Thoroughly**: Include unit and integration tests
3. **Document Changes**: Update this documentation
4. **Follow Patterns**: Maintain consistency with existing code
5. **Review Carefully**: Security-related changes need extra review

## Support

For authentication-related issues:

1. Check this documentation
2. Review error logs
3. Verify environment configuration
4. Test in isolated environment
5. Contact development team

---

*Last updated: [Current Date]*
*Version: 1.0.0*