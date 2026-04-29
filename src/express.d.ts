export {};

declare global {
  namespace Express {
    interface Request {
      user?: {
        sub: string;
        role: 'admin' | 'analyst';
        githubId: string;
        username: string;
      };
    }
  }
}
