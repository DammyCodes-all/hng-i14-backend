import { createHash, randomBytes } from 'crypto';

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
}

export function generateState(): string {
  return randomBytes(32).toString('base64url');
}

export function generatePkcePair(): PkcePair {
  const codeVerifier = randomBytes(48).toString('base64url');
  const codeChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  return {
    codeVerifier,
    codeChallenge,
  };
}

export function buildGithubAuthUrl(options: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL('https://github.com/login/oauth/authorize');

  url.searchParams.set('client_id', options.clientId);
  url.searchParams.set('redirect_uri', options.redirectUri);
  url.searchParams.set('state', options.state);
  url.searchParams.set('code_challenge', options.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('scope', 'read:user user:email');

  return url.toString();
}