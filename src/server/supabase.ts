import type {PackInput} from '../shared/validation';
import {validatePackInput} from '../shared/validation';

export interface SupabaseEnv {
  SUPABASE_URL?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_STORAGE_BUCKET?: string;
}

export const maxBackupBytes = 8 * 1024 * 1024;

export function storageConfigured(env: SupabaseEnv): boolean {
  return !!(env.SUPABASE_URL && env.SUPABASE_SECRET_KEY && env.SUPABASE_STORAGE_BUCKET);
}

function storageError(message: string, status: number): Error {
  return Object.assign(new Error(message), {status});
}

export function validateBankBackup(input: unknown): PackInput[] {
  const backup = input as {version?: unknown; banks?: unknown} | null;
  if (backup?.version !== 1 || !Array.isArray(backup.banks) || backup.banks.length > 1000) {
    throw storageError('Format cadangan bank tidak didukung.', 400);
  }
  return backup.banks.map(validatePackInput);
}

export async function bankBackup(env: SupabaseEnv, owner: string, method: 'GET' | 'PUT', banks?: PackInput[]) {
  if (!storageConfigured(env)) throw storageError('Supabase Storage belum dikonfigurasi.', 503);
  const base = new URL(env.SUPABASE_URL!);
  const bucket = env.SUPABASE_STORAGE_BUCKET!;
  if (base.protocol !== 'https:' || base.username || base.password || !/^[\w-]{1,100}$/.test(bucket)) {
    throw storageError('Konfigurasi Supabase Storage tidak valid.', 503);
  }

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(owner));
  const prefix = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const url = new URL(`/storage/v1/object/${method === 'GET' ? 'authenticated/' : ''}${bucket}/noodl/${prefix}/banks.json`, base);
  const headers = new Headers({apikey: env.SUPABASE_SECRET_KEY!});
  if (!env.SUPABASE_SECRET_KEY!.startsWith('sb_secret_')) {
    headers.set('authorization', `Bearer ${env.SUPABASE_SECRET_KEY}`);
  }
  let body: Uint8Array<ArrayBuffer> | undefined;
  if (method === 'PUT') {
    body = new TextEncoder().encode(JSON.stringify({version: 1, banks}));
    if (body.byteLength > maxBackupBytes) throw storageError('Cadangan melebihi batas 8 MB.', 413);
    headers.set('content-type', 'application/json');
    headers.set('x-upsert', 'true');
  }

  const response = await fetch(url.href, {
    method: method === 'PUT' ? 'POST' : 'GET', headers, body, redirect: 'error',
    signal: AbortSignal.timeout(15000)
  }).catch(error => {
    const message = (error instanceof Error ? error.message : 'Unknown network error')
      .replaceAll(env.SUPABASE_SECRET_KEY!, '[redacted]').slice(0, 240);
    console.error('Supabase Storage request failed', method, message);
    throw storageError('Supabase Storage belum bisa dijangkau.', 502);
  });
  if (method === 'GET' && !response.ok) {
    const details = await response.json().catch(() => null) as {statusCode?: string | number; code?: string; error?: string} | null;
    if (response.status === 404 || String(details?.statusCode) === '404' ||
        details?.code === 'NoSuchKey' || details?.error === 'NoSuchKey') {
      throw storageError('Belum ada cadangan bank di Supabase.', 404);
    }
  }
  if (!response.ok) throw storageError('Supabase menolak permintaan penyimpanan.', 502);
  if (method === 'PUT') return {ok: true, count: banks!.length};
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > maxBackupBytes) throw storageError('Cadangan melebihi batas 8 MB.', 413);
  return {version: 1, banks: validateBankBackup(JSON.parse(new TextDecoder().decode(bytes)))};
}
