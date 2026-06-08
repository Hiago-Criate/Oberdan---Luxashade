import { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard, Tag, Ruler, Layers3, Palette, Cpu, Wrench, Settings2,
  History, LogOut, Save, Plus, Trash2, Search, ExternalLink, RefreshCw,
  AlertTriangle, Check, Lock,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../utils/cn';
import {
  type Marca, type EstoqueStatus, ESTOQUE_LABEL, money,
  login, logout, fetchAll, updateRow, insertRow, deleteRow, fetchProdutos, distinctFrom,
} from './lib';

// ============================ Primitivos de UI ============================
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={cn('relative h-6 w-11 rounded-full transition-colors', on ? 'bg-emerald-500' : 'bg-zinc-300')}
    >
      <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', on ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}

function NumCell({ value, onCommit, prefix }: { value: number; onCommit: (n: number) => void; prefix?: string }) {
  const [v, setV] = useState(String(value ?? ''));
  useEffect(() => setV(String(value ?? '')), [value]);
  const dirty = String(value ?? '') !== v;
  return (
    <div className="relative">
      {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-zinc-400">{prefix}</span>}
      <input
        type="number"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { if (dirty) onCommit(Number(v)); }}
        className={cn('w-full rounded-lg border bg-white py-1.5 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-zinc-900/10',
          prefix ? 'pl-7 pr-2' : 'px-2', dirty ? 'border-amber-400' : 'border-zinc-200')}
      />
    </div>
  );
}

function TxtCell({ value, onCommit, placeholder }: { value: string; onCommit: (s: string) => void; placeholder?: string }) {
  const [v, setV] = useState(value ?? '');
  useEffect(() => setV(value ?? ''), [value]);
  const dirty = (value ?? '') !== v;
  return (
    <input
      value={v}
      placeholder={placeholder}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (dirty) onCommit(v); }}
      className={cn('w-full rounded-lg border bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10',
        dirty ? 'border-amber-400' : 'border-zinc-200')}
    />
  );
}

function EstoqueSelect({ value, onChange }: { value: EstoqueStatus; onChange: (v: EstoqueStatus) => void }) {
  const color: Record<EstoqueStatus, string> = {
    disponivel: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    sob_consulta: 'bg-amber-50 text-amber-700 border-amber-200',
    indisponivel: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as EstoqueStatus)}
      className={cn('rounded-lg border px-2 py-1.5 text-xs font-medium focus:outline-none', color[value])}
    >
      {(Object.keys(ESTOQUE_LABEL) as EstoqueStatus[]).map((k) => (
        <option key={k} value={k}>{ESTOQUE_LABEL[k]}</option>
      ))}
    </select>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn('px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-400', className)}>{children}</th>;
}
function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn('px-3 py-2 align-middle', className)}>{children}</td>;
}

function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm text-white shadow-lg flex items-center gap-2">
      <Check size={16} className="text-emerald-400" /> {msg}
    </div>
  );
}

function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const show = (m: string) => { setMsg(m); window.clearTimeout((show as any)._t); (show as any)._t = window.setTimeout(() => setMsg(null), 2200); };
  return { msg, show };
}

