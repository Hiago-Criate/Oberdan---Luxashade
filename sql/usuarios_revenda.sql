-- ============================================================================
-- LOGIN POR USUÁRIO DENTRO DA REVENDA  (app Luxashade / ShadeXP)
-- Rodar no SQL Editor do Supabase, projeto "autoai" (umvbrahsqvqeondwtikm).
-- Seguro para rodar de novo: usa "if not exists" / "create or replace".
--
-- COMO FUNCIONA
--   A revenda continua entrando pelo CNPJ. Depois do CNPJ:
--     • se a revenda AINDA NÃO tem usuário cadastrado -> entra direto (como hoje);
--     • se já tem -> aparece a tela de login (usuário + senha).
--   Isso permite ligar o recurso revenda por revenda, sem travar ninguém.
--
--   Dois papéis:
--     • 'admin'    -> um por revenda, criado pela Luxashade no /admin.
--                     Gera ORÇAMENTO e PEDIDO, vê os orçamentos de TODOS os
--                     vendedores e cria/remove os usuários da revenda.
--     • 'vendedor' -> criado pelo admin da revenda. Gera SÓ orçamento e vê
--                     SOMENTE os próprios.
--
-- SEGURANÇA
--   Senha guardada com hash bcrypt (pgcrypto), nunca em texto puro e nunca lida
--   pelo app. O login devolve um TOKEN de sessão (uuid, validade 30 dias) e todas
--   as operações seguintes recebem esse token: quem é o usuário e o que ele pode
--   ver é decidido AQUI no banco, não no navegador. As tabelas ficam com RLS
--   ligada e sem policy para anon: o acesso é só pelas funções abaixo.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tabelas ---
create table if not exists public.revenda_usuarios (
  id            uuid primary key default gen_random_uuid(),
  revenda_id    uuid not null references public.revendas(id) on delete cascade,
  login         text not null,
  senha_hash    text not null,
  nome          text,
  papel         text not null default 'vendedor',   -- 'admin' | 'vendedor'
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  ultimo_acesso timestamptz,
  constraint revenda_usuarios_papel_ck check (papel in ('admin', 'vendedor'))
);

-- login único dentro da revenda (sem diferenciar maiúsculas/minúsculas)
create unique index if not exists revenda_usuarios_login_uk
  on public.revenda_usuarios (revenda_id, lower(login));

-- no máximo UM admin por revenda
create unique index if not exists revenda_usuarios_admin_uk
  on public.revenda_usuarios (revenda_id) where papel = 'admin';

create table if not exists public.revenda_sessoes (
  token      uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.revenda_usuarios(id) on delete cascade,
  criado_em  timestamptz not null default now(),
  expira_em  timestamptz not null default (now() + interval '30 days')
);
create index if not exists revenda_sessoes_usuario_idx on public.revenda_sessoes (usuario_id);

-- Cada pedido passa a saber QUEM o criou (null = anterior ao login, só o admin vê).
alter table public.pedidos add column if not exists usuario_id uuid
  references public.revenda_usuarios(id) on delete set null;
create index if not exists pedidos_usuario_idx on public.pedidos (usuario_id, atualizado_em desc);

alter table public.revenda_usuarios enable row level security;
alter table public.revenda_sessoes  enable row level security;

-- Quem é a Luxashade no painel /admin. Estar logado no Supabase Auth NÃO basta:
-- este projeto é compartilhado com outros sistemas da Criate e tem várias contas.
-- Só os e-mails desta lista mexem no login das revendas.
create table if not exists public.painel_admins (
  email     text primary key,
  criado_em timestamptz not null default now()
);
alter table public.painel_admins enable row level security;   -- sem policy: ninguém lê direto

insert into public.painel_admins (email) values
  ('admin@luxashade.app'),
  ('hiagovieira@criatehub.com.br')
on conflict (email) do nothing;

create or replace function public.eh_painel_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.painel_admins
     where lower(email) = lower(nullif(auth.jwt() ->> 'email', ''))
  );
$$;

