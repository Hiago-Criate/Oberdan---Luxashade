-- ============================================================================
-- SENHA DA REVENDA É DA REVENDA  (app Luxashade / ShadeXP)
-- Rodar no SQL Editor do Supabase, projeto "autoai" (umvbrahsqvqeondwtikm).
-- Seguro para rodar de novo.
--
-- POR QUE
--   Do jeito que estava, a Luxashade cadastrava a senha do administrador da
--   revenda no /admin e essa senha continuava valendo para sempre. Ou seja, a
--   Luxashade sabia a senha com que a revenda faz pedido. A revenda podia
--   contestar qualquer pedido dizendo "não fui eu, vocês têm a minha senha".
--   Isso é responsabilidade civil, não conforto. (Lilian, 10/09/2026)
--
-- O QUE MUDA
--   1. A senha cadastrada no /admin passa a ser TEMPORÁRIA. No primeiro acesso
--      o usuário é obrigado a criar a senha dele, e a nova precisa ser
--      diferente da temporária. A partir daí a Luxashade não sabe mais a senha.
--   2. Qualquer usuário pode trocar a PRÓPRIA senha quando quiser, informando
--      a senha atual.
--   3. A revenda pode ter MAIS DE UM administrador.
--
--   A trava do item 1 é do banco, não da tela: enquanto a senha for temporária
--   a sessão não faz mais nada além de trocar a senha. Não adianta mexer no
--   navegador para pular a tela.
--
--   Toda senha definida POR OUTRA PESSOA nasce temporária (a Luxashade criando
--   o admin, ou o admin criando/resetando um vendedor). Senha escolhida pelo
--   próprio dono, não.
-- ============================================================================

-- --------------------------------------------------------------- estrutura ---

-- Mais de um administrador por revenda.
drop index if exists public.revenda_usuarios_admin_uk;

alter table public.revenda_usuarios
  add column if not exists senha_temporaria boolean not null default false;

comment on column public.revenda_usuarios.senha_temporaria is
  'true = senha definida por outra pessoa; a sessão só pode trocar a senha até virar false.';

-- ----------------------------------------------------------------- helpers ---
-- Registra evento de acesso no histórico. NUNCA grava o hash da senha.
create or replace function public.log_acesso(
  p_id uuid, p_acao text, p_dados jsonb, p_quem text
) returns void language sql security definer set search_path = public
as $$
  insert into public.audit_log (tabela, registro_id, acao, antes, depois, usuario)
  values ('revenda_usuarios', p_id::text, p_acao, null, p_dados, coalesce(p_quem, 'system'));
$$;
revoke all on function public.log_acesso(uuid,text,jsonb,text) from public, anon, authenticated;

-- Passa a devolver `senha_temporaria` (muda o tipo de retorno, por isso o drop).
drop function if exists public.sessao_resolver(uuid);
create function public.sessao_resolver(p_token uuid)
returns table (usuario_id uuid, revenda_id uuid, papel text, login text,
               nome text, cnpj text, senha_temporaria boolean)
language sql stable security definer set search_path = public, extensions
as $$
  select u.id, u.revenda_id, u.papel, u.login, u.nome,
         regexp_replace(coalesce(r.cnpj,''), '[^0-9]', '', 'g'),
         u.senha_temporaria
    from public.revenda_sessoes s
    join public.revenda_usuarios u on u.id = s.usuario_id
    join public.revendas r         on r.id = u.revenda_id
   where s.token = p_token
     and s.expira_em > now()
     and u.ativo
     and coalesce(r.ativo, true);
$$;
revoke execute on function public.sessao_resolver(uuid) from anon, public, authenticated;

