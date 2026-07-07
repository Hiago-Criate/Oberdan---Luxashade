-- ============================================================================
-- HISTÓRICO DE PEDIDOS/ORÇAMENTOS POR CNPJ  (app Luxashade / ShadeXP)
-- Rodar no SQL Editor do Supabase, projeto "autoai" (umvbrahsqvqeondwtikm).
-- Seguro: usa `create ... if not exists` / `create or replace`, não apaga nada.
--
-- Guarda cada pedido/orçamento finalizado atrelado ao CNPJ da revenda, para ela
-- reabrir/editar/reenviar depois. O app público (anon) acessa SOMENTE pelas
-- funções SECURITY DEFINER abaixo, sempre filtradas por CNPJ — mesmo padrão do
-- get_revenda_by_cnpj. A tabela em si fica com RLS ligada e sem policy p/ anon.
-- ============================================================================

create table if not exists public.pedidos (
  id             uuid primary key default gen_random_uuid(),
  cnpj           text not null,                       -- só dígitos
  marca          text not null,                       -- 'luxashade' | 'shadexp'
  tipo           text not null default 'orcamento',   -- 'orcamento' | 'pedido'
  numero         text,                                -- nº provisório do documento
  cliente_nome   text,
  cliente_fone   text,
  itens          jsonb not null default '[]'::jsonb,  -- carrinho (OrderItem[])
  subtotal       numeric not null default 0,
  desconto_pct   numeric not null default 0,
  desconto_valor numeric not null default 0,
  total          numeric not null default 0,
  revenda        jsonb,                               -- snapshot da revenda (nullable)
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists pedidos_cnpj_idx on public.pedidos (cnpj, atualizado_em desc);

alter table public.pedidos enable row level security;

-- Salva (upsert por id+cnpj) um pedido no histórico. Retorna o id salvo.
create or replace function public.salvar_pedido(
  p_id uuid, p_cnpj text, p_marca text, p_tipo text, p_numero text,
  p_cliente_nome text, p_cliente_fone text, p_itens jsonb,
  p_subtotal numeric, p_desconto_pct numeric, p_desconto_valor numeric,
  p_total numeric, p_revenda jsonb
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_cnpj text := regexp_replace(coalesce(p_cnpj,''), '[^0-9]', '', 'g');
  v_id uuid;
begin
  if v_cnpj = '' then raise exception 'cnpj vazio'; end if;
  if p_id is not null then
    update public.pedidos set
      marca = p_marca, tipo = coalesce(p_tipo, tipo), numero = p_numero,
      cliente_nome = p_cliente_nome, cliente_fone = p_cliente_fone,
      itens = coalesce(p_itens, '[]'::jsonb),
      subtotal = coalesce(p_subtotal,0), desconto_pct = coalesce(p_desconto_pct,0),
      desconto_valor = coalesce(p_desconto_valor,0), total = coalesce(p_total,0),
      revenda = p_revenda, atualizado_em = now()
    where id = p_id and cnpj = v_cnpj
    returning id into v_id;
    if v_id is not null then return v_id; end if;
  end if;
  insert into public.pedidos (cnpj, marca, tipo, numero, cliente_nome, cliente_fone,
    itens, subtotal, desconto_pct, desconto_valor, total, revenda)
  values (v_cnpj, p_marca, coalesce(p_tipo,'orcamento'), p_numero, p_cliente_nome, p_cliente_fone,
    coalesce(p_itens,'[]'::jsonb), coalesce(p_subtotal,0), coalesce(p_desconto_pct,0),
    coalesce(p_desconto_valor,0), coalesce(p_total,0), p_revenda)
  returning id into v_id;
  return v_id;
end;
$$;

-- Lista os pedidos de um CNPJ (mais recentes primeiro). Retorna SÓ o necessário
-- para a revenda ver/reabrir os pedidos dela. NÃO expõe desconto/margem, subtotal,
-- o snapshot da revenda (vendedor/telefone) nem o telefone do cliente — dados
-- sensíveis não saem no histórico anônimo (o desconto é recalculado no app pelo
-- cadastro vigente do CNPJ).
create or replace function public.listar_pedidos_by_cnpj(p_cnpj text)
returns table (
  id uuid, marca text, tipo text, numero text,
  cliente_nome text, itens jsonb, total numeric,
  criado_em timestamptz, atualizado_em timestamptz
) language sql stable security definer set search_path = public
as $$
  select id, marca, tipo, numero, cliente_nome, itens, total, criado_em, atualizado_em
  from public.pedidos
  where cnpj = regexp_replace(coalesce(p_cnpj,''), '[^0-9]', '', 'g')
    and regexp_replace(coalesce(p_cnpj,''), '[^0-9]', '', 'g') <> ''
  order by atualizado_em desc
  limit 200;
$$;

-- Exclui um pedido do histórico (só se o CNPJ bater).
create or replace function public.excluir_pedido(p_id uuid, p_cnpj text)
returns boolean language plpgsql security definer set search_path = public
as $$
declare v_count int;
begin
  delete from public.pedidos
  where id = p_id and cnpj = regexp_replace(coalesce(p_cnpj,''), '[^0-9]', '', 'g');
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

grant execute on function public.salvar_pedido(uuid,text,text,text,text,text,text,jsonb,numeric,numeric,numeric,numeric,jsonb) to anon, authenticated;
grant execute on function public.listar_pedidos_by_cnpj(text) to anon, authenticated;
grant execute on function public.excluir_pedido(uuid,text) to anon, authenticated;
