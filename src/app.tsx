import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, Gift, Intention, PublicList, Rsvp, User, WeddingList } from './api';
import { formatBRL } from './format';

function useSession() {
  const [user, setUser] = useState<User | null>(null); const [ready, setReady] = useState(false);
  useEffect(() => { api.me().then(result => setUser(result.user)).catch(() => setUser(null)).finally(() => setReady(true)); }, []);
  return { user, ready, setUser };
}
function Money({ cents }: { cents: number }) { return <>{formatBRL(cents)}</>; }
function Notice({ children, error = false }: { children: React.ReactNode; error?: boolean }) { return <div className={error ? 'notice error' : 'notice'} role="status">{children}</div>; }
function StoredImage({ listId, blob, alt, className, privateAccess = false }: { listId: string; blob: string; alt: string; className: string; privateAccess?: boolean }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let active = true;
    if (privateAccess) {
      setSrc('');
      api.imagePreviewUrl(listId, blob).then(url => { if (active) setSrc(url); }).catch(() => { if (active) setSrc(''); });
    } else {
      setSrc(api.imageUrl(listId, blob));
    }
    return () => { active = false; };
  }, [listId, blob, privateAccess]);
  return src ? <img className={className} src={src} alt={alt} /> : null;
}
function App() {
  const session = useSession();
  return <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/entrar" element={<AuthPage mode="login" onUser={session.setUser} />} />
    <Route path="/cadastro" element={<AuthPage mode="register" onUser={session.setUser} />} />
    <Route path="/esqueci-senha" element={<ForgotPassword />} />
    <Route path="/redefinir-senha" element={<ResetPassword />} />
    <Route path="/aceitar-convite" element={<AcceptInvite />} />
    <Route path="/confirmar-presenca" element={<ConfirmRsvp />} />
    <Route path="/painel" element={<Private ready={session.ready} user={session.user}><Dashboard user={session.user} onLogout={() => { api.logout().finally(() => session.setUser(null)); }} /></Private>} />
    <Route path="/painel/listas/:id" element={<Private ready={session.ready} user={session.user}><ListEditor /></Private>} />
    <Route path="/lista/:slug" element={<PublicPage />} />
    <Route path="*" element={<main className="center"><h1>Página não encontrada</h1><Link to="/">Voltar ao início</Link></main>} />
  </Routes>;
}
function Private({ ready, user, children }: { ready: boolean; user: User | null; children: React.ReactNode }) { if (!ready) return <main className="center">Carregando…</main>; return user ? <>{children}</> : <Navigate to="/entrar" replace />; }
function Brand() { return <Link className="brand" to="/">nosso <i>sim</i></Link>; }
function Home() {
  return <><header className="topbar"><Brand /><nav><Link to="/entrar">Entrar</Link><Link className="button small" to="/cadastro">Criar minha lista</Link></nav></header><main className="hero"><div className="hero-copy"><span className="eyebrow">UM JEITO ESPECIAL DE CELEBRAR</span><h1>O começo da vida a dois, do jeito de vocês.</h1><p>Crie uma lista de presentes simbólicos, compartilhe com quem ama e acompanhe as intenções recebidas.</p><p className="disclaimer">Nesta versão, os convidados registram uma intenção de presentear. Nenhum pagamento é processado e nenhum produto físico é comprado ou entregue.</p><Link className="button" to="/cadastro">Começar minha lista <span>↗</span></Link></div><div className="hero-art"><div className="sun" /><div className="card-preview"><span>ANA & PEDRO</span><strong>Celebrar esse amor<br />junto de vocês</strong><small>14 · 11 · 2026</small><div className="flowers">✿</div></div><div className="art-caption">um dia para guardar<br />no coração</div></div></main><footer>Feito para celebrar histórias de amor.</footer></>;
}
function AuthPage({ mode, onUser }: { mode: 'login' | 'register'; onUser: (user: User) => void }) {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const nav = useNavigate();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(''); setBusy(true); const data = new FormData(e.currentTarget);
    try { const result = mode === 'register' ? await api.register(String(data.get('name')), String(data.get('email')), String(data.get('password'))) : await api.login(String(data.get('email')), String(data.get('password'))); onUser(result.user); nav('/painel'); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <main className="auth-shell"><Brand /><section className="auth-card"><span className="eyebrow">{mode === 'register' ? 'UM NOVO CAPÍTULO' : 'BEM-VINDO DE VOLTA'}</span><h1>{mode === 'register' ? 'Criem uma lista com a cara de vocês.' : 'Acesse sua lista'}</h1><p>Organize os detalhes e compartilhe esse momento com seus convidados.</p>{error && <Notice error>{error}</Notice>}<form onSubmit={submit}>{mode === 'register' && <label>Seu nome<input name="name" autoComplete="name" required minLength={2} /></label>}<label>E-mail<input name="email" type="email" autoComplete="email" required /></label><label>Senha<input name="password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={mode === 'register' ? 10 : 1} required /></label><button className="button full" disabled={busy}>{busy ? 'Aguarde…' : mode === 'register' ? 'Criar conta' : 'Entrar'}</button></form><div className="auth-links">{mode === 'login' && <Link to="/esqueci-senha">Esqueci minha senha</Link>}<span>{mode === 'login' ? 'Ainda não tem conta?' : 'Já tem conta?'} <Link to={mode === 'login' ? '/cadastro' : '/entrar'}>{mode === 'login' ? 'Criar conta' : 'Entrar'}</Link></span></div></section></main>;
}
function ForgotPassword() {
  const [message, setMessage] = useState(''); const [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); setError(''); const email = String(new FormData(e.currentTarget).get('email')); try { await api.requestReset(email); setMessage('Se o e-mail estiver cadastrado, enviaremos um link de recuperação.'); } catch (err) { setError((err as Error).message); } }
  return <main className="auth-shell"><Brand /><section className="auth-card"><h1>Redefinir senha</h1><p>Informe o e-mail cadastrado para receber um link seguro.</p>{message && <Notice>{message}</Notice>}{error && <Notice error>{error}</Notice>}<form onSubmit={submit}><label>E-mail<input name="email" type="email" required /></label><button className="button full">Enviar link</button></form></section></main>;
}
function ResetPassword() {
  const [query] = useSearchParams(); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const password = String(new FormData(e.currentTarget).get('password')); try { await api.reset(query.get('token') ?? '', password); setMessage('Senha atualizada. Agora você pode entrar.'); } catch (err) { setError((err as Error).message); } }
  return <main className="auth-shell"><Brand /><section className="auth-card"><h1>Escolha uma nova senha</h1>{message && <Notice>{message} <Link to="/entrar">Entrar</Link></Notice>}{error && <Notice error>{error}</Notice>}<form onSubmit={submit}><label>Nova senha<input name="password" type="password" required minLength={10} /></label><button className="button full">Salvar senha</button></form></section></main>;
}
function AcceptInvite() {
  const [query] = useSearchParams(); const [message, setMessage] = useState('Validando convite…'); const nav = useNavigate();
  useEffect(() => { api.me().then(async () => { try { await api.acceptInvite(query.get('token') ?? ''); setMessage('Convite aceito.'); window.setTimeout(() => nav('/painel'), 900); } catch (err) { setMessage((err as Error).message); } }).catch(() => setMessage('Entre na sua conta com o e-mail que recebeu o convite e abra este link novamente.')); }, [nav, query]);
  return <main className="center"><p>{message}</p><Link to="/entrar">Ir para entrar</Link></main>;
}
function ConfirmRsvp() {
  const [slug] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('slug') ?? '');
  useEffect(() => { window.history.replaceState({}, '', '/confirmar-presenca'); }, []);
  return <main className="auth-shell"><Brand /><section className="auth-card"><span className="eyebrow">VAMOS CELEBRAR?</span><h1>Confirmação por código</h1><p>O formato de confirmação foi atualizado. Volte à lista, informe seu e-mail e solicite um código novo para digitar na página.</p>{slug && <Link className="button full" to={`/lista/${encodeURIComponent(slug)}`}>Voltar à lista</Link>}<Link to="/">Voltar ao início</Link></section></main>;
}
function Dashboard({ user, onLogout }: { user: User | null; onLogout: () => void }) {
  const [lists, setLists] = useState<WeddingList[]>([]); const [error, setError] = useState(''); const [show, setShow] = useState(false); const nav = useNavigate();
  useEffect(() => { api.lists().then(setLists).catch(err => setError(err.message)); }, []);
  async function create(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); try { const list = await api.createList({ coupleNames: String(f.get('coupleNames')), title: String(f.get('title')), description: String(f.get('description')) }); nav(`/painel/listas/${list.id}`); } catch (err) { setError((err as Error).message); } }
  return <><header className="topbar"><Brand /><nav><span className="muted">Olá, {user?.displayName}</span><button className="text-button" onClick={onLogout}>Sair</button></nav></header><main className="dashboard"><div className="section-heading"><div><span className="eyebrow">SEU ESPAÇO</span><h1>Suas listas</h1><p>Um lugar para organizar a celebração e compartilhar com os convidados.</p></div><button className="button" onClick={() => setShow(!show)}>＋ Nova lista</button></div>{error && <Notice error>{error}</Notice>}{show && <form className="form-panel" onSubmit={create}><h2>Começar uma lista</h2><label>Nome do casal<input name="coupleNames" required minLength={2} placeholder="Ana e Pedro" /></label><label>Título<input name="title" required minLength={2} placeholder="Nosso casamento" /></label><label>Mensagem aos convidados<textarea name="description" rows={3} /></label><button className="button">Criar lista</button></form>}{lists.length === 0 && !show ? <div className="empty-card"><span className="empty-icon">✿</span><h2>A história de vocês começa aqui</h2><p>Crie a primeira lista e personalize cada detalhe.</p><button className="button" onClick={() => setShow(true)}>Criar minha lista</button></div> : <div className="list-grid">{lists.map(l => <button key={l.id} className="list-card" onClick={() => nav(`/painel/listas/${l.id}`)}><span className={`status ${l.status.toLowerCase()}`}>{statusLabel(l.status)}</span><h2>{l.coupleNames}</h2><p>{l.title}</p><div className="card-stats"><span>{l._count?.gifts ?? 0} presentes</span><span>{l._count?.intentions ?? 0} intenções</span></div></button>)}</div>}<div className="billing-note"><span>◇</span><p><strong>Planos e mensalidade</strong><br />A cobrança recorrente será adicionada em uma etapa futura. Nenhum pagamento é processado nesta versão.</p></div></main></>;
}
function statusLabel(status: string) { return status === 'PUBLISHED' ? 'Publicada' : status === 'ARCHIVED' ? 'Arquivada' : 'Rascunho'; }
function ListEditor() {
  const { id = '' } = useParams(); const [list, setList] = useState<WeddingList | null>(null); const [gifts, setGifts] = useState<Gift[]>([]); const [intentions, setIntentions] = useState<Intention[]>([]); const [rsvps, setRsvps] = useState<Rsvp[]>([]); const [error, setError] = useState(''); const [tab, setTab] = useState<'gifts'|'intentions'|'rsvps'>('gifts'); const [invite, setInvite] = useState(''); const [feedback, setFeedback] = useState('');
  async function load() { try { const l = await api.getList(id); setList(l); setGifts(await api.gifts(id)); const i = await api.intentions(id); setIntentions(i.items); const r = await api.rsvps(id); setRsvps(r.items); } catch (err) { setError((err as Error).message); } }
  useEffect(() => { void load(); }, [id]);
  async function addGift(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const form=e.currentTarget; const f = new FormData(form); try { const value = Number(String(f.get('price')).replace(',', '.')); const created=await api.addGift(id, { name: String(f.get('name')), description: String(f.get('description')), priceCents: Math.round(value * 100), sortOrder: gifts.length }); const image=f.get('image'); if(image instanceof File&&image.size>0)await api.upload(id,image,created.id); form.reset(); await load(); } catch (err) { setError((err as Error).message); } }
  async function publish(status: string) { try { setList(await api.setListStatus(id, status)); } catch (err) { setError((err as Error).message); } }
  async function saveDetails(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const f = new FormData(e.currentTarget); try { const date=String(f.get('weddingDate')); const updated = await api.updateList(id, { coupleNames: String(f.get('coupleNames')), title: String(f.get('title')), description: String(f.get('description')), ...(date?{weddingDate:date}:{weddingDate:null}), slug: String(f.get('slug')) }); setList(updated); setFeedback('Dados da lista atualizados.'); } catch (err) { setError((err as Error).message); } }
  async function uploadListCover(file?: File) { if (!file) return; try { await api.upload(id, file); await load(); setFeedback('Imagem de capa atualizada.'); } catch (err) { setError((err as Error).message); } }
  async function uploadGiftImage(giftId: string, file?: File) { if (!file) return; try { await api.upload(id, file, giftId); await load(); setFeedback('Imagem do presente atualizada.'); } catch (err) { setError((err as Error).message); } }
  async function invitePartner(e: FormEvent<HTMLFormElement>) { e.preventDefault(); try { await api.invite(id, invite); setFeedback('Convite enviado.'); setInvite(''); } catch (err) { setError((err as Error).message); } }
  async function cancel(intentionId: string) { try { await api.cancelIntention(id, intentionId); await load(); } catch (err) { setError((err as Error).message); } }
  if (!list) return <main className="center">{error || 'Carregando lista…'}{error && <Link to="/painel">Voltar ao painel</Link>}</main>;
  return <><header className="topbar"><Brand /><nav><Link to="/painel">← Suas listas</Link>{list.status === 'PUBLISHED' && <Link className="button small" to={`/lista/${list.slug}`} target="_blank">Ver página pública ↗</Link>}</nav></header><main className="dashboard"><div className="section-heading"><div><span className="eyebrow">PAINEL DO CASAL</span><h1>{list.coupleNames}</h1><p>{list.title} · <span className={`status ${list.status.toLowerCase()}`}>{statusLabel(list.status)}</span></p></div><div className="inline-actions">{list.status !== 'ARCHIVED' && <button className="button secondary" onClick={() => publish(list.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED')}>{list.status === 'PUBLISHED' ? 'Retirar do ar' : 'Publicar lista'}</button>}{list.status !== 'ARCHIVED' && <button className="button ghost" onClick={() => publish('ARCHIVED')}>Arquivar</button>}</div></div>{error && <Notice error>{error}</Notice>}{feedback && <Notice>{feedback}</Notice>}<div className="editor-grid"><form className="form-panel" onSubmit={saveDetails}><h2>Detalhes da lista</h2><label>Nome do casal<input name="coupleNames" defaultValue={list.coupleNames} required minLength={2} /></label><label>Título<input name="title" defaultValue={list.title} required minLength={2} /></label><label>Mensagem aos convidados<textarea name="description" defaultValue={list.description} rows={3} /></label><label>Endereço público<input name="slug" defaultValue={list.slug} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></label><label>Data do casamento<input name="weddingDate" type="date" defaultValue={list.weddingDate?.slice(0, 10) ?? ''} /></label><button className="button secondary">Salvar detalhes</button></form><section className="form-panel"><h2>Imagem de capa</h2>{list.coverBlob && <StoredImage className="cover-preview" listId={list.id} blob={list.coverBlob} alt="Capa da lista" privateAccess />}<label>Enviar imagem JPG, PNG ou WebP (até 5 MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => uploadListCover(e.currentTarget.files?.[0])} /></label><p className="fine-print">Armazenada em contêiner privado no Azure Blob Storage.</p></section></div><form className="form-panel compact" onSubmit={invitePartner}><h2>Convidar seu par</h2><p>O convite dá acesso de edição à lista.</p><div className="inline-form"><input aria-label="E-mail do parceiro" type="email" value={invite} onChange={e => setInvite(e.target.value)} placeholder="email@exemplo.com" required /><button className="button secondary">Enviar convite</button></div></form><div className="tabs"><button type="button" className={tab === 'gifts' ? 'active' : ''} onClick={() => setTab('gifts')}>Presentes <b>{gifts.length}</b></button><button type="button" className={tab === 'intentions' ? 'active' : ''} onClick={() => setTab('intentions')}>Intenções <b>{intentions.length}</b></button><button type="button" className={tab === 'rsvps' ? 'active' : ''} onClick={() => setTab('rsvps')}>Presenças <b>{rsvps.length}</b></button></div>{tab === 'gifts' && <div className="editor-grid"><section><h2>Presentes da lista</h2>{gifts.length === 0 ? <p className="muted">Nenhum presente cadastrado ainda.</p> : <div className="gift-admin-list">{gifts.map(g => <article className="gift-admin" key={g.id}>{g.imageBlob && <StoredImage className="gift-thumb" listId={list.id} blob={g.imageBlob} alt="" privateAccess />}<div><strong>{g.name}</strong><p>{g.description}</p><label className="file-inline">Imagem<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => uploadGiftImage(g.id, e.currentTarget.files?.[0])} /></label></div><strong><Money cents={g.priceCents} /></strong><button type="button" className="text-button" onClick={async () => { await api.updateGift(id, g.id, { active: !g.active }); await load(); }}>{g.active ? 'Desativar' : 'Ativar'}</button></article>)}</div>}</section><form className="form-panel" onSubmit={addGift}><h2>Novo presente simbólico</h2><label>Nome<input name="name" required minLength={2} /></label><label>Descrição<textarea name="description" rows={3} /></label><label>Valor sugerido em reais<input name="price" type="number" min="0.01" step="0.01" required /></label><label>Imagem opcional<input name="image" type="file" accept="image/jpeg,image/png,image/webp" /></label><button className="button">Adicionar presente</button><p className="fine-print">O valor é apenas informativo nesta versão. Nenhum pagamento é processado.</p></form></div>}{tab === 'intentions' && <section className="form-panel"><h2>Intenções de presentear</h2>{intentions.length === 0 ? <p className="muted">As intenções recebidas aparecerão aqui.</p> : intentions.map(i => <article className="guest-row" key={i.id}><div><strong>{i.guestName}</strong><p>{i.gift.name} · <Money cents={i.gift.priceCents} /></p>{i.guestEmail && <p>{i.guestEmail}</p>}{i.message && <p>“{i.message}”</p>}</div><div><span className="status">{i.status === 'REGISTERED' ? 'Registrada' : 'Cancelada'}</span>{i.status === 'REGISTERED' && <button className="text-button" onClick={() => cancel(i.id)}>Cancelar registro</button>}</div></article>)}</section>}{tab === 'rsvps' && <section className="form-panel"><h2>Confirmações de presença</h2>{rsvps.length === 0 ? <p className="muted">As confirmações aparecerão aqui.</p> : rsvps.map(r => <article className="guest-row" key={r.id}><strong>{r.guestName}</strong><span className={`status ${r.attendance === 'YES' ? 'published' : 'draft'}`}>{r.attendance === 'YES' ? 'Vai comparecer' : 'Não poderá ir'}</span></article>)}</section>}</main></>;
}
function PublicPage() {
  const { slug = '' } = useParams(); const [list, setList] = useState<PublicList | null>(null); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [activeGift, setActiveGift] = useState<string | null>(null);
  useEffect(() => { api.publicList(slug).then(setList).catch(err => setError(err.message)); }, [slug]);
  if (error) return <main className="center"><h1>Lista indisponível</h1><p>Confira o endereço compartilhado pelo casal.</p><Link to="/">Voltar ao início</Link></main>;
  if (!list) return <main className="center">Carregando lista…</main>;
  return <><header className="topbar public-nav"><Brand /><span>celebrando juntos</span></header><main className="public-page">{list.coverBlob && <StoredImage className="public-cover" listId={list.id} blob={list.coverBlob} alt="" />}<section className="public-intro"><span className="eyebrow">COM MUITO AMOR</span><h1>{list.coupleNames}</h1><p>{list.description || 'Estamos muito felizes em compartilhar este momento com vocês.'}</p>{list.weddingDate && <span className="date-pill">{new Date(list.weddingDate).toLocaleDateString('pt-BR', { dateStyle: 'long' })}</span>}</section><div className="gift-intro"><div><span className="eyebrow">UM CARINHO PARA NOSSA NOVA HISTÓRIA</span><h2>Presentes simbólicos</h2></div><p>Escolha um presente e registre sua intenção. Nesta etapa não há pagamento nem entrega de produto físico.</p></div>{notice && <Notice>{notice}</Notice>}<div className="public-gifts">{list.gifts.map(g => <article className="public-gift" key={g.id}>{g.imageBlob ? <StoredImage className="public-gift-image" listId={list.id} blob={g.imageBlob} alt="" /> : <div className="gift-placeholder">✿</div>}<div className="public-gift-content"><h3>{g.name}</h3><p>{g.description}</p><strong><Money cents={g.priceCents} /></strong><button type="button" className="button secondary full" onClick={() => setActiveGift(activeGift === g.id ? null : g.id)}>{activeGift === g.id ? 'Fechar formulário' : 'Registrar intenção de presentear'}</button>{activeGift === g.id && <form className="intent-form open" onSubmit={async e => { e.preventDefault(); const f = new FormData(e.currentTarget); try { await api.intention(slug, { giftId: g.id, guestName: String(f.get('guestName')), guestEmail: String(f.get('guestEmail')) || undefined, message: String(f.get('message')) || undefined }); setNotice('Sua intenção foi registrada. O casal poderá vê-la na lista. Nenhum pagamento foi realizado.'); e.currentTarget.reset(); setActiveGift(null); } catch (err) { setNotice((err as Error).message); } }}><label>Seu nome<input name="guestName" required minLength={2} /></label><label>E-mail (opcional)<input name="guestEmail" type="email" /></label><label>Mensagem (opcional)<textarea name="message" rows={2} /></label><button className="button full">Registrar intenção</button></form>}</div></article>)}</div><section className="rsvp-section"><span className="eyebrow">VAMOS CELEBRAR?</span><h2>Você vem?</h2><RsvpForm slug={slug} /></section><p className="public-disclaimer">Os itens desta lista são simbólicos e representam valores sugeridos. Não há compra nem entrega de produtos físicos. Nesta versão, nenhuma contribuição financeira é processada.</p></main><footer>Com carinho, Nosso Sim</footer></>;
}
function RsvpForm({ slug }: { slug: string }) {
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [code, setCode] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(''); setMessage(''); setPendingEmail('');
    const form = e.currentTarget;
    const data = new FormData(form);
    const guestEmail = String(data.get('guestEmail'));
    try {
      const result = await api.rsvp(slug, { guestName: String(data.get('guestName')), guestEmail, attendance: String(data.get('attendance')) as 'YES' | 'NO' });
      setPendingEmail(guestEmail.trim()); setMessage(result.message); form.reset();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  async function resend() {
    setResending(true); setError(''); setMessage('');
    try { const result = await api.resendRsvpConfirmation(slug, pendingEmail); setCode(''); setMessage(result.message); }
    catch (err) { setError((err as Error).message); }
    finally { setResending(false); }
  }
  async function confirm() {
    setConfirming(true); setError(''); setMessage('');
    try { const result = await api.confirmRsvp(slug, pendingEmail, code); setMessage(result.message); setConfirmed(true); setCode(''); }
    catch (err) { setError((err as Error).message); }
    finally { setConfirming(false); }
  }
  return <>
    {message && <Notice>{message}</Notice>}{error && <Notice error>{error}</Notice>}
    {!pendingEmail && <form className="rsvp-form" onSubmit={submit}>
      <label>Seu nome<input name="guestName" required minLength={2} maxLength={100} /></label>
      <label>Seu e-mail<input name="guestEmail" type="email" autoComplete="email" required maxLength={320} /></label>
      <label>Confirmação<select name="attendance"><option value="YES">Sim, estarei lá</option><option value="NO">Não poderei comparecer</option></select></label>
      <button className="button" disabled={busy}>{busy ? 'Enviando…' : 'Enviar resposta →'}</button>
    </form>}
    <p className="fine-print">Usaremos o e-mail para confirmar sua resposta e impedir duplicatas. Ele não será mostrado ao casal.</p>
    {pendingEmail && !confirmed && <><form className="rsvp-form" onSubmit={e => { e.preventDefault(); void confirm(); }}><label>Código de 6 dígitos<input aria-label="Código de confirmação" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required /></label><button className="button" disabled={confirming || code.length !== 6}>{confirming ? 'Confirmando…' : 'Confirmar presença'}</button></form><button className="text-button" type="button" disabled={resending} onClick={resend}>{resending ? 'Enviando…' : 'Enviar outro código'}</button></>}
  </>;
}
export default App;
