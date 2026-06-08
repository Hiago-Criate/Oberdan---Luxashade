import { createClient } from '@supabase/supabase-js';

// Valores públicos por natureza (anon/publishable). Podem ser sobrescritos por .env.
export const SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL || 'https://jlfzjhkeebqchfqrdwer.supabase.co';
export const SUPABASE_ANON_KEY =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_c10JI8KBD9x4ADqRoNuXpw_Kgnvds7h';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'luxa-admin-auth',
  },
});