// ============================ Login ============================
function Login({ onOk }: { onOk: () => void }) {
  const [email, setEmail] = useState('admin@luxashade.app');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true); setErr('');
    const { error } = await login(email, password);
    setLoading(false);
    if (error) setErr('E-mail ou senha inválidos.');
    else onOk();
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-100 px-6">
      <div className="w-full max-w-sm space-y-6 rounded-3xl bg-white p-8 shadow-xl">
        <div className="text-center space-y-2">
          <img src="/logo-luxashade.png" alt="Luxashade" className="mx-auto h-16 object-contain" />
          <h1 className="text-lg font-semibold text-zinc-800">Painel de Controle</h1>
          <p className="text-xs text-zinc-400">Acesso restrito · Luxashade × ShadeXP</p>
        </div>
        <div className="space-y-3">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail"
            className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Senha"
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10" />
          {err && <p className="text-xs text-red-500">{err}</p>}
          <button onClick={submit} disabled={loading || !password}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 py-3 text-sm font-medium text-white disabled:opacity-50">
            <Lock size={16} /> {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================ Shell ============================
type ModuleKey = 'overview' | 'precos' | 'dimensoes' | 'colecoes' | 'cores' | 'trilhos' | 'motores' | 'opcionais' | 'config' | 'historico';

const MODULES: { key: ModuleKey; label: string; icon: any }[] = [
  { key: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { key: 'precos', label: 'Preços (m²)', icon: Tag },
  { key: 'dimensoes', label: 'Dimensões', icon: Ruler },
  { key: 'colecoes', label: 'Coleções', icon: Layers3 },
  { key: 'cores', label: 'Cores de tecido', icon: Palette },
  { key: 'trilhos', label: 'Trilhos', icon: Wrench },
  { key: 'motores', label: 'Motores', icon: Cpu },
  { key: 'opcionais', label: 'Opcionais', icon: Plus },
  { key: 'config', label: 'Configurações', icon: Settings2 },
  { key: 'historico', label: 'Histórico', icon: History },
];

export function AdminApp() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [marca, setMarca] = useState<Marca>('luxashade');
  const [mod, setMod] = useState<ModuleKey>('overview');
  const [familias, setFamilias] = useState<{ id: number; nome: string; marca: string }[]>([]);
  const toast = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setEmail(data.session?.user?.email ?? '');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
      setEmail(session?.user?.email ?? '');
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (authed) fetchAll<{ id: number; nome: string; marca: string }>('familias', { order: { col: 'ordem' } }).then(setFamilias).catch(() => {});
  }, [authed]);

  if (authed === null) return <div className="min-h-screen bg-zinc-100" />;
  if (!authed) return <Login onOk={() => setAuthed(true)} />;

  const brandFamilias = familias.filter((f) => f.marca === marca).map((f) => f.nome);

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-zinc-200 bg-white">
        <div className="p-5">
          <img src={marca === 'shadexp' ? '/logo-shadexp.png' : '/logo-luxashade.png'} alt={marca} className="h-12 object-contain object-left" />
          <p className="mt-1 text-[11px] uppercase tracking-widest text-zinc-400">Painel de Controle</p>
        </div>

        {/* Brand switch */}
        <div className="mx-4 grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1">
          {(['luxashade', 'shadexp'] as Marca[]).map((b) => (
            <button key={b} onClick={() => setMarca(b)}
              className={cn('rounded-lg py-1.5 text-xs font-semibold transition-colors', marca === b ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500')}>
              {b === 'luxashade' ? 'Luxashade' : 'ShadeXP'}
            </button>
          ))}
        </div>

        <nav className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-3">
          {MODULES.map((m) => (
            <button key={m.key} onClick={() => setMod(m.key)}
              className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                mod === m.key ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100')}>
              <m.icon size={17} /> {m.label}
            </button>
          ))}
        </nav>

        <div className="border-t border-zinc-100 p-3">
          <a href="/" target="_blank" rel="noreferrer"
            className="mb-1 flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-100">
            <ExternalLink size={14} /> Abrir o app
          </a>
          <div className="flex items-center justify-between px-3 py-1">
            <span className="truncate text-[11px] text-zinc-400" title={email}>{email}</span>
            <button onClick={() => logout()} className="text-zinc-400 hover:text-red-500" title="Sair"><LogOut size={15} /></button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-60 p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">{MODULES.find((m) => m.key === mod)?.label}</h2>
            <p className="text-sm text-zinc-400">
              Aba <span className="font-medium text-zinc-600">{marca === 'luxashade' ? 'Luxashade' : 'ShadeXP'}</span> · alterações salvam no banco e aparecem no app ao recarregar.
            </p>
          </div>
        </div>

        {mod === 'overview' && <Overview marca={marca} brandFamilias={brandFamilias} />}
        {mod === 'precos' && <Precos marca={marca} brandFamilias={brandFamilias} toast={toast.show} />}
        {mod === 'dimensoes' && <Dimensoes brandFamilias={brandFamilias} toast={toast.show} />}
        {mod === 'colecoes' && <Colecoes brandFamilias={brandFamilias} toast={toast.show} />}
        {mod === 'cores' && <Cores brandFamilias={brandFamilias} toast={toast.show} />}
        {mod === 'trilhos' && <Trilhos toast={toast.show} />}
        {mod === 'motores' && <Motores toast={toast.show} />}
        {mod === 'opcionais' && <Opcionais marca={marca} toast={toast.show} />}
        {mod === 'config' && <Config toast={toast.show} />}
        {mod === 'historico' && <Historico />}
      </main>

      <Toast msg={toast.msg} />
    </div>
  );
}

