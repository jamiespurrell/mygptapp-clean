export type AuthProvider = 'clerk' | 'authjs';

export function getAuthProvider(): AuthProvider {
  return process.env.AUTH_PROVIDER === 'authjs' ? 'authjs' : 'clerk';
}
