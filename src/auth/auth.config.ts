export const AUTH_ACCESS_TOKEN_TTL_MS = 3 * 60 * 1000;
export const AUTH_REFRESH_TOKEN_TTL_MS = 5 * 60 * 1000;
export const AUTH_PKCE_TRANSACTION_TTL_MS = 10 * 60 * 1000;

export const AUTH_COOKIE_NAME = 'insighta_session';
export const AUTH_REFRESH_COOKIE_NAME = 'insighta_refresh';

export const DEFAULT_USER_ROLE = 'analyst' as const;
export const INITIAL_USER_ROLE = 'admin' as const;

export const getAuthEnv = () => ({
  githubClientId: process.env.GITHUB_CLIENT_ID ?? '',
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
  jwtSecret: process.env.JWT_ACCESS_SECRET ?? '',
  frontendUrl: process.env.WEB_PORTAL_URL ?? '',
  backendUrl: process.env.BACKEND_URL ?? '',
});

export const logAuthEnv = () => {
  const env = getAuthEnv();
  console.log('[AuthConfig] Environment variables:', {
    githubClientId: env.githubClientId
      ? `${env.githubClientId.slice(0, 10)}...`
      : 'MISSING',
    githubClientSecret: env.githubClientSecret ? 'SET' : 'MISSING',
    jwtSecret: env.jwtSecret ? 'SET' : 'MISSING',
    frontendUrl: env.frontendUrl || 'MISSING',
    backendUrl: env.backendUrl || 'MISSING',
  });
};
