export const AUTH_ACCESS_TOKEN_TTL_MS = 3 * 60 * 1000;
export const AUTH_REFRESH_TOKEN_TTL_MS = 5 * 60 * 1000;

export const AUTH_COOKIE_NAME = 'insighta_session';

export const DEFAULT_USER_ROLE = 'analyst' as const;
export const INITIAL_USER_ROLE = 'admin' as const;

export const getAuthEnv = () => ({
  githubClientId: process.env.GITHUB_CLIENT_ID ?? '',
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
  jwtSecret: process.env.JWT_SECRET ?? '',
  frontendUrl: process.env.FRONTEND_URL ?? '',
  backendUrl: process.env.BACKEND_URL ?? '',
});