-- --------------------------------------------------------------- helpers ---
-- Resolve o token numa sessão válida. Devolve o usuário + a revenda dele.
create or replace function public.sessao_resolver(p_token uuid)
returns table (usuario_id uuid, revenda_id uuid, papel text, login text, nome text, cnpj text)
language sql stable security definer set search_path = public, extensions
as $$
  select u.id, u.revenda_id, u.papel, u.login, u.nome,
         regexp_replace(coalesce(r.cnpj,''), '[^0-9]', '', 'g')
    from public.revenda_sessoes s
    join public.revenda_usuarios u on u.id = s.usuario_id
    join public.revendas r         on r.id = u.revenda_id
   where s.token = p_token
     and s.expira_em > now()
     and u.ativo
     and coalesce(r.ativo, true);
$$;

-- ------------------------------------------------------------ login/sessão ---
-- A revenda deste CNPJ já usa login? (false -> o app entra direto, como antes)
create or replace function public.revenda_exige_login(p_cnpj text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.revenda_usuarios u
      join public.revendas r on r.id = u.revenda_id
     where u.ativo
       and regexp_replace(coalesce(r.cnpj,''), '[^0-9]', '', 'g')
         = regexp_replace(coalesce(p_cnpj,''), '[^0-9]', '', 'g')
       and regexp_replace(coalesce(p_cnpj,''), '[^0-9]', '', 'g') <> ''
  );
$$;

-- Login do usuário da revenda. Devolve o token da sessão + quem é.
create or replace function public.login_revenda(p_cnpj text, p_login text, p_senha text)
returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_cnpj text := regexp_replace(coalesce(p_cnpj,''), '[^0-9]', '', 'g');
  v_u    public.revenda_usuarios%rowtype;
  v_tok  uuid;
begin
  if v_cnpj = '' or coalesce(p_login,'') = '' or coalesce(p_senha,'') = '' then
    return jsonb_build_object('ok', false, 'motivo', 'dados');
  end if;

  select u.* into v_u
    from public.revenda_usuarios u
    join public.revendas r on r.id = u.revenda_id
   where u.ativo
     and coalesce(r.ativo, true)
     and lower(u.login) = lower(trim(p_login))
     and regexp_replace(coalesce(r.cnpj,''), '[^0-9]', '', 'g') = v_cnpj
   limit 1;

  -- Mesma resposta para usuário inexistente e senha errada (não entrega dica).
  if v_u.id is null or v_u.senha_hash <> extensions.crypt(p_senha, v_u.senha_hash) then
    return jsonb_build_object('ok', false, 'motivo', 'credenciais');
  end if;

  insert into public.revenda_sessoes (usuario_id) values (v_u.id) returning token into v_tok;
  update public.revenda_usuarios set ultimo_acesso = now() where id = v_u.id;

  return jsonb_build_object(
    'ok', true, 'token', v_tok,
    'usuario', jsonb_build_object('id', v_u.id, 'login', v_u.login, 'nome', v_u.nome, 'papel', v_u.papel)
  );
end;
$$;

