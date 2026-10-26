import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, PublicRsvpForm, RsvpEvent, RsvpField, RsvpGroup, RsvpGuest, RsvpImportPreview, SubmitRsvpInput } from './api';
import { useToast } from './toast';

function toIso(value: string) { return value ? new Date(value).toISOString() : undefined; }
function dateTime(value?: string | null) { return value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'; }
function localDateTimeInput(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
function maskBrazilianPhone(value: string) {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  const firstPartLength = number.startsWith('9') ? 5 : 4;
  if (number.length <= firstPartLength) return `(${ddd}) ${number}`;
  return `(${ddd}) ${number.slice(0, firstPartLength)}-${number.slice(firstPartLength, firstPartLength + 4)}`;
}
function downloadGuestTemplate(event: RsvpEvent) {
  const headers = ['Nome', 'Telefone', ...event.companionGroups.map(group => group.label)];
  const csv = `\uFEFF${headers.map(value => `"${value.replaceAll('"', '""')}"`).join(';')}\r\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'modelo-convidados-rsvp.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

export function RsvpManager({ listId, weddingDate, listStatus, onEventsChange }: { listId: string; weddingDate?: string | null; listStatus: 'DRAFT'|'PUBLISHED'|'ARCHIVED'; onEventsChange?: (events: RsvpEvent[]) => void }) {
  const toast = useToast();
  const [events, setEvents] = useState<RsvpEvent[]>([]);
  const [selected, setSelected] = useState('');
  const [guests, setGuests] = useState<RsvpGuest[]>([]);
  const [responses, setResponses] = useState<Awaited<ReturnType<typeof api.rsvpResponses>> | null>(null);
  const [preview, setPreview] = useState<RsvpImportPreview | null>(null);
  const [extraFields, setExtraFields] = useState<RsvpField[]>([]);
  const [guestPhone, setGuestPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [sendScopePrompt, setSendScopePrompt] = useState(false);

  async function loadEvents() {
    try {
      const result = await api.rsvpEvents(listId);
      setEvents(result);
      onEventsChange?.(result);
      setSelected(current => current && result.some(event => event.id === current) ? current : result[0]?.id ?? '');
    } catch (err) { setError((err as Error).message); }
  }
  async function loadGuests(eventId: string) {
    if (!eventId) return;
    try { const result = await api.rsvpGuests(eventId); setGuests(result.items); setResponses(await api.rsvpResponses(eventId)); }
    catch (err) { setError((err as Error).message); }
  }
  useEffect(() => { void loadEvents(); }, [listId]);
  useEffect(() => { void loadGuests(selected); }, [selected]);

  async function createEvent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(''); setBusy(true);
    const target = e.currentTarget;
    const form = new FormData(target);
    const groups: RsvpGroup[] = [{ key: 'adultos', label: String(form.get('adultsLabel') || 'Adultos'), maxCount: Number(form.get('adultsMax') || 0) }];
    for (const kind of ['children', 'babies']) {
      const label = String(form.get(`${kind}Label`) || '').trim();
      if (label) groups.push({ key: kind, label, maxCount: Number(form.get(`${kind}Max`) || 0) });
    }
    try {
      const event = await api.createRsvpEvent(listId, {
        name: String(form.get('name')), eventDate: toIso(String(form.get('eventDate'))), responseDeadline: toIso(String(form.get('deadline')))!,
        mode: String(form.get('mode')) as 'OPEN'|'RESERVED', companionGroups: groups, customFields: extraFields, isOpen: form.get('isOpen') === 'on',
      });
      toast.success('Confirmação configurada. Os links serão enviados quando você publicar a lista.'); setExtraFields([]); setSelected(event.id); await loadEvents(); target.reset();
    } catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  }
  async function addExtraField(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const data = new FormData(e.currentTarget); const label = String(data.get('fieldLabel')).trim();
    if (!label) return;
    const type = String(data.get('fieldType')) as RsvpField['type'];
    setExtraFields(current => [...current, { key: `extra_${Date.now()}`, label, type, required: data.get('required') === 'on', ...(type === 'SELECT' ? { options: String(data.get('options') || '').split(',').map(option => option.trim()).filter(Boolean) } : {}) }]);
    e.currentTarget.reset();
  }
  async function toggleEvent(event: RsvpEvent) {
    setError('');
    if (!event.isOpen && (!event.responseDeadline || new Date(event.responseDeadline) <= new Date())) {
      setEditingDeadline(true);
      toast.error('Configure um prazo final futuro antes de abrir a confirmação.');
      return;
    }
    try { await api.updateRsvpEvent(event.id, { isOpen: !event.isOpen }); await loadEvents(); toast.success(event.isOpen ? 'Confirmação encerrada.' : 'Confirmação aberta.'); }
    catch (err) { toast.error((err as Error).message); }
  }
  async function saveDeadline(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!event) return;
    const deadline = toIso(String(new FormData(e.currentTarget).get('deadline')));
    if (!deadline || new Date(deadline) <= new Date()) { toast.error('Escolha um prazo final futuro.'); return; }
    try { await api.updateRsvpEvent(event.id, { responseDeadline: deadline }); setEditingDeadline(false); await loadEvents(); toast.success('Prazo de resposta atualizado.'); }
    catch (err) { toast.error((err as Error).message); }
  }
  async function removeEvent(event: RsvpEvent) {
    if (!window.confirm(`Remover o evento “${event.name}” e seus convidados e respostas?`)) return;
    try { await api.deleteRsvpEvent(event.id); await loadEvents(); toast.success('Evento removido.'); }
    catch (err) { toast.error((err as Error).message); }
  }
  async function addGuest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const target = e.currentTarget; const data = new FormData(target); setError('');
    const companionAllowance = Object.fromEntries((event?.companionGroups ?? []).map(group => [group.key, Number(data.get(`allowance_${group.key}`) ?? group.maxCount)]));
    try { await api.addRsvpGuest(selected, { guestName: String(data.get('guestName')), phone: String(data.get('phone')), companionAllowance }); toast.success('Convidado cadastrado. O link será incluído no envio quando você publicar.'); target.reset(); setGuestPhone(''); await loadGuests(selected); await loadEvents(); }
    catch (err) { toast.error((err as Error).message); }
  }
  async function previewFile(file?: File) {
    setPreview(null); if (!file || !selected) return;
    try { setPreview(await api.previewRsvpImport(selected, file)); }
    catch (err) { toast.error((err as Error).message); }
  }
  async function importPreview() {
    if (!preview || !selected) return;
    try { const result = await api.importRsvpGuests(selected, preview.validRows); toast.success(`${result.imported} convidados importados. Nenhum link foi enviado.`); setPreview(null); await loadGuests(selected); await loadEvents(); }
    catch (err) { toast.error((err as Error).message); }
  }
  async function sendAll(scope: 'NEW'|'PENDING') {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      const result = await api.sendAllRsvpGuests(selected, scope);
      setSendScopePrompt(false);
      if (result.failed) toast.error(`${result.accepted} links aceitos; ${result.failed} falharam. Confira os convidados e tente novamente.`);
      else toast.success(`${result.accepted} links aceitos para envio.`);
      await loadGuests(selected);
    }
    catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  }
  async function sendOne(guest: RsvpGuest) {
    try { const result = await api.sendRsvpGuest(selected, guest.id); toast.success(result.message); await loadGuests(selected); }
    catch (err) { toast.error((err as Error).message); await loadGuests(selected); }
  }
  async function exportResponses() {
    if (!selected) return;
    try { await api.downloadRsvpExport(selected); toast.success('Arquivo CSV exportado.'); } catch (err) { toast.error((err as Error).message); }
  }

  const event = events.find(item => item.id === selected);
  const eventAcceptingResponses = Boolean(event?.isOpen && event.responseDeadline && new Date(event.responseDeadline) > new Date());
  return <div className="rsvp-manager" id="rsvp-manager">
    {error && <div className="notice error" role="alert">{error}</div>}
    <section className="form-panel">
      <h2>Confirmação de presença</h2>
      {event && <article className="rsvp-event-card selected">
        <div className="rsvp-event-select"><strong>{event.name}</strong><span>{event.mode === 'OPEN' ? 'Link solicitado na página pública' : 'Links individuais por WhatsApp'} · {event.isOpen && event.responseDeadline && new Date(event.responseDeadline) > new Date() ? 'Aberta' : event.responseDeadline ? 'Fechada' : 'Não configurada'} · prazo {dateTime(event.responseDeadline)}</span><small>{event._count?.guests ?? 0} convidados cadastrados</small></div>
        <div className="inline-actions">{event.responseDeadline && <button type="button" className="button secondary small" onClick={() => void toggleEvent(event)}>{event.isOpen ? 'Fechar confirmação' : 'Abrir confirmação'}</button>}<button type="button" className="text-button" onClick={() => setEditingDeadline(value => !value)}>{event.responseDeadline ? 'Editar prazo' : 'Configurar prazo'}</button><button type="button" className="text-button" onClick={() => void removeEvent(event)}>Remover</button></div>
      </article>}
      {event && (!event.responseDeadline || editingDeadline) && <form className="form-panel compact" onSubmit={saveDeadline}><h3>{event.responseDeadline ? 'Editar prazo de resposta' : 'Configurar confirmação'}</h3><p>A página da lista e a confirmação têm estados independentes. Para receber respostas, informe um prazo futuro e abra a confirmação.</p><label>Prazo final de resposta<input name="deadline" type="datetime-local" defaultValue={localDateTimeInput(event.responseDeadline)} required min={localDateTimeInput(new Date(Date.now() + 60_000).toISOString())} /></label><div className="inline-actions"><button className="button">Salvar prazo</button><button type="button" className="button ghost" onClick={() => setEditingDeadline(false)}>Cancelar</button></div></form>}
      {events.length === 0 ? <><p>O RSVP é opcional. Você pode publicar só a página de presentes ou configurar uma confirmação agora; o prazo só é necessário para receber respostas.</p><details className="rsvp-create-event" open><summary className="button secondary">＋ Configurar confirmação</summary>
        <form className="rsvp-form" onSubmit={createEvent}>
          <label>Nome do evento<input name="name" required minLength={2} placeholder="Cerimônia e festa" /></label>
          <label>Data e horário<input name="eventDate" type="datetime-local" defaultValue={weddingDate ? `${weddingDate.slice(0, 10)}T18:00` : ''} /></label>
          <label>Prazo final de resposta<input name="deadline" type="datetime-local" required /></label>
          <label>Tipo de confirmação<select name="mode"><option value="RESERVED">Reservada, lista de convidados e links por WhatsApp</option><option value="OPEN">Aberta, qualquer convidado pode pedir o link</option></select></label>
          <h3>Limites de acompanhantes por pessoa</h3>
          <div className="rsvp-group-config"><label>Grupo principal<input name="adultsLabel" defaultValue="Adultos" required /></label><label>Máximo<input name="adultsMax" type="number" min="0" max="20" defaultValue="5" required /></label></div>
          <div className="rsvp-group-config"><label>Grupo opcional<input name="childrenLabel" placeholder="Crianças (opcional)" /></label><label>Máximo<input name="childrenMax" type="number" min="0" max="20" defaultValue="2" /></label></div>
          <div className="rsvp-group-config"><label>Grupo opcional<input name="babiesLabel" placeholder="Bebês (opcional)" /></label><label>Máximo<input name="babiesMax" type="number" min="0" max="20" defaultValue="1" /></label></div>
          {extraFields.map(field => <p className="fine-print" key={field.key}>{field.label} · {field.type} {field.required ? '· obrigatório' : ''}<button type="button" className="text-button" onClick={() => setExtraFields(current => current.filter(item => item.key !== field.key))}>Remover</button></p>)}
          <label className="checkbox-label"><input name="isOpen" type="checkbox" defaultChecked /> Abrir confirmação após configurar (a página só ficará pública quando a lista for publicada)</label>
          <button className="button" disabled={busy}>{busy ? 'Criando…' : 'Criar evento'}</button>
        </form>
        <details className="rsvp-extra-field"><summary>Adicionar campo extra</summary><form className="rsvp-form" onSubmit={addExtraField}>
          <label>Pergunta<input name="fieldLabel" required maxLength={80} /></label><label>Tipo<select name="fieldType"><option value="TEXT">Texto</option><option value="YES_NO">Sim ou não</option><option value="SELECT">Escolha única</option></select></label><label>Opções (separadas por vírgula)<input name="options" placeholder="Vegetariano, Vegano" /></label><label className="checkbox-label"><input name="required" type="checkbox" /> Resposta obrigatória</label><button className="button secondary">Adicionar campo</button>
        </form></details>
      </details></> : <p className="fine-print">Esta lista tem uma confirmação de presença. Você pode editar o prazo e abrir ou fechar as respostas quando quiser.</p>}
    </section>

    {event && <>
      <section className="form-panel rsvp-summary">
        <div><h2>{event.name}</h2><p>{responses?.yes ?? 0} confirmados · {responses?.no ?? 0} não poderão ir · prazo {dateTime(event.responseDeadline)}</p></div>
        <button type="button" className="button secondary" onClick={() => void exportResponses()}>Exportar CSV</button>
      </section>
      {event.mode === 'OPEN' && <section className="form-panel"><h2>Links da confirmação aberta</h2><p>Convidados informam o telefone na página pública para receber o link pelo WhatsApp.</p></section>}
      {event.mode === 'RESERVED' && <>
        <div className="editor-grid">
          <form className="form-panel" onSubmit={addGuest}><h2>Adicionar convidado</h2><label>Nome<input name="guestName" required minLength={2} /></label><label>Telefone com DDD<input name="phone" type="tel" inputMode="numeric" autoComplete="tel" value={guestPhone} onChange={e => setGuestPhone(maskBrazilianPhone(e.target.value))} required pattern={'\\([0-9]{2}\\) [0-9]{4,5}-[0-9]{4}'} title="Digite um telefone com DDD, por exemplo (11) 99999-9999." placeholder="(11) 99999-9999" maxLength={15} /></label><h3>Limites de acompanhantes</h3>{event.companionGroups.map(group => <label key={group.key}>{group.label}<input name={`allowance_${group.key}`} type="number" min="0" max={group.maxCount} defaultValue={group.maxCount} required /></label>)}<button className="button secondary">Cadastrar convidado</button></form>
          <section className="form-panel"><h2>Importar convidados</h2><p>Use o modelo CSV do evento ou uma planilha com nome, telefone e limites dos acompanhantes.</p><p className="fine-print">Telefone com DDD; sem código do país, o sistema assume +55. Os números nas colunas de acompanhantes definem o limite permitido para cada convidado.</p><button type="button" className="button secondary" onClick={() => downloadGuestTemplate(event)}>Baixar modelo CSV</button><p>Também aceita arquivos XLS e XLSX. Revise a prévia; os links serão enviados quando a lista for publicada.</p><input type="file" accept=".csv,.xls,.xlsx" onChange={e => void previewFile(e.currentTarget.files?.[0])} />
            {preview && <><p>{preview.validRows.length} válidos de {preview.totalRows} linhas.</p>{preview.errors.length > 0 && <ul>{preview.errors.slice(0, 20).map((item, index) => <li key={`${item.row}-${index}`}>Linha {item.row}: {item.message}</li>)}</ul>}<button type="button" className="button secondary" disabled={!preview.validRows.length} onClick={() => void importPreview()}>Importar válidos</button></>}
          </section>
        </div>
        <div className="inline-actions"><button type="button" className="button" disabled={busy || listStatus !== 'PUBLISHED' || !eventAcceptingResponses || guests.filter(guest => guest.source === 'RESERVED' && !guest.respondedAt && (!guest.whatsappStatus || guest.whatsappStatus === 'PENDING' || guest.whatsappStatus === 'FAILED')).length === 0} onClick={() => setSendScopePrompt(true)}>{busy ? 'Enviando…' : 'Enviar ou reenviar links pendentes'}</button><p className="fine-print">{listStatus !== 'PUBLISHED' ? 'Os links serão enviados quando você publicar a lista.' : !eventAcceptingResponses ? 'Abra a confirmação e confira se o prazo ainda está no futuro para enviar os links.' : 'O envio automático acontece na primeira publicação. Aqui você pode reenviar convidados pendentes ou com falha.'}</p></div>
        {sendScopePrompt && <section className="form-panel compact" role="group" aria-label="Escolher convidados para envio"><h3>Quem deve receber o link?</h3><div className="inline-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => void sendAll('NEW')}>Somente convidados novos</button><button type="button" className="button" disabled={busy} onClick={() => void sendAll('PENDING')}>Novos e pendentes, incluindo falhas</button><button type="button" className="button ghost" onClick={() => setSendScopePrompt(false)}>Cancelar</button></div></section>}
      </>}
      <section className="form-panel"><h2>Convidados e respostas</h2>{guests.length === 0 ? <p className="muted">Nenhum convidado ou resposta neste evento.</p> : <div className="rsvp-guest-list">{guests.map(guest => <article className="guest-row rsvp-guest-row" key={guest.id}>
        <div><strong>{guest.guestName || 'Aguardando nome do convidado'}</strong><p>{guest.phoneE164 || 'RSVP legado sem telefone'} · {guest.attendance === 'YES' ? 'Vai comparecer' : guest.attendance === 'NO' ? 'Não poderá ir' : 'Sem resposta'}</p><p>{guest.respondedAt ? `Resposta: ${dateTime(guest.respondedAt)}` : guest.firstOpenedAt ? `Link aberto: ${dateTime(guest.firstOpenedAt)}` : guest.whatsappStatus === 'FAILED' ? 'Falha no envio; link pode ser reenviado' : guest.whatsappStatus === 'DELIVERED' ? 'Link entregue pelo WhatsApp' : guest.whatsappStatus === 'SENT' ? 'WhatsApp aceitou o link; aguardando entrega' : guest.whatsappStatus === 'PENDING' ? 'Envio pelo WhatsApp pendente' : 'Link ainda não enviado'}</p>{guest.whatsappStatus && <small>WhatsApp: {guest.whatsappStatus}</small>}</div>
        {event.mode === 'RESERVED' && guest.source === 'RESERVED' && !guest.respondedAt && listStatus === 'PUBLISHED' && eventAcceptingResponses && <button type="button" className="button secondary small" onClick={() => void sendOne(guest)}>{guest.whatsappStatus ? 'Reenviar link' : 'Enviar link'}</button>}
      </article>)}</div>}</section>
      {responses && responses.items.length > 0 && <section className="form-panel"><h2>Respostas registradas</h2>{responses.items.map(response => <article className="guest-row" key={response.id}><div><strong>{response.guestName}</strong><p>{response.phoneE164} · {response.attendance === 'YES' ? 'Vai comparecer' : 'Não poderá ir'}</p><small>{Object.entries(response.companionCounts ?? {}).map(([key, value]) => `${key}: ${value}`).join(' · ')}</small></div><span>{dateTime(response.respondedAt)}</span></article>)}</section>}
    </>}
  </div>;
}

export function PublicRsvpList({ slug, events }: { slug: string; events: NonNullable<import('./api').PublicList['rsvpEvents']> }) {
  if (!events.length) return null;
  return <div className="public-rsvp-events">{events.map(event => <OpenLinkRequest key={event.id} slug={slug} event={event} />)}</div>;
}

function OpenLinkRequest({ slug, event }: { slug: string; event: NonNullable<import('./api').PublicList['rsvpEvents']>[number] }) {
  const toast = useToast(); const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); const target = e.currentTarget;
    try { const result = await api.requestRsvpLink(slug, event.id, String(new FormData(target).get('phone'))); toast.success(result.message); target.reset(); setPhone(''); }
    catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="form-panel"><h3>{event.name}</h3>{event.eventDate && <p>{dateTime(event.eventDate)}</p>}{event.mode === 'OPEN' ? <form className="rsvp-form" onSubmit={submit}><label>Seu telefone com DDD<input name="phone" type="tel" inputMode="numeric" autoComplete="tel" value={phone} onChange={e => setPhone(maskBrazilianPhone(e.target.value))} required pattern={'\\([0-9]{2}\\) [0-9]{4,5}-[0-9]{4}'} title="Digite um telefone com DDD, por exemplo (11) 99999-9999." placeholder="(11) 99999-9999" maxLength={15} /></label><p className="fine-print">Enviaremos um link de confirmação pelo WhatsApp.</p><button className="button" disabled={busy}>{busy ? 'Enviando link…' : 'Receber link para confirmar'}</button></form> : <p>Esta confirmação é reservada. Use o link individual enviado ao seu telefone.</p>}</section>;
}

