-- ============================================================================
-- /admin: EDITAR, RESETAR SENHA E REMOVER LOGINS DAS REVENDAS
-- Rodar UMA VEZ no SQL Editor do Supabase, projeto "autoai" (umvbrahsqvqeondwtikm).
-- Seguro para rodar de novo.
--
-- POR QUE
--   O gerente da Luxashade cadastrou o login "edgar" para uma pessoa chamada
--   Fred, e o painel não tinha como renomear: só criar outro (ficaria duplicado).
--   Com isto o próprio /admin passa a listar os usuários de cada revenda e
--   permitir editar login/nome/papel, gerar senha temporária e remover.
--   (Hiago, 20/10/2026)
--
-- SEGURANÇA (a mesma regra do resto do login)
--   • Só quem está na allowlist `painel_admins` (eh_painel_admin) consegue chamar.
--   • Nada daqui revela senha. Renomear não muda a senha: a Luxashade continua
--     sem conseguir entrar no lugar da revenda.
--   • Toda ação fica no histórico (audit_log) com o e-mail de quem fez.
--   • A revenda nunca fica sem administrador enquanto tiver outros usuários.
-- ============================================================================

-- ------------------------------------------------------------------ listar ---
create or replace function public.admin_listar_usuarios_revenda(p_revenda_id uuid)
returns table (id uuid, login text, nome text, papel text, ativo boolean,
               senha_temporaria boolean, criado_em timestamptz,
               ultimo_acesso timestamptz, pedidos bigint)
language sql stable security definer set search_path = public
as $$
  select u.id, u.login, u.nome, u.papel, u.ativo, u.senha_temporaria,
         u.criado_em, u.ultimo_acesso,
         (select count(*) from public.pedidos p where p.usuario_id = u.id)
    from public.revenda_usuarios u
   where u.revenda_id = p_revenda_id
     and public.eh_painel_admin()
   order by u.ativo desc, (u.papel = 'admin') desc, lower(u.login);
$$;

-- ------------------------------------------------------------------ editar ---
-- Renomeia o login, corrige o nome e/ou troca o papel. Não mexe na senha.
create or replace function public.admin_editar_usuario_revenda(
  p_id uuid, p_login text, p_nome text, p_papel text
) returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_u      public.revenda_usuarios%rowtype;
  v_login  text := lower(trim(coalesce(p_login,'')));
  v_nome   text := nullif(trim(coalesce(p_nome,'')), '');
  v_papel  text := case lower(coalesce(p_papel,''))
                     when 'admin' then 'admin' when 'vendedor' then 'vendedor' end;
  v_quem   text := coalesce(nullif(auth.jwt() ->> 'email', ''), 'painel');
  v_admins int;
begin
  if not public.eh_painel_admin() then
    return jsonb_build_object('ok', false, 'motivo', 'sem permissão neste painel');
  end if;

  select * into v_u from public.revenda_usuarios where id = p_id;
  if v_u.id is null then
    return jsonb_build_object('ok', false, 'motivo', 'Usuário não encontrado.');
  end if;
  if length(v_login) < 3 then
    return jsonb_build_object('ok', false, 'motivo', 'O usuário precisa de pelo menos 3 caracteres.');
  end if;
  v_papel := coalesce(v_papel, v_u.papel);

  if exists (select 1 from public.revenda_usuarios
              where revenda_id = v_u.revenda_id and lower(login) = v_login and id <> v_u.id) then
    return jsonb_build_object('ok', false, 'motivo', 'Já existe outro usuário com esse login nesta revenda.');
  end if;

  -- Rebaixar o último administrador ativo deixaria a revenda sem quem gerencie
  -- os usuários e sem quem emita pedido.
  if v_u.papel = 'admin' and v_papel = 'vendedor' and v_u.ativo then
    select count(*) into v_admins from public.revenda_usuarios
     where revenda_id = v_u.revenda_id and papel = 'admin' and ativo;
    if v_admins <= 1 then
      return jsonb_build_object('ok', false, 'motivo',
        'Esta revenda ficaria sem administrador. Crie outro antes de mudar este para vendedor.');
    end if;
  end if;

  update public.revenda_usuarios
     set login = v_login, nome = v_nome, papel = v_papel
   where id = v_u.id;

  -- O papel fica guardado na sessão do app: mudou, derruba para valer já.
  if v_papel <> v_u.papel then
    delete from public.revenda_sessoes where usuario_id = v_u.id;
  end if;

  perform public.log_acesso(v_u.id, 'USUARIO_EDITADO_PELO_PAINEL',
    jsonb_build_object(
      'antes',  jsonb_build_object('login', v_u.login, 'nome', v_u.nome, 'papel', v_u.papel),
      'depois', jsonb_build_object('login', v_login,  'nome', v_nome,  'papel', v_papel),
      'revenda_id', v_u.revenda_id),
    v_quem);

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------- senha temporária ---
-- Gera uma senha temporária para QUALQUER usuário da revenda, mantendo o papel.
-- (O antigo admin_definir_admin_revenda transformava em admin quem recebesse
-- senha; este não.) No próximo acesso o app obriga a criar a senha própria.
create or replace function public.admin_resetar_senha_usuario(p_id uuid, p_senha text)
returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_u    public.revenda_usuarios%rowtype;
  v_quem text := coalesce(nullif(auth.jwt() ->> 'email', ''), 'painel');