-- Retoma a sessão guardada no navegador (ou diz que expirou).
create or replace function public.sessao_revenda(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_s record;
begin
  select * into v_s from public.sessao_resolver(p_token);
  if v_s.usuario_id is null then return jsonb_build_object('ok', false); end if;
  return jsonb_build_object('ok', true, 'cnpj', v_s.cnpj,
    'usuario', jsonb_build_object('id', v_s.usuario_id, 'login', v_s.login,
                                  'nome', v_s.nome, 'papel', v_s.papel));
end;
$$;

create or replace function public.logout_revenda(p_token uuid)
returns boolean language sql security definer set search_path = public
as $$ delete from public.revenda_sessoes where token = p_token returning true; $$;

-- ------------------------------------------------- pedidos com dono/sessão ---
-- Admin vê os pedidos de TODA a revenda; vendedor vê SÓ os dele.
-- Pedidos antigos (usuario_id null) aparecem só para o admin.
create or replace function public.listar_pedidos_sessao(p_token uuid)
returns table (
  id uuid, marca text, tipo text, numero text, cliente_nome text,
  itens jsonb, total numeric, criado_em timestamptz, atualizado_em timestamptz,
  autor text, meu boolean
) language plpgsql stable security definer set search_path = public
as $$
declare v_s record;
begin
  select * into v_s from public.sessao_resolver(p_token);
  if v_s.usuario_id is null then return; end if;

  return query
    select p.id, p.marca, p.tipo, p.numero, p.cliente_nome, p.itens, p.total,
           p.criado_em, p.atualizado_em,
           coalesce(a.nome, a.login, '—') as autor,
           (p.usuario_id = v_s.usuario_id) as meu
      from public.pedidos p
      left join public.revenda_usuarios a on a.id = p.usuario_id
     where p.cnpj = v_s.cnpj
       and (v_s.papel = 'admin' or p.usuario_id = v_s.usuario_id)
     order by p.atualizado_em desc
     limit 200;
end;
$$;

create or replace function public.salvar_pedido_sessao(
  p_token uuid, p_id uuid, p_marca text, p_tipo text, p_numero text,
  p_cliente_nome text, p_cliente_fone text, p_itens jsonb,
  p_subtotal numeric, p_desconto_pct numeric, p_desconto_valor numeric,
  p_total numeric, p_revenda jsonb
) returns uuid language plpgsql security definer set search_path = public
as $$
declare v_s record; v_id uuid;
begin
  select * into v_s from public.sessao_resolver(p_token);
  if v_s.usuario_id is null then raise exception 'sessao invalida'; end if;

  -- Vendedor não emite PEDIDO de fábrica, só orçamento.
  if p_tipo = 'pedido' and v_s.papel <> 'admin' then
    raise exception 'somente o administrador da revenda pode gerar pedido';
  end if;

  if p_id is not null then
    update public.pedidos set
      marca = p_marca, tipo = coalesce(p_tipo, tipo), numero = p_numero,
      cliente_nome = p_cliente_nome, cliente_fone = p_cliente_fone,
      itens = coalesce(p_itens, '[]'::jsonb),
      subtotal = coalesce(p_subtotal,0), desconto_pct = coalesce(p_desconto_pct,0),
      desconto_valor = coalesce(p_desconto_valor,0), total = coalesce(p_total,0),
      revenda = p_revenda, atualizado_em = now()
    where id = p_id and cnpj = v_s.cnpj
      and (v_s.papel = 'admin' or usuario_id = v_s.usuario_id)
    returning id into v_id;
    if v_id is not null then return v_id; end if;
  end if;

  insert into public.pedidos (cnpj, marca, tipo, numero, cliente_nome, cliente_fone,
    itens, subtotal, desconto_pct, desconto_valor, total, revenda, usuario_id)
  values (v_s.cnpj, p_marca, coalesce(p_tipo,'orcamento'), p_numero, p_cliente_nome,
    p_cliente_fone, coalesce(p_itens,'[]'::jsonb), coalesce(p_subtotal,0),
    coalesce(p_desconto_pct,0), coalesce(p_desconto_valor,0), coalesce(p_total,0),
    p_revenda, v_s.usuario_id)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.excluir_pedido_sessao(p_token uuid, p_id uuid)
returns boolean language plpgsql security definer set search_path = public
as $$
declare v_s record; v_count int;
begin
  select * into v_s from public.sessao_resolver(p_token);
  if v_s.usuario_id is null then return false; end if;
  delete from public.pedidos
   where id = p_id and cnpj = v_s.cnpj
     and (v_s.papel = 'admin' or usuario_id = v_s.usuario_id);
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

-- ------------------------------ usuários da revenda (gerenciado pelo admin) ---
create or replace function public.listar_usuarios_revenda(p_token uuid)
returns table (id uuid, login text, nome text, papel text, ativo boolean,
               criado_em timestamptz, ultimo_acesso timestamptz, pedidos bigint)
language plpgsql stable security definer set search_path = public
as $$
declare v_s record;
begin
  select * into v_s from public.sessao_resolver(p_token);
  if v_s.usuario_id is null or v_s.papel <> 'admin' then return; end if;
  return query
    select u.id, u.login, u.nome, u.papel, u.ativo, u.criado_em, u.ultimo_acesso,
           (select count(*) from public.pedidos p where p.usuario_id = u.id)
      from public.revenda_usuarios u
     where u.revenda_id = v_s.revenda_id
     order by (u.papel = 'admin') desc, lower(u.login);
end;
$$;

-- O admin da revenda cria um VENDEDOR.
create or replace function public.criar_usuario_revenda(
  p_token uuid, p_login text, p_senha text, p_nome text
) returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare v_s record; v_login text := lower(trim(coalesce(p_login,''))); v_id uuid;
begin
  select * into v_s from public.sessao_resolver(p_token);
  if v_s.usuario_id is null or v_s.papel <> 'admin' then
    return jsonb_build_object('ok', false, 'motivo', 'sem permissão');
  end if;
  if length(v_login) < 3 then
    return jsonb_build_object('ok', false, 'motivo', 'O usuário precisa de pelo menos 3 caracteres.');
  end if;
  if length(coalesce(p_senha,'')) < 4 then
    return jsonb_build_object('ok', false, 'motivo', 'A senha precisa de pelo menos 4 caracteres.');
  end if;
  if exists (select 1 from public.revenda_usuarios
              where revenda_id = v_s.revenda_id and lower(login) = v_login) then
    return jsonb_build_object('ok', false, 'motivo', 'Já existe um usuário com esse login.');
  end if;

  insert into public.revenda_usuarios (revenda_id, login, senha_hash, nome, papel)
  values (v_s.revenda_id, v_login,
          extensions.crypt(p_senha, extensions.gen_salt('bf')),
          nullif(trim(coalesce(p_nome,'')), ''), 'vendedor')
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'login', v_login);
end;
$$;