export function RsvpTokenPage() {
  const { token = '' } = useParams();
  const [data, setData] = useState<PublicRsvpForm | null>(null);
  const toast = useToast(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const opened = useRef(false);
  useEffect(() => { api.publicRsvp(token).then(setData).catch(err => setError((err as Error).message)); }, [token]);
  useEffect(() => {
    if (!data || opened.current) return;
    const mark = () => { if (!opened.current && document.visibilityState === 'visible') { opened.current = true; void api.markRsvpOpened(token).catch(() => {}); } };
    mark(); document.addEventListener('visibilitychange', mark);
    return () => document.removeEventListener('visibilitychange', mark);
  }, [data, token]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!data) return; setBusy(true);
    const form = new FormData(e.currentTarget); const companionCounts: Record<string, number> = {}; const customAnswers: Record<string, string|boolean> = {};
    for (const group of data.event.companionGroups) companionCounts[group.key] = Number(form.get(`group_${group.key}`) || 0);
    for (const field of data.event.customFields) {
      const value = form.get(`field_${field.key}`);
      if (value !== null && value !== '') customAnswers[field.key] = field.type === 'YES_NO' ? value === 'true' : String(value);
    }
    const payload: SubmitRsvpInput = { attendance: String(form.get('attendance')) as 'YES'|'NO', companionCounts, customAnswers, ...(data.guest.source === 'OPEN' ? { guestName: String(form.get('guestName')) } : {}) };
    try { const result = await api.submitRsvp(token, payload); toast.success(result.message); setData(current => current ? { ...current, guest: { ...current.guest, guestName: payload.guestName ?? current.guest.guestName, attendance: payload.attendance, companionCounts, customAnswers } } : current); }
    catch (err) { toast.error((err as Error).message); }
    finally { setBusy(false); }
  }
  if (error && !data) return <main className="auth-shell"><section className="auth-card"><h1>Link indisponível</h1><p>{error}</p><Link to="/">Voltar ao início</Link></section></main>;
  if (!data) return <main className="center">Carregando confirmação…</main>;
  return <main className="auth-shell"><Link className="brand" to="/">nosso <i>sim</i></Link><section className="auth-card rsvp-token-card"><span className="eyebrow">CONFIRMAÇÃO DE PRESENÇA</span><h1>{data.event.name}</h1><p>{data.coupleNames}{data.event.eventDate ? ` · ${dateTime(data.event.eventDate)}` : ''}</p>
    <form className="rsvp-form" onSubmit={submit}>
      {data.guest.source === 'OPEN' && <label>Seu nome<input name="guestName" defaultValue={data.guest.guestName ?? ''} required minLength={2} maxLength={100} /></label>}
      <label>Confirmação<select name="attendance" defaultValue={data.guest.attendance ?? 'YES'}><option value="YES">Sim, estarei lá</option><option value="NO">Não poderei comparecer</option></select></label>
      {data.event.companionGroups.map(group => {
        const limit = data.guest.source === 'RESERVED' ? data.guest.companionAllowance[group.key] ?? 0 : group.maxCount;
        return <label key={group.key}>{group.label} que levará<input name={`group_${group.key}`} type="number" min="0" max={limit} defaultValue={data.guest.companionCounts?.[group.key] ?? 0} /></label>;
      })}
      {data.event.customFields.map(field => <label key={field.key}>{field.label}{field.type === 'TEXT' ? <input name={`field_${field.key}`} required={field.required} defaultValue={String(data.guest.customAnswers?.[field.key] ?? '')} maxLength={500} /> : field.type === 'YES_NO' ? <select name={`field_${field.key}`} required={field.required} defaultValue={String(data.guest.customAnswers?.[field.key] ?? '')}><option value="">Selecione</option><option value="true">Sim</option><option value="false">Não</option></select> : <select name={`field_${field.key}`} required={field.required} defaultValue={String(data.guest.customAnswers?.[field.key] ?? '')}><option value="">Selecione</option>{(field.options ?? []).map(option => <option key={option} value={option}>{option}</option>)}</select>}</label>)}
      <button className="button full" disabled={busy}>{busy ? 'Salvando…' : data.guest.attendance ? 'Atualizar resposta' : 'Confirmar presença'}</button>
    </form><p className="fine-print">Você pode atualizar sua resposta até {dateTime(data.event.responseDeadline)}.</p>
  </section></main>;
}
