import 'server-only';
import { createClient } from '@supabase/supabase-js';
export function getAdminDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SECRET_KEY;
  // Compromised legacy service-role JWTs are deliberately not accepted.
  if (!url || !key?.startsWith('sb_secret_')) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(10000), cache: 'no-store' }),
    },
  });
}
