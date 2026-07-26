// Lightweight session auth shared by the login route (Node) and middleware (edge).
// Both compute the same session token from the configured admin credentials, so
// a stolen/forged cookie can't be crafted without knowing ADMIN_PASSWORD + SESSION_SECRET.

export const COOKIE = 'tl_session';

export function adminUser(): string {
  return process.env.ADMIN_USER || 'admin';
}
export function adminPass(): string {
  return process.env.ADMIN_PASSWORD || 'admin';
}
function secret(): string {
  // Set SESSION_SECRET in production. The default is only for first-run/dev.
  return process.env.SESSION_SECRET || 'techlabs-inventory-change-me';
}

/** Deterministic opaque token bound to the current credentials. */
export async function sessionToken(): Promise<string> {
  const data = new TextEncoder().encode(`${adminUser()}:${adminPass()}:${secret()}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
