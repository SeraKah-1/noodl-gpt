import type {User} from '../shared/types';

const cookieName = '__Host-noodl-guest';

function tokenFrom(request: Request): string | undefined {
  const cookie = request.headers.get('cookie')?.split(';').map(part => part.trim())
    .find(part => part.startsWith(cookieName + '='));
  const token = cookie?.slice(cookieName.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : undefined;
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function guestFromToken(token: string): Promise<User> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return {id: 'web-guest:' + hex(new Uint8Array(digest)), name: 'Guest'};
}

export async function guestIdentity(request: Request): Promise<User | undefined> {
  const token = tokenFrom(request);
  if (token) return guestFromToken(token);
}

export async function startGuestSession(request: Request): Promise<Response> {
  const token = tokenFrom(request) ?? hex(crypto.getRandomValues(new Uint8Array(32)));
  return Response.json(await guestFromToken(token), {
    headers: {
      'cache-control': 'no-store',
      'set-cookie': `${cookieName}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=31536000`
    }
  });
}