-- ------------------------------------------------------------ login/sessão ---
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

  if v_u.id is null or v_u.senha_hash <> extensions.crypt(p_senha, v_u.senha_hash) then
    return jsonb_build_object('ok', false, 'motivo', 'credenciais');
  end if;

  insert into public.revenda_sessoes (usuario_id) values (v_u.id) returning token into v_tok;
  update public.revenda_usuarios set ultimo_acesso = now() where id = v_u.id;

  return jsonb_build_object(
    'ok', true, 'token', v_tok,
    'usuario', jsonb_build_object('id', v_u.id, 'login', v_u.login, 'nome', v_u.nome,
                                  'papel', v_u.papel,
                                  'senha_temporaria', v_u.senha_temporaria)
  );
end;
$$;

create or replace function public.sessao_revenda(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_s record;
begin
  select * into v_s from public.sessao_resolver(p_token);
  if v_s.usuario_id is null then return jsonb_build_object('ok', false); end if;
  return jsonb_build_object('ok', true, 'cnpj', v_s.cnpj,
    'usuario', jsonb_build_object('id', v_s.usuario_id, 'login', v_s.login,
                                  'nome', v_s.nome, 'papel', v_s.papel,
                                  'senha_temporaria', v_s.senha_temporaria));
end;
$$;

-- ------------------------------------------------------- trocar minha senha ---
-- Qualquer usuário troca a PRÓPRIA senha. Pede a senha atual, exceto quando a
-- senha é temporária (aí o token já provou quem é, e cobrar de novo a senha que
-- a pessoa acabou de digitar não acrescenta nada).
--
-- A sessão em uso CONTINUA valendo; as outras sessões do mesmo usuário caem.
create or replace function public.trocar_minha_senha(
  p_token uuid, p_senha_atual text, p_nova text
) returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare v_s record; v_u public.revenda_usuarios%rowtype;
begin
  select * into v_s from public.sessao_resolver(p_token);
  if v_s.usuario_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'sessao');
  end if;

  select * into v_u from public.revenda_usuarios where id = v_s.usuario_id;

  if not v_u.senha_temporaria then
    if coalesce(p_senha_atual,'') = ''
       or v_u.senha_hash <> extensions.crypt(p_senha_atual, v_u.senha_hash) then
      return jsonb_build_object('ok', false, 'motivo', 'A senha atual está incorreta.');
    end if;
  end if;

  if length(coalesce(p_nova,'')) < 4 then
    return jsonb_build_object('ok', false, 'motivo', 'A nova senha precisa de pelo menos 4 caracteres.');
  end if;

  -- Sem isto a troca obrigatória seria teatro: a Luxashade continuaria sabendo
  -- a senha em uso.
  if v_u.senha_hash = extensions.crypt(p_nova, v_u.senha_hash) then
    return jsonb_build_object('ok', false, 'motivo', 'A nova senha precisa ser diferente da atual.');
  end if;

  update public.revenda_usuarios
     set senha_hash = extensions.crypt(p_nova, extensions.gen_salt('bf')),
         senha_temporaria = false
   where id = v_u.id;

  delete from public.revenda_sessoes where usuario_id = v_u.id and token <> p_token;

  perform public.log_acesso(v_u.id, 'SENHA_PROPRIA',
    jsonb_build_object('login', v_u.login, 'papel', v_u.papel, 'revenda_id', v_u.revenda_id),
    v_u.login);

  return jsonb_build_object('ok', true);
end;
$$;

-- ------------------------------------------------- pedidos com dono/sessão ---
-- Enquanto a senha for temporária, a sessão não faz nada além de trocar a senha.
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
  if v_s.usuario_id is null or v_s.senha_temporaria then return; end if;

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
  if v_s.senha_temporaria then raise exception 'troque a senha antes de continuar'; end if;

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
  if v_s.usuario_id is null or v_s.senha_temporaria then return false; end if;
  delete from public.pedidos
   where id = p_id and cnpj = v_s.cnpj
     and (v_s.papel = 'admin' or usuario_id = v_s.usuario_id);
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

