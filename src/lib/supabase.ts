import { createClient } from '@supabase/supabase-js';

// Valores públicos por natureza (anon/publishable). Podem ser sobrescritos por .env.
// Projeto Supabase: "autoai" (umvbrahsqvqeondwtikm) — migrado em 2026-06-24 do
// antigo jlfzjhkeebqchfqrdwer (que estava na conta da Xarlote, por engano).
export const SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL || 'https://umvbrahsqvqeondwtikm.supabase.co';
export const SUPABASE_ANON_KEY =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_thvgLpTYDPajbwUrwq8Agw_n9zeywnD';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'luxa-admin-auth',
  },
});
