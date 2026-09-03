-- ============================================================================
-- HISTÓRICO DE ALTERAÇÕES (audit_log) — projeto "autoai" (umvbrahsqvqeondwtikm)
--
-- Por que: na migração de 2026-06-24 a tabela `audit_log` não foi recriada
-- (a API responde 404), então o módulo "Histórico" do /admin fica vazio e não
-- há como saber QUEM mudou O QUÊ e QUANDO. Isso apareceu em 2026-08-20, quando
-- a revenda Casa & Cortina (000221) ficou sem desconto no app e não tínhamos
-- registro para conferir.
--
-- Como rodar: Supabase → SQL Editor → cole tudo → Run. É seguro rodar de novo
-- (tudo usa "if not exists" / "create or replace" / recria os gatilhos).
--
-- ATENÇÃO: o histórico começa a valer A PARTIR DAQUI. Ele não recupera o que
-- aconteceu antes de ser criado.
-- ============================================================================

-- 1) Tabela -------------------------------------------------------------------
create table if not exists public.audit_log (
  id          bigserial primary key,
  tabela      text        not null,
  registro_id text,
  acao        text        not null,               -- INSERT | UPDATE | DELETE
  antes       jsonb,
  depois      jsonb,
  usuario     text        not null default 'system',
  criado_em   timestamptz not null default now()
);

create index if not exists audit_log_criado_em_idx on public.audit_log (criado_em desc);
create index if not exists audit_log_tabela_idx    on public.audit_log (tabela, criado_em desc);
create index if not exists audit_log_registro_idx  on public.audit_log (tabela, registro_id);

comment on table public.audit_log is
  'Trilha de auditoria do painel /admin do app Luxashade/ShadeXP.';

-- 2) Função do gatilho --------------------------------------------------------
-- SECURITY DEFINER para conseguir gravar mesmo com RLS ligado na audit_log.
-- O usuário sai do e-mail do JWT (quem está logado no /admin); sem JWT = 'system'.
create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario text;
  v_antes   jsonb;
  v_depois  jsonb;
  v_id      text;
begin
  v_usuario := coalesce(
    nullif(current_setting('request.jwt.claims', true)::json ->> 'email', ''),
    'system'
  );

  if (tg_op = 'DELETE') then
    v_antes  := to_jsonb(old);
    v_depois := null;
    v_id     := v_antes ->> 'id';
  elsif (tg_op = 'INSERT') then
    v_antes  := null;
    v_depois := to_jsonb(new);
    v_id     := v_depois ->> 'id';
  else
    v_antes  := to_jsonb(old);
    v_depois := to_jsonb(new);
    v_id     := v_depois ->> 'id';
    -- Nada mudou de fato (ex.: só o updated_at) → não registra.
    if (v_antes - 'updated_at') = (v_depois - 'updated_at') then
      return null;
    end if;
  end if;

  insert into public.audit_log (tabela, registro_id, acao, antes, depois, usuario)
  values (tg_table_name, v_id, tg_op, v_antes, v_depois, v_usuario);

  return null; -- AFTER trigger
end;
$$;

revoke all on function public.audit_trigger() from public, anon, authenticated;

-- 3) Liga o gatilho nas tabelas do app ----------------------------------------
-- Só nas que existirem (o banco é compartilhado com outros apps).
do $$
declare
  t text;
  alvos text[] := array[
    'revendas',            -- desconto, acesso, vendedor… (o caso de 2026-08-20)
    'produtos',            -- preço m² e larg. máx por tecido
    'modelo_limites',      -- dimensões
    'colecoes', 'cores_tecido',
    'motores', 'motor_modelos',
    'opcionais', 'opcional_modelos', 'opcional_exclusoes',
    'trilho_produtos', 'trilho_componentes', 'trilho_modelos', 'trilho_curvas',
    'emissores', 'app_config', 'familias', 'modelos'
  ];
begin
  foreach t in array alvos loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists audit_%1$s on public.%1$I', t);
      execute format(
        'create trigger audit_%1$s after insert or update or delete on public.%1$I
           for each row execute function public.audit_trigger()', t);
    end if;
  end loop;
end $$;

-- 4) Acesso -------------------------------------------------------------------
-- Só quem está logado no painel lê o histórico. Ninguém escreve pela API
-- (só o gatilho, que roda como definer).
alter table public.audit_log enable row level security;

drop policy if exists audit_log_ro on public.audit_log;
create policy audit_log_ro on public.audit_log
  for select to authenticated using (true);

grant select on public.audit_log to authenticated;
revoke all on public.audit_log from anon;

-- 5) Conferência --------------------------------------------------------------
-- Depois de rodar, edite qualquer campo no /admin e rode:
--   select criado_em, usuario, tabela, acao, antes->>'desconto' as antes,
--          depois->>'desconto' as depois
--     from public.audit_log
--    where tabela = 'revendas'
--    order by criado_em desc limit 20;