-- ------------------------------ usuários da revenda (gerenciado pelo admin) ---
-- Ganhou a coluna `senha_temporaria`, e o Postgres não deixa `create or replace`
-- mudar o tipo de retorno. Por isso o drop.
drop function if exists public.listar_usuarios_revenda(uuid);
create function public.listar_usuarios_revenda(p_token uuid)
returns table (id uuid, login text, nome text, papel text, ativo boolean,
               criado_em timestamptz, ultimo_acesso timestamptz, pedidos bigint,
               senha_temporaria boolean)
language plpgsql stable security definer set search_path = public
as $$
declare v_s record;
begin
  select * into v_s from public.sessao_resolver(p_token);
  if v_s.usuario_id is null or v_s.papel <> 'admin' or v_s.senha_temporaria then return; end if;
  return query
    select u.id, u.login, u.nome, u.papel, u.ativo, u.criado_em, u.ultimo_acesso,
           (select count(*) from public.pedidos p where p.usuario_id = u.id),
           u.senha_temporaria
      from public.revenda_usuarios u
     where u.revenda_id = v_s.revenda_id
     order by (u.papel = 'admin') desc, lower(u.login);
end;
$$;

-- O admin cria um VENDEDOR ou outro ADMINISTRADOR. A senha nasce temporária:
-- quem foi criado troca no primeiro acesso e o criador deixa de saber a senha.
create or replace function public.criar_usuario_revenda(
  p_token uuid, p_login text, p_senha text, p_nome text, p_papel text
) returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_s     record;
  v_login text := lower(trim(coalesce(p_login,'')));
  v_papel text := case when lower(coalesce(p_papel,'')) = 'admin' then 'admin' else 'vendedor' end;
  v_id    uuid;
begin
  select * into v_s from public.sessao_resolver(p_token);
  if v_s.usuario_id is null or v_s.papel <> 'admin' then
    return jsonb_build_object('ok', false, 'motivo', 'sem permissão');
  end if;
  if v_s.senha_temporaria then
    return jsonb_build_object('ok', false, 'motivo', 'Troque a sua senha antes de criar usuários.');
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

  insert into public.revenda_usuarios (revenda_id, login, senha_hash, nome, papel, senha_temporaria)
  values (v_s.revenda_id, v_login,
          extensions.crypt(p_senha, extensions.gen_salt('bf')),
          nullif(trim(coalesce(p_nome,'')), ''), v_papel, true)
  returning id into v_id;

  perform public.log_acesso(v_id, 'USUARIO_CRIADO',
    jsonb_build_object('login', v_login, 'papel', v_papel, 'revenda_id', v_s.revenda_id),
    v_s.login);

  return jsonb_build_object('ok', true, 'id', v_id, 'login', v_login, 'papel', v_papel);
end;
$$;

-- Compatibilidade: a versão de 4 argumentos continua existindo e cria vendedor.
-- (O app publicado hoje chama esta; sem ela, ele quebraria entre o SQL e o deploy.)
create or replace function public.criar_usuario_revenda(
  p_token uuid, p_login text, p_senha text, p_nome text
) returns jsonb language sql security definer set search_path = public, extensions
as $$ select public.criar_usuario_revenda(p_token, p_login, p_senha, p_nome, 'vendedor'); $$;