-- O admin remove/desativa um vendedor (nunca a si mesmo, nunca outro admin).
create or replace function public.remover_usuario_revenda(p_token uuid, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_s record; v_alvo public.revenda_usuarios%rowtype;
begin
  select * into v_s from public.sessao_resolver(p_token);
  if v_s.usuario_id is null or v_s.papel <> 'admin' then
    return jsonb_build_object('ok', false, 'motivo', 'sem permissão');
  end if;
  select * into v_alvo from public.revenda_usuarios
   where id = p_id and revenda_id = v_s.revenda_id;
  if v_alvo.id is null then return jsonb_build_object('ok', false, 'motivo', 'não encontrado'); end if;
  if v_alvo.papel = 'admin' then
    return jsonb_build_object('ok', false, 'motivo', 'O administrador não pode ser removido aqui.');
  end if;

  -- Tem pedido no histórico? Então só desativa, para não perder o vínculo.
  if exists (select 1 from public.pedidos where usuario_id = v_alvo.id) then
    update public.revenda_usuarios set ativo = false where id = v_alvo.id;
    delete from public.revenda_sessoes where usuario_id = v_alvo.id;
    return jsonb_build_object('ok', true, 'acao', 'desativado');
  end if;

  delete from public.revenda_usuarios where id = v_alvo.id;
  return jsonb_build_object('ok', true, 'acao', 'removido');
end;
$$;

-- O admin troca a senha de um vendedor da revenda dele.
create or replace function public.trocar_senha_usuario_revenda(
  p_token uuid, p_id uuid, p_senha text
) returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare v_s record;
begin
  select * into v_s from public.sessao_resolver(p_token);
  if v_s.usuario_id is null or v_s.papel <> 'admin' then
    return jsonb_build_object('ok', false, 'motivo', 'sem permissão');
  end if;
  if length(coalesce(p_senha,'')) < 4 then
    return jsonb_build_object('ok', false, 'motivo', 'A senha precisa de pelo menos 4 caracteres.');
  end if;
  -- Trocar a própria senha apagaria a própria sessão no meio do uso. A senha do
  -- administrador é definida pela Luxashade no /admin.
  if p_id = v_s.usuario_id then
    return jsonb_build_object('ok', false, 'motivo',
      'Para trocar a sua própria senha, fale com a Luxashade.');
  end if;
  update public.revenda_usuarios
     set senha_hash = extensions.crypt(p_senha, extensions.gen_salt('bf'))
   where id = p_id and revenda_id = v_s.revenda_id;
  if not found then return jsonb_build_object('ok', false, 'motivo', 'não encontrado'); end if;
  delete from public.revenda_sessoes where usuario_id = p_id;   -- derruba sessões antigas
  return jsonb_build_object('ok', true);
end;
$$;

-- ------------------------- painel da Luxashade (/admin, usuário autenticado) ---
-- Cria ou atualiza o ADMINISTRADOR de uma revenda. É por aqui que a Luxashade
-- liga o login para aquela revenda.
create or replace function public.admin_definir_admin_revenda(
  p_revenda_id uuid, p_login text, p_senha text, p_nome text
) returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare v_login text := lower(trim(coalesce(p_login,''))); v_id uuid;
begin
  if not public.eh_painel_admin() then
    return jsonb_build_object('ok', false, 'motivo', 'sem permissão neste painel');
  end if;
  if length(v_login) < 3 then
    return jsonb_build_object('ok', false, 'motivo', 'O usuário precisa de pelo menos 3 caracteres.');
  end if;
  if length(coalesce(p_senha,'')) < 4 then
    return jsonb_build_object('ok', false, 'motivo', 'A senha precisa de pelo menos 4 caracteres.');
  end if;
  if not exists (select 1 from public.revendas where id = p_revenda_id) then
    return jsonb_build_object('ok', false, 'motivo', 'revenda não encontrada');
  end if;
  -- login não pode colidir com um vendedor já existente da mesma revenda
  if exists (select 1 from public.revenda_usuarios
              where revenda_id = p_revenda_id and lower(login) = v_login and papel <> 'admin') then
    return jsonb_build_object('ok', false, 'motivo', 'Já existe um vendedor com esse login.');
  end if;

  select id into v_id from public.revenda_usuarios
   where revenda_id = p_revenda_id and papel = 'admin';

  if v_id is null then
    insert into public.revenda_usuarios (revenda_id, login, senha_hash, nome, papel)
    values (p_revenda_id, v_login,
            extensions.crypt(p_senha, extensions.gen_salt('bf')),
            nullif(trim(coalesce(p_nome,'')), ''), 'admin')
    returning id into v_id;
    return jsonb_build_object('ok', true, 'acao', 'criado', 'id', v_id);
  end if;

  update public.revenda_usuarios
     set login = v_login,
         senha_hash = extensions.crypt(p_senha, extensions.gen_salt('bf')),
         nome = coalesce(nullif(trim(coalesce(p_nome,'')), ''), nome),
         ativo = true
   where id = v_id;
  delete from public.revenda_sessoes where usuario_id = v_id;
  return jsonb_build_object('ok', true, 'acao', 'atualizado', 'id', v_id);
end;
$$;

-- Situação do login de cada revenda, para o painel mostrar na lista.
create or replace function public.admin_login_revendas()
returns table (revenda_id uuid, admin_login text, admin_ativo boolean, usuarios bigint)
language sql stable security definer set search_path = public
as $$
  select r.id,
         (select u.login from public.revenda_usuarios u
           where u.revenda_id = r.id and u.papel = 'admin' limit 1),
         (select u.ativo from public.revenda_usuarios u
           where u.revenda_id = r.id and u.papel = 'admin' limit 1),
         (select count(*) from public.revenda_usuarios u where u.revenda_id = r.id and u.ativo)
    from public.revendas r
   where public.eh_painel_admin();
$$;

-- ----------------------------------------------------------------- grants ---
grant execute on function public.revenda_exige_login(text)                              to anon, authenticated;
grant execute on function public.login_revenda(text,text,text)                          to anon, authenticated;
grant execute on function public.sessao_revenda(uuid)                                   to anon, authenticated;
grant execute on function public.logout_revenda(uuid)                                   to anon, authenticated;
grant execute on function public.listar_pedidos_sessao(uuid)                            to anon, authenticated;
grant execute on function public.salvar_pedido_sessao(uuid,uuid,text,text,text,text,text,jsonb,numeric,numeric,numeric,numeric,jsonb) to anon, authenticated;
grant execute on function public.excluir_pedido_sessao(uuid,uuid)                       to anon, authenticated;
grant execute on function public.listar_usuarios_revenda(uuid)                          to anon, authenticated;
grant execute on function public.criar_usuario_revenda(uuid,text,text,text)             to anon, authenticated;
grant execute on function public.remover_usuario_revenda(uuid,uuid)                     to anon, authenticated;
grant execute on function public.trocar_senha_usuario_revenda(uuid,uuid,text)           to anon, authenticated;

-- Só o painel (usuário logado no Supabase Auth) mexe no admin da revenda.
revoke execute on function public.admin_definir_admin_revenda(uuid,text,text,text) from anon, public;
grant  execute on function public.admin_definir_admin_revenda(uuid,text,text,text) to authenticated;
revoke execute on function public.admin_login_revendas() from anon, public;
grant  execute on function public.admin_login_revendas() to authenticated;
revoke execute on function public.eh_painel_admin() from anon, public;
grant  execute on function public.eh_painel_admin() to authenticated;

-- `sessao_resolver` é uso interno das funções acima.
revoke execute on function public.sessao_resolver(uuid) from anon, public, authenticated;

-- ------------------------------------------------------------ conferência ---
-- select * from public.admin_login_revendas() limit 5;
-- select public.revenda_exige_login('29602013000112');

-- ============================================================================
-- FECHANDO O CAMINHO ANTIGO (sem token)
--
-- As três funções de sql/pedidos.sql (salvar_pedido, listar_pedidos_by_cnpj e
-- excluir_pedido) filtram SÓ pelo CNPJ e estão liberadas para `anon`. O CNPJ não
-- é segredo (sai em nota fiscal e no PDF do orçamento) e a chave publishable vai
-- no bundle do site, então, se elas continuarem como estão, o login não vale
-- nada: dava para listar e apagar orçamento de qualquer vendedor e gravar
-- `tipo='pedido'` sem ser admin, por fora do app.
--
-- Não dá para simplesmente revogar: as revendas que ainda NÃO têm login usam
-- esse caminho. Então elas passam a recusar exatamente quando a revenda já
-- ligou o login. Quem não migrou continua funcionando igual; quem migrou só
-- entra com token.
-- ============================================================================

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
  if public.revenda_exige_login(v_cnpj) then
    raise exception 'esta revenda usa login: entre com usuario e senha';
  end if;

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

create or replace function public.listar_pedidos_by_cnpj(p_cnpj text)
returns table (
  id uuid, marca text, tipo text, numero text,
  cliente_nome text, itens jsonb, total numeric,
  criado_em timestamptz, atualizado_em timestamptz
) language plpgsql stable security definer set search_path = public
as $$
declare v_cnpj text := regexp_replace(coalesce(p_cnpj,''), '[^0-9]', '', 'g');
begin
  if v_cnpj = '' then return; end if;
  if public.revenda_exige_login(v_cnpj) then
    raise exception 'esta revenda usa login: entre com usuario e senha';
  end if;
  return query
    select p.id, p.marca, p.tipo, p.numero, p.cliente_nome, p.itens, p.total,
           p.criado_em, p.atualizado_em
      from public.pedidos p
     where p.cnpj = v_cnpj
     order by p.atualizado_em desc
     limit 200;
end;
$$;

create or replace function public.excluir_pedido(p_id uuid, p_cnpj text)
returns boolean language plpgsql security definer set search_path = public
as $$
declare
  v_cnpj text := regexp_replace(coalesce(p_cnpj,''), '[^0-9]', '', 'g');
  v_count int;
begin
  if v_cnpj = '' then return false; end if;
  if public.revenda_exige_login(v_cnpj) then
    raise exception 'esta revenda usa login: entre com usuario e senha';
  end if;
  delete from public.pedidos where id = p_id and cnpj = v_cnpj;
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;