// ============================ Visão geral ============================
function Overview({ marca, brandFamilias }: { marca: Marca; brandFamilias: string[] }) {
  const [stats, setStats] = useState<any>(null);
  useEffect(() => {
    (async () => {
      const count = async (t: string, f?: Record<string, any>) => {
        let q = supabase.from(t).select('*', { count: 'exact', head: true });
        if (f) for (const [k, v] of Object.entries(f)) q = q.eq(k, v);
        const { count: c } = await q; return c ?? 0;
      };
      setStats({
        produtos: await count('produtos'),
        colecoes: await count('colecoes'),
        sobConsultaCol: await count('colecoes', { estoque_status: 'sob_consulta' }),
        indispCol: await count('colecoes', { estoque_status: 'indisponivel' }),
        cores: await count('cores_tecido'),
        sobConsultaCor: await count('cores_tecido', { estoque_status: 'sob_consulta' }),
        motores: await count('motores'),
      });
    })();
  }, []);
  const cards = [
    { label: 'Produtos (preço m²)', value: stats?.produtos },
    { label: 'Coleções', value: stats?.colecoes },
    { label: 'Coleções Sob Consulta', value: stats?.sobConsultaCol, warn: true },
    { label: 'Coleções em falta', value: stats?.indispCol, danger: true },
    { label: 'Cores de tecido', value: stats?.cores },
    { label: 'Cores Sob Consulta', value: stats?.sobConsultaCor, warn: true },
    { label: 'Motores', value: stats?.motores },
    { label: `Famílias (${marca})`, value: brandFamilias.length },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="text-3xl font-bold tabular-nums">{c.value ?? '—'}</p>
          <p className={cn('mt-1 text-xs', c.danger ? 'text-red-500' : c.warn ? 'text-amber-600' : 'text-zinc-400')}>{c.label}</p>
        </div>
      ))}
    </div>
  );
}