-- O admin remove/desativa alguém da revenda dele.
-- Nunca a si mesmo e nunca o último administrador ativo (senão a revenda fica
-- sem quem gerencie e sem quem emita pedido).
create or replace function public.remover_usuario_revenda(p_token uuid, p_id uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_s record; v_alvo public.revenda_usuarios%rowtype; v_admins int;
begin
  select * into v_s from public.sessao_resolver(p_token);
  if v_s.usuario_id is null or v_s.papel <> 'admin' then
    return jsonb_build_object('ok', false, 'motivo', 'sem permissão');
  end if;
  if v_s.senha_temporaria then
    return jsonb_build_object('ok', false, 'motivo', 'Troque a sua senha antes de continuar.');
  end if;

  select * into v_alvo from public.revenda_usuarios
   where id = p_id and revenda_id = v_s.revenda_id;
  if v_alvo.id is null then return jsonb_build_object('ok', false, 'motivo', 'não encontrado'); end if;

  if v_alvo.id = v_s.usuario_id then
    return jsonb_build_object('ok', false, 'motivo', 'Você não pode remover o seu próprio acesso.');
  end if;

  if v_alvo.papel = 'admin' and v_alvo.ativo then
    select count(*) into v_admins from public.revenda_usuarios
     where revenda_id = v_s.revenda_id and papel = 'admin' and ativo;
    if v_admins <= 1 then
      return jsonb_build_object('ok', false, 'motivo',
        'Esta revenda ficaria sem administrador. Crie outro antes de remover este.');
    end if;
  end if;

  if exists (select 1 from public.pedidos where usuario_id = v_alvo.id) then
    update public.revenda_usuarios set ativo = false where id = v_alvo.id;
    delete from public.revenda_sessoes where usuario_id = v_alvo.id;
    perform public.log_acesso(v_alvo.id, 'USUARIO_DESATIVADO',
      jsonb_build_object('login', v_alvo.login, 'papel', v_alvo.papel), v_s.login);
    return jsonb_build_object('ok', true, 'acao', 'desativado');
  end if;

  perform public.log_acesso(v_alvo.id, 'USUARIO_REMOVIDO',
    jsonb_build_object('login', v_alvo.login, 'papel', v_alvo.papel), v_s.login);
  delete from public.revenda_usuarios where id = v_alvo.id;
  return jsonb_build_object('ok', true, 'acao', 'removido');
end;
$$;

-- O admin reseta a senha de OUTRO usuário da revenda. Nasce temporária: quem
-- recebeu troca no primeiro acesso e o admin deixa de saber a senha.
-- A própria senha se troca em `trocar_minha_senha`.
create or replace function public.trocar_senha_usuario_revenda(
  p_token uuid, p_id uuid, p_senha text
) returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare v_s record; v_alvo public.revenda_usuarios%rowtype;
begin
  select * into v_s from public.sessao_resolver(p_token);
  if v_s.usuario_id is null or v_s.papel <> 'admin' then
    return jsonb_build_object('ok', false, 'motivo', 'sem permissão');
  end if;
  if v_s.senha_temporaria then
    return jsonb_build_object('ok', false, 'motivo', 'Troque a sua senha antes de continuar.');
  end if;
  if length(coalesce(p_senha,'')) < 4 then
    return jsonb_build_object('ok', false, 'motivo', 'A senha precisa de pelo menos 4 caracteres.');
  end if;
  if p_id = v_s.usuario_id then
    return jsonb_build_object('ok', false, 'motivo', 'Use "Trocar a minha senha".');
  end if;

  select * into v_alvo from public.revenda_usuarios
   where id = p_id and revenda_id = v_s.revenda_id;
  if v_alvo.id is null then return jsonb_build_object('ok', false, 'motivo', 'não encontrado'); end if;

  update public.revenda_usuarios
     set senha_hash = extensions.crypt(p_senha, extensions.gen_salt('bf')),
         senha_temporaria = true
   where id = p_id;
  delete from public.revenda_sessoes where usuario_id = p_id;

  perform public.log_acesso(p_id, 'SENHA_RESETADA_PELO_ADMIN',
    jsonb_build_object('login', v_alvo.login, 'papel', v_alvo.papel), v_s.login);

  return jsonb_build_object('ok', true, 'temporaria', true);
end;
$$;

-- ------------------------- painel da Luxashade (/admin, usuário autenticado) ---
-- Cria um administrador da revenda, ou reseta a senha de um que já existe
-- (casando pelo login). A revenda pode ter vários. A senha SEMPRE nasce
-- temporária: no primeiro acesso a pessoa troca, e a Luxashade deixa de saber.
create or replace function public.admin_definir_admin_revenda(
  p_revenda_id uuid, p_login text, p_senha text, p_nome text
) returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare v_login text := lower(trim(coalesce(p_login,''))); v_id uuid; v_quem text;
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

  v_quem := coalesce(nullif(auth.jwt() ->> 'email', ''), 'painel');

  select id into v_id from public.revenda_usuarios
   where revenda_id = p_revenda_id and lower(login) = v_login;

  if v_id is null then
    insert into public.revenda_usuarios (revenda_id, login, senha_hash, nome, papel, senha_temporaria)
    values (p_revenda_id, v_login,
            extensions.crypt(p_senha, extensions.gen_salt('bf')),
            nullif(trim(coalesce(p_nome,'')), ''), 'admin', true)
    returning id into v_id;
    perform public.log_acesso(v_id, 'ADMIN_CRIADO_PELO_PAINEL',
      jsonb_build_object('login', v_login, 'revenda_id', p_revenda_id), v_quem);
    return jsonb_build_object('ok', true, 'acao', 'criado', 'id', v_id, 'temporaria', true);
  end if;

  update public.revenda_usuarios
     set senha_hash = extensions.crypt(p_senha, extensions.gen_salt('bf')),
         nome = coalesce(nullif(trim(coalesce(p_nome,'')), ''), nome),
         papel = 'admin',
         ativo = true,
         senha_temporaria = true
   where id = v_id;
  delete from public.revenda_sessoes where usuario_id = v_id;

  perform public.log_acesso(v_id, 'SENHA_RESETADA_PELO_PAINEL',
    jsonb_build_object('login', v_login, 'revenda_id', p_revenda_id), v_quem);

  return jsonb_build_object('ok', true, 'acao', 'atualizado', 'id', v_id, 'temporaria', true);
end;
$$;

-- Situação do login de cada revenda, para o painel mostrar na lista.
-- Agora conta quantos administradores existem e se alguém ainda está com senha
-- temporária (ou seja, ainda não trocou no primeiro acesso).
drop function if exists public.admin_login_revendas();
create function public.admin_login_revendas()
returns table (revenda_id uuid, admin_login text, admin_ativo boolean,
               usuarios bigint, admins bigint, temporarias bigint)
language sql stable security definer set search_path = public
as $$
  select r.id,
         (select u.login from public.revenda_usuarios u
           where u.revenda_id = r.id and u.papel = 'admin' and u.ativo
           order by u.criado_em limit 1),
         (select u.ativo from public.revenda_usuarios u
           where u.revenda_id = r.id and u.papel = 'admin' and u.ativo
           order by u.criado_em limit 1),
         (select count(*) from public.revenda_usuarios u where u.revenda_id = r.id and u.ativo),
         (select count(*) from public.revenda_usuarios u
           where u.revenda_id = r.id and u.ativo and u.papel = 'admin'),
         (select count(*) from public.revenda_usuarios u
           where u.revenda_id = r.id and u.ativo and u.senha_temporaria)
    from public.revendas r
   where public.eh_painel_admin();
$$;

-- ----------------------------------------------------------------- grants ---
grant execute on function public.trocar_minha_senha(uuid,text,text)                     to anon, authenticated;
grant execute on function public.criar_usuario_revenda(uuid,text,text,text,text)        to anon, authenticated;
grant execute on function public.criar_usuario_revenda(uuid,text,text,text)             to anon, authenticated;
grant execute on function public.listar_usuarios_revenda(uuid)                          to anon, authenticated;
grant execute on function public.listar_pedidos_sessao(uuid)                            to anon, authenticated;
grant execute on function public.remover_usuario_revenda(uuid,uuid)                     to anon, authenticated;
grant execute on function public.trocar_senha_usuario_revenda(uuid,uuid,text)           to anon, authenticated;

revoke execute on function public.admin_login_revendas() from anon, public;
grant  execute on function public.admin_login_revendas() to authenticated;

-- ------------------------------------------------------------ conferência ---
-- select login, papel, senha_temporaria from public.revenda_usuarios;
-- select criado_em, usuario, acao, depois->>'login'
--   from public.audit_log where tabela = 'revenda_usuarios' order by id desc limit 20;