begin
  if not public.eh_painel_admin() then
    return jsonb_build_object('ok', false, 'motivo', 'sem permissão neste painel');
  end if;
  if length(coalesce(p_senha,'')) < 4 then
    return jsonb_build_object('ok', false, 'motivo', 'A senha precisa de pelo menos 4 caracteres.');
  end if;

  select * into v_u from public.revenda_usuarios where id = p_id;
  if v_u.id is null then
    return jsonb_build_object('ok', false, 'motivo', 'Usuário não encontrado.');
  end if;

  update public.revenda_usuarios
     set senha_hash = extensions.crypt(p_senha, extensions.gen_salt('bf')),
         senha_temporaria = true,
         ativo = true
   where id = v_u.id;
  delete from public.revenda_sessoes where usuario_id = v_u.id;

  perform public.log_acesso(v_u.id, 'SENHA_RESETADA_PELO_PAINEL',
    jsonb_build_object('login', v_u.login, 'papel', v_u.papel, 'revenda_id', v_u.revenda_id),
    v_quem);

  return jsonb_build_object('ok', true, 'reativado', not v_u.ativo);
end;
$$;

-- ----------------------------------------------------------------- remover ---
-- Remove o acesso. Quem já tem pedido no histórico é só desativado, para não
-- perder a autoria. O último administrador só sai se não houver mais ninguém
-- ativo na revenda (aí a revenda volta a entrar só com o CNPJ).
create or replace function public.admin_remover_usuario_revenda(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare
  v_u      public.revenda_usuarios%rowtype;
  v_admins int;
  v_quem   text := coalesce(nullif(auth.jwt() ->> 'email', ''), 'painel');
  v_acao   text;
begin
  if not public.eh_painel_admin() then
    return jsonb_build_object('ok', false, 'motivo', 'sem permissão neste painel');
  end if;

  select * into v_u from public.revenda_usuarios where id = p_id;
  if v_u.id is null then
    return jsonb_build_object('ok', false, 'motivo', 'Usuário não encontrado.');
  end if;

  if v_u.papel = 'admin' and v_u.ativo then
    select count(*) into v_admins from public.revenda_usuarios
     where revenda_id = v_u.revenda_id and papel = 'admin' and ativo;
    if v_admins <= 1 and exists (select 1 from public.revenda_usuarios
                                  where revenda_id = v_u.revenda_id and ativo and id <> v_u.id) then
      return jsonb_build_object('ok', false, 'motivo',
        'Esta revenda tem outros usuários e ficaria sem administrador. Crie outro administrador antes de remover este.');
    end if;
  end if;

  delete from public.revenda_sessoes where usuario_id = v_u.id;

  if exists (select 1 from public.pedidos where usuario_id = v_u.id) then
    update public.revenda_usuarios set ativo = false where id = v_u.id;
    v_acao := 'desativado';
  else
    delete from public.revenda_usuarios where id = v_u.id;
    v_acao := 'removido';
  end if;

  perform public.log_acesso(v_u.id,
    case v_acao when 'desativado' then 'USUARIO_DESATIVADO_PELO_PAINEL' else 'USUARIO_REMOVIDO_PELO_PAINEL' end,
    jsonb_build_object('login', v_u.login, 'papel', v_u.papel, 'revenda_id', v_u.revenda_id),
    v_quem);

  return jsonb_build_object(
    'ok', true, 'acao', v_acao,
    -- true = não sobrou ninguém ativo: a revenda volta a entrar só com o CNPJ
    'sem_login', not exists (select 1 from public.revenda_usuarios
                              where revenda_id = v_u.revenda_id and ativo));
end;
$$;

-- ----------------------------------------------------------------- grants ---
revoke all on function public.admin_listar_usuarios_revenda(uuid)               from public, anon;
revoke all on function public.admin_editar_usuario_revenda(uuid,text,text,text) from public, anon;
revoke all on function public.admin_resetar_senha_usuario(uuid,text)            from public, anon;
revoke all on function public.admin_remover_usuario_revenda(uuid)               from public, anon;
grant execute on function public.admin_listar_usuarios_revenda(uuid)               to authenticated;
grant execute on function public.admin_editar_usuario_revenda(uuid,text,text,text) to authenticated;
grant execute on function public.admin_resetar_senha_usuario(uuid,text)            to authenticated;
grant execute on function public.admin_remover_usuario_revenda(uuid)               to authenticated;

-- ------------------------------------------------------------ conferência ---
-- Deve listar as 4 funções, nenhuma liberada para anon:
-- select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.proname like 'admin\_%usuario%';
