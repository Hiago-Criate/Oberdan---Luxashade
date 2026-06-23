-- Tabela de REVENDAS (clientes que terão acesso ao app Luxashade / ShadeXP).
-- Rode UMA vez no Supabase → SQL Editor (projeto jlfzjhkeebqchfqrdwer).
-- Depois a aba "Revendas" no /admin passa a salvar e listar normalmente.
--
-- Campos espelham a planilha da Lília (Filial, Código, Loja, Nome, Desconto,
-- Vendedor, Cód. Vendedor, Marca) + Telefone e CNPJ pedidos pelo Hiago.
-- `acesso` controla quais apps a revenda enxerga:
--   'LUXA'  = só Luxashade
--   'SXP'   = só ShadeXP
--   'AMBOS' = as duas (a revenda escolhe ao entrar)   [= "LUXA/SXP" da planilha]

create table if not exists public.revendas (
  id           uuid primary key default gen_random_uuid(),
  codigo       text,
  loja         text default '01',
  filial       text default '01',
  nome         text not null default 'Nova revenda',
  telefone     text,
  cnpj         text,
  desconto     numeric not null default 0,
  vendedor     text,
  cod_vendedor text,
  acesso       text not null default 'AMBOS',   -- 'LUXA' | 'SXP' | 'AMBOS'
  ativo        boolean not null default true,
  criado_em    timestamptz not null default now()
);

-- RLS: só usuários autenticados (admin) leem/escrevem — mesma postura dos demais
-- cadastros do painel. O app público NÃO lê esta tabela por enquanto.
alter table public.revendas enable row level security;

drop policy if exists "revendas_admin_all" on public.revendas;
create policy "revendas_admin_all" on public.revendas
  for all to authenticated using (true) with check (true);

-- Identifica a revenda pelo CNPJ (compara só os dígitos) para o app aplicar o
-- desconto e preencher os dados do cliente no orçamento/PDF. SECURITY DEFINER +
-- grant a anon: o app público chama, mas só recebe dados de UM CNPJ informado —
-- nunca a tabela inteira. Retorna a 1ª revenda ATIVA com aquele CNPJ.
create or replace function public.get_revenda_by_cnpj(p_cnpj text)
returns table (
  nome text, desconto numeric, acesso text, vendedor text,
  cod_vendedor text, telefone text, codigo text, loja text, filial text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.nome, r.desconto, r.acesso, r.vendedor,
         r.cod_vendedor, r.telefone, r.codigo, r.loja, r.filial
  from public.revendas r
  where r.ativo
    and regexp_replace(coalesce(r.cnpj, ''), '[^0-9]', '', 'g') =
        regexp_replace(coalesce(p_cnpj, ''), '[^0-9]', '', 'g')
    and regexp_replace(coalesce(p_cnpj, ''), '[^0-9]', '', 'g') <> ''
  limit 1;
$$;

grant execute on function public.get_revenda_by_cnpj(text) to anon, authenticated;
