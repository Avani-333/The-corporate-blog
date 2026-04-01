export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface JWTPayload {
  id: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  id: string;
  tokenVersion: number;
  iat: number;
  exp: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RequestUser {
  id: string;
  email: string;
  name?: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
      requestId?: string;
      dbQueryTimeMs?: number;
      dbQueryCount?: number;
    }
  }
}