// ============================ Preços (m²) ============================
function Precos({ brandFamilias, toast }: { marca: Marca; brandFamilias: string[]; toast: (m: string) => void }) {
  const [familia, setFamilia] = useState('');
  const [modelos, setModelos] = useState<string[]>([]);
  const [modelo, setModelo] = useState('');
  const [busca, setBusca] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [bulk, setBulk] = useState('');

  useEffect(() => { if (brandFamilias.length && !familia) setFamilia(brandFamilias[0]); }, [brandFamilias]);
  useEffect(() => {
    if (!familia) return;
    setModelo('');
    distinctFrom('modelo', { familia }).then(setModelos).catch(() => setModelos([]));
  }, [familia]);

  const load = async () => {
    if (!familia) return;
    setLoading(true);
    try { setRows(await fetchProdutos({ familia, modelo: modelo || undefined })); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [familia, modelo]);

  const filtered = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => [r.codigo, r.colecao, r.cor_tecido, r.tipo_tecido].some((x) => String(x).toLowerCase().includes(t)));
  }, [rows, busca]);

  const setPreco = async (row: any, v: number) => {
    await updateRow('produtos', row.id, { vlr_m2: v });
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, vlr_m2: v } : r)));
    toast('Preço atualizado');
  };
  const setAtivo = async (row: any, v: boolean) => {
    await updateRow('produtos', row.id, { ativo: v });
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, ativo: v } : r)));
    toast(v ? 'Produto reativado' : 'Produto fora de linha');
  };
  const applyBulk = async () => {
    const v = Number(bulk);
    if (!v || !filtered.length) return;
    if (!confirm(`Definir R$ ${money(v)}/m² em ${filtered.length} produto(s) filtrado(s)?`)) return;
    const ids = filtered.map((r) => r.id);
    const { error } = await supabase.from('produtos').update({ vlr_m2: v }).in('id', ids);
    if (error) { toast('Erro ao aplicar'); return; }
    setRows((rs) => rs.map((r) => (ids.includes(r.id) ? { ...r, vlr_m2: v } : r)));
    setBulk('');
    toast(`${ids.length} preços atualizados`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 bg-white p-4">
        <label className="text-xs text-zinc-500">Família
          <select value={familia} onChange={(e) => setFamilia(e.target.value)} className="mt-1 block w-56 rounded-lg border border-zinc-200 px-3 py-2 text-sm">
            {brandFamilias.map((f) => <option key={f}>{f}</option>)}
          </select>
        </label>
        <label className="text-xs text-zinc-500">Modelo
          <select value={modelo} onChange={(e) => setModelo(e.target.value)} className="mt-1 block w-72 rounded-lg border border-zinc-200 px-3 py-2 text-sm">
            <option value="">Todos os modelos</option>
            {modelos.map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar código / coleção / cor"
            className="mt-1 w-64 rounded-lg border border-zinc-200 py-2 pl-9 pr-3 text-sm" />
        </div>
        <button onClick={load} className="ml-auto flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50">
          <RefreshCw size={14} /> Recarregar
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-amber-50/40 p-3 text-sm">
        <span className="text-zinc-500">Ação em massa:</span>
        <span className="text-zinc-400">definir R$</span>
        <input value={bulk} onChange={(e) => setBulk(e.target.value)} type="number" placeholder="0,00" className="w-28 rounded-lg border border-zinc-200 px-2 py-1.5 text-right text-sm" />
        <span className="text-zinc-400">/m² em <b className="text-zinc-700">{filtered.length}</b> produto(s) filtrado(s)</span>
        <button onClick={applyBulk} disabled={!bulk || !filtered.length} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40">Aplicar</button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-zinc-50">
              <tr>
                <Th>Modelo</Th><Th>Acion.</Th><Th>Tipo</Th><Th>Coleção</Th><Th>Cor tecido</Th><Th>Acab.</Th><Th>Código</Th>
                <Th className="text-right">Vlr m² (R$)</Th><Th className="text-center">Em linha</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading && <tr><Td className="text-zinc-400" >Carregando…</Td></tr>}
              {!loading && filtered.length === 0 && <tr><Td className="text-zinc-400">Nenhum produto.</Td></tr>}
              {filtered.map((r) => (
                <tr key={r.id} className={cn('hover:bg-zinc-50', !r.ativo && 'opacity-50')}>
                  <Td className="max-w-[220px] truncate text-zinc-700" >{r.modelo}</Td>
                  <Td className="text-xs text-zinc-500">{r.acionamento}</Td>
                  <Td className="text-xs text-zinc-500">{r.tipo_tecido}</Td>
                  <Td className="text-zinc-600">{r.colecao}</Td>
                  <Td className="text-zinc-600">{r.cor_tecido}</Td>
                  <Td className="text-xs text-zinc-500">{r.cor_acab}</Td>
                  <Td className="font-mono text-[11px] text-zinc-400">{r.codigo}</Td>
                  <Td className="w-32"><NumCell value={r.vlr_m2} prefix="R$" onCommit={(n) => setPreco(r, n)} /></Td>
                  <Td className="text-center"><div className="flex justify-center"><Toggle on={r.ativo} onChange={(v) => setAtivo(r, v)} /></div></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-zinc-400">Mostrando {filtered.length} de {rows.length} carregados. Use os filtros para refinar.</p>
    </div>
  );
}

// ============================ Dimensões ============================
function Dimensoes({ brandFamilias, toast }: { brandFamilias: string[]; toast: (m: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { fetchAll('modelo_limites').then(setRows).catch(() => {}); }, []);
  const list = rows.filter((r) => brandFamilias.includes(r.familia)).sort((a, b) => a.modelo.localeCompare(b.modelo));
  const set = async (row: any, field: string, v: number) => {
    await updateRow('modelo_limites', row.id, { [field]: v });
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, [field]: v } : r)));
    toast('Dimensão atualizada');
  };
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <div className="max-h-[68vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-50">
            <tr>
              <Th>Modelo</Th><Th>Acion.</Th>
              <Th className="text-right">Larg. mín</Th><Th className="text-right">Larg. máx</Th>
              <Th className="text-right">Alt. mín</Th><Th className="text-right">Alt. máx</Th>
              <Th className="text-right">m² mín</Th><Th className="text-right">m² máx</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {list.map((r) => (
              <tr key={r.id} className="hover:bg-zinc-50">
                <Td className="max-w-[240px] truncate text-zinc-700">{r.modelo}</Td>
                <Td className="text-xs text-zinc-500">{r.acionamento}</Td>
                <Td className="w-24"><NumCell value={r.larg_min} onCommit={(n) => set(r, 'larg_min', n)} /></Td>
                <Td className="w-24"><NumCell value={r.larg_max} onCommit={(n) => set(r, 'larg_max', n)} /></Td>
                <Td className="w-24"><NumCell value={r.alt_min} onCommit={(n) => set(r, 'alt_min', n)} /></Td>
                <Td className="w-24"><NumCell value={r.alt_max} onCommit={(n) => set(r, 'alt_max', n)} /></Td>
                <Td className="w-20"><NumCell value={r.m2_min} onCommit={(n) => set(r, 'm2_min', n)} /></Td>
                <Td className="w-20"><NumCell value={r.m2_max} onCommit={(n) => set(r, 'm2_max', n)} /></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================ Coleções / Cores (estoque + on/off) ============================
function useUsadosPorMarca(col: 'colecao' | 'cor_tecido', brandFamilias: string[]) {
  const [set, setSet] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!brandFamilias.length) return;
    (async () => {
      const { data } = await supabase.from('produtos').select(col).in('familia', brandFamilias).limit(20000);
      const s = new Set<string>();
      for (const r of data ?? []) s.add((r as any)[col]);
      setSet(s);
    })();
  }, [brandFamilias.join('|')]);
  return set;
}

function Colecoes({ brandFamilias, toast }: { brandFamilias: string[]; toast: (m: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const usados = useUsadosPorMarca('colecao', brandFamilias);
  useEffect(() => { fetchAll('colecoes', { order: { col: 'ordem' } }).then(setRows).catch(() => {}); }, []);
  const list = rows.filter((r) => usados.size === 0 || usados.has(r.nome));
  const patch = async (row: any, values: any, msg: string) => {
    await updateRow('colecoes', row.id, values);
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, ...values } : r)));
    toast(msg);
  };
  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-zinc-50 px-4 py-2 text-xs text-zinc-500">As coleções são compartilhadas entre as marcas — alterar estoque/linha vale para Luxashade e ShadeXP.</p>
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="max-h-[64vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-zinc-50"><tr>
              <Th>Coleção</Th><Th>Tipo</Th><Th className="text-center">Em linha</Th><Th>Estoque</Th><Th>Observação</Th>
            </tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {list.map((r) => (
                <tr key={r.id} className={cn('hover:bg-zinc-50', !r.ativo && 'opacity-50')}>
                  <Td className="font-medium text-zinc-700">{r.nome}</Td>
                  <Td className="text-xs text-zinc-500">{r.tipo_tecido}</Td>
                  <Td className="text-center"><div className="flex justify-center"><Toggle on={r.ativo} onChange={(v) => patch(r, { ativo: v }, v ? 'Coleção em linha' : 'Coleção fora de linha')} /></div></Td>
                  <Td><EstoqueSelect value={r.estoque_status} onChange={(v) => patch(r, { estoque_status: v }, 'Estoque atualizado')} /></Td>
                  <Td className="w-72"><TxtCell value={r.obs ?? ''} placeholder="ex: prazo, motivo…" onCommit={(s) => patch(r, { obs: s }, 'Observação salva')} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Cores({ brandFamilias, toast }: { brandFamilias: string[]; toast: (m: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const usados = useUsadosPorMarca('cor_tecido', brandFamilias);
  useEffect(() => { fetchAll('cores_tecido', { order: { col: 'ordem' } }).then(setRows).catch(() => {}); }, []);
  const list = rows.filter((r) => usados.size === 0 || usados.has(r.nome));
  const patch = async (row: any, values: any, msg: string) => {
    await updateRow('cores_tecido', row.id, values);
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, ...values } : r)));
    toast(msg);
  };
  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-zinc-50 px-4 py-2 text-xs text-zinc-500">Cores compartilhadas entre as marcas. "Sob Consulta" mostra aviso no app; "Em falta" some da seleção.</p>
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="max-h-[64vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-zinc-50"><tr>
              <Th>Cor do tecido</Th><Th className="text-center">Em linha</Th><Th>Estoque</Th><Th>Observação</Th>
            </tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {list.map((r) => (
                <tr key={r.id} className={cn('hover:bg-zinc-50', !r.ativo && 'opacity-50')}>
                  <Td className="font-medium text-zinc-700">{r.nome}</Td>
                  <Td className="text-center"><div className="flex justify-center"><Toggle on={r.ativo} onChange={(v) => patch(r, { ativo: v }, v ? 'Cor em linha' : 'Cor fora de linha')} /></div></Td>
                  <Td><EstoqueSelect value={r.estoque_status} onChange={(v) => patch(r, { estoque_status: v }, 'Estoque atualizado')} /></Td>
                  <Td className="w-72"><TxtCell value={r.obs ?? ''} placeholder="ex: previsão de retorno…" onCommit={(s) => patch(r, { obs: s }, 'Observação salva')} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================ Trilhos ============================
function Trilhos({ toast }: { toast: (m: string) => void }) {
  const [produtos, setProdutos] = useState<any[]>([]);
  const [sel, setSel] = useState<string>('');
  const [comps, setComps] = useState<any[]>([]);
  const reloadProdutos = () => fetchAll('trilho_produtos', { order: { col: 'codigo' } }).then(setProdutos).catch(() => {});
  useEffect(() => { reloadProdutos(); }, []);
  useEffect(() => {
    if (!sel) { setComps([]); return; }
    supabase.from('trilho_componentes').select('*').eq('trilho_codigo', sel).order('ordem').then(({ data }) => setComps(data ?? []));
  }, [sel]);

  const setAtivoProd = async (row: any, v: boolean) => {
    await updateRow('trilho_produtos', row.codigo, { ativo: v }, 'codigo');
    setProdutos((ps) => ps.map((p) => (p.codigo === row.codigo ? { ...p, ativo: v } : p)));
    toast(v ? 'Trilho em linha' : 'Trilho fora de linha');
  };
  const setComp = async (row: any, field: string, v: any) => {
    await updateRow('trilho_componentes', row.id, { [field]: v });
    setComps((cs) => cs.map((c) => (c.id === row.id ? { ...c, [field]: v } : c)));
    toast('Componente atualizado');
  };
  const addComp = async () => {
    const novo = await insertRow('trilho_componentes', { trilho_codigo: sel, comp_codigo: 'NOVO', quantidade: 1, formula: '', valor: 0, ordem: comps.length });
    setComps((cs) => [...cs, novo]);
  };
  const delComp = async (row: any) => {
    await deleteRow('trilho_componentes', row.id);
    setComps((cs) => cs.filter((c) => c.id !== row.id));
    toast('Componente removido');
  };

  return (
    <div className="grid grid-cols-[320px_1fr] gap-5">
      <div className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-3">
        <p className="px-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Trilhos</p>
        {produtos.map((p) => (
          <div key={p.codigo} className={cn('flex items-center gap-2 rounded-xl border p-2', sel === p.codigo ? 'border-zinc-900' : 'border-zinc-100')}>
            <button onClick={() => setSel(p.codigo)} className="flex-1 text-left">
              <p className="text-xs font-medium text-zinc-700 leading-tight">{p.descricao}</p>
              <p className="font-mono text-[10px] text-zinc-400">{p.codigo} · {p.cor} · {p.abertura}</p>
            </button>
            <Toggle on={p.ativo} onChange={(v) => setAtivoProd(p, v)} />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        {!sel ? (
          <p className="p-6 text-center text-sm text-zinc-400">Selecione um trilho para editar os componentes e o preço linear.</p>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-zinc-700">Componentes · {sel}</h3>
              <button onClick={addComp} className="flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white"><Plus size={13} /> Componente</button>
            </div>
            <table className="w-full text-sm">
              <thead><tr><Th>Código</Th><Th className="text-right">Qtd</Th><Th>Fórmula</Th><Th className="text-right">Valor (R$)</Th><Th /></tr></thead>
              <tbody className="divide-y divide-zinc-100">
                {comps.map((c) => (
                  <tr key={c.id}>
                    <Td className="w-32"><TxtCell value={c.comp_codigo} onCommit={(s) => setComp(c, 'comp_codigo', s)} /></Td>
                    <Td className="w-20"><NumCell value={c.quantidade} onCommit={(n) => setComp(c, 'quantidade', n)} /></Td>
                    <Td><TxtCell value={c.formula ?? ''} placeholder="(vazio = fixo)" onCommit={(s) => setComp(c, 'formula', s)} /></Td>
                    <Td className="w-28"><NumCell value={c.valor} prefix="R$" onCommit={(n) => setComp(c, 'valor', n)} /></Td>
                    <Td><button onClick={() => delComp(c)} className="text-zinc-300 hover:text-red-500"><Trash2 size={15} /></button></Td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 flex items-center gap-2 text-xs text-zinc-400"><AlertTriangle size={13} /> A fórmula deve ser uma das reconhecidas pelo cálculo (ex: <code className="rounded bg-zinc-100 px-1">ARREDONDAR.PARA.CIMA(AA$1/100)+8</code>). Vazio = quantidade fixa.</p>
          </>
        )}
      </div>
    </div>
  );
}

// ============================ Motores ============================
function Motores({ toast }: { toast: (m: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { fetchAll('motores', { order: { col: 'ordem' } }).then(setRows).catch(() => {}); }, []);
  const patch = async (row: any, values: any) => {
    await updateRow('motores', row.id, values);
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, ...values } : r)));
    toast('Motor atualizado');
  };
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50"><tr>
          <Th>Motor</Th><Th className="text-right">Preço Branco</Th><Th className="text-right">Preço Preto</Th>
          <Th className="text-center">Trilho</Th><Th className="text-center">Cortina</Th><Th className="text-center">Ativo</Th>
        </tr></thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((r) => (
            <tr key={r.id} className={cn('hover:bg-zinc-50', !r.ativo && 'opacity-50')}>
              <Td className="text-zinc-700">{r.nome}</Td>
              <Td className="w-32"><NumCell value={r.preco_branco} prefix="R$" onCommit={(n) => patch(r, { preco_branco: n })} /></Td>
              <Td className="w-32"><NumCell value={r.preco_preto} prefix="R$" onCommit={(n) => patch(r, { preco_preto: n })} /></Td>
              <Td className="text-center"><div className="flex justify-center"><Toggle on={r.uso_trilho} onChange={(v) => patch(r, { uso_trilho: v })} /></div></Td>
              <Td className="text-center"><div className="flex justify-center"><Toggle on={r.uso_shade} onChange={(v) => patch(r, { uso_shade: v })} /></div></Td>
              <Td className="text-center"><div className="flex justify-center"><Toggle on={r.ativo} onChange={(v) => patch(r, { ativo: v })} /></div></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================ Opcionais (ShadeXP) ============================
function Opcionais({ marca, toast }: { marca: Marca; toast: (m: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { fetchAll('opcionais', { order: { col: 'ordem' } }).then(setRows).catch(() => {}); }, []);
  if (marca === 'luxashade') {
    return <p className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-400">Os opcionais/acessórios são específicos da <b>ShadeXP</b>. Selecione a aba ShadeXP para editá-los.</p>;
  }
  const patch = async (row: any, values: any) => {
    await updateRow('opcionais', row.id, values);
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, ...values } : r)));
    toast('Opcional atualizado');
  };
  const FORMULAS = ['fixo', 'porLargura', 'porAltura', 'porAltComando'];
  const grupos = [
    { tipo: 'modelo', titulo: 'Acessórios por modelo' },
    { tipo: 'controle_motorizada', titulo: 'Controles / Emissores (motorizadas)' },
  ];
  return (
    <div className="space-y-5">
      {grupos.map((g) => (
        <div key={g.tipo} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <p className="border-b border-zinc-100 bg-zinc-50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">{g.titulo}</p>
          <table className="w-full text-sm">
            <thead><tr><Th>Código</Th><Th>Descrição</Th><Th className="text-right">Valor</Th><Th>Fórmula</Th><Th className="text-center">Ativo</Th></tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.filter((r) => r.tipo === g.tipo).map((r) => (
                <tr key={r.id} className={cn('hover:bg-zinc-50', !r.ativo && 'opacity-50')}>
                  <Td className="font-mono text-[11px] text-zinc-400">{r.codigo}</Td>
                  <Td className="text-zinc-700">{r.descricao}</Td>
                  <Td className="w-28"><NumCell value={r.valor} prefix="R$" onCommit={(n) => patch(r, { valor: n })} /></Td>
                  <Td className="w-40">
                    <select value={r.formula} onChange={(e) => patch(r, { formula: e.target.value })} className="w-full rounded-lg border border-zinc-200 px-2 py-1.5 text-xs">
                      {FORMULAS.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </Td>
                  <Td className="text-center"><div className="flex justify-center"><Toggle on={r.ativo} onChange={(v) => patch(r, { ativo: v })} /></div></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

// ============================ Configurações ============================
function Config({ toast }: { toast: (m: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { fetchAll('app_config', { order: { col: 'chave' } }).then(setRows).catch(() => {}); }, []);
  return (
    <div className="space-y-4">
      {rows.map((r) => <ConfigCard key={r.chave} row={r} toast={toast} />)}
    </div>
  );
}
function ConfigCard({ row, toast }: { row: any; toast: (m: string) => void }) {
  const [txt, setTxt] = useState(JSON.stringify(row.valor, null, 2));
  const [err, setErr] = useState('');
  const dirty = txt !== JSON.stringify(row.valor, null, 2);
  const save = async () => {
    let parsed: any;
    try { parsed = JSON.parse(txt); } catch { setErr('JSON inválido'); return; }
    setErr('');
    await updateRow('app_config', row.chave, { valor: parsed }, 'chave');
    row.valor = parsed;
    toast('Configuração salva');
  };
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="font-mono text-sm font-semibold text-zinc-700">{row.chave}</p>
          <p className="text-xs text-zinc-400">{row.descricao}</p>
        </div>
        <button onClick={save} disabled={!dirty} className="flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"><Save size={13} /> Salvar</button>
      </div>
      <textarea value={txt} onChange={(e) => setTxt(e.target.value)} spellCheck={false}
        className={cn('h-32 w-full rounded-xl border bg-zinc-50 p-3 font-mono text-xs focus:outline-none', err ? 'border-red-400' : 'border-zinc-200')} />
      {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
    </div>
  );
}

// ============================ Histórico ============================
function Historico() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from('audit_log').select('*').order('criado_em', { ascending: false }).limit(120).then(({ data }) => setRows(data ?? []));
  }, []);
  const acaoLabel: Record<string, string> = { INSERT: 'criou', UPDATE: 'alterou', DELETE: 'removeu' };
  const diff = (r: any) => {
    if (r.acao !== 'UPDATE' || !r.antes || !r.depois) return '';
    const out: string[] = [];
    for (const k of Object.keys(r.depois)) {
      if (k === 'updated_at') continue;
      if (JSON.stringify(r.antes[k]) !== JSON.stringify(r.depois[k])) out.push(`${k}: ${r.antes[k]} → ${r.depois[k]}`);
    }
    return out.join(' · ');
  };
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50"><tr><Th>Quando</Th><Th>Quem</Th><Th>Tabela</Th><Th>Ação</Th><Th>Mudança</Th></tr></thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-zinc-50">
              <Td className="whitespace-nowrap text-xs text-zinc-500">{new Date(r.criado_em).toLocaleString('pt-BR')}</Td>
              <Td className="text-xs text-zinc-500">{r.usuario}</Td>
              <Td className="text-xs text-zinc-600">{r.tabela}</Td>
              <Td className="text-xs"><span className="rounded-full bg-zinc-100 px-2 py-0.5">{acaoLabel[r.acao] ?? r.acao}</span></Td>
              <Td className="text-xs text-zinc-500">{diff(r)}</Td>
            </tr>
          ))}
          {rows.length === 0 && <tr><Td className="text-zinc-400">Sem alterações registradas ainda.</Td></tr>}
        </tbody>
      </table>
    </div>
  );
}
