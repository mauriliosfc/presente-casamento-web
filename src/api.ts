import type { components } from './generated/api-schema';
import type { ImagePresentation } from './image-upload';
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
type ApiError = Error & { status?: number };
type RegisterInput = components['schemas']['RegisterDto'];
type LoginInput = components['schemas']['LoginDto'];
type CreateListInput = components['schemas']['CreateListDto'];
type UpdateListInput = components['schemas']['UpdateListDto'];
type CreateGiftInput = components['schemas']['CreateGiftDto'];
type UpdateGiftInput = components['schemas']['UpdateGiftDto'];
type CreateRsvpInput = components['schemas']['CreateRsvpDto'];
type ResendRsvpConfirmationInput = components['schemas']['ResendRsvpConfirmationDto'];
type ConfirmRsvpInput = components['schemas']['ConfirmRsvpDto'];
let csrfToken = '';
export async function csrf() { const response = await fetch(`${API}/auth/csrf`, { credentials: 'include' }); const data = await response.json(); csrfToken = data.csrfToken; return csrfToken; }
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !csrfToken) await csrf();
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) headers.set('x-csrf-token', csrfToken);
  const response = await fetch(`${API}${path}`, { ...options, headers, credentials: 'include' });
  const body = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  if (!response.ok) { const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message ?? 'Não foi possível concluir a operação.'; const error = new Error(message) as ApiError; error.status = response.status; throw error; }
  return body as T;
}
export const api = {
  me: () => request<{ user: User }>('/auth/me'), login: (email: string, password: string) => request<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password } satisfies LoginInput) }),
  register: (displayName: string, email: string, password: string) => request<{ user: User }>('/auth/register', { method: 'POST', body: JSON.stringify({ displayName, email, password } satisfies RegisterInput) }),
  logout: () => request('/auth/logout', { method: 'POST' }), requestReset: (email: string) => request('/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ email }) }),
  reset: (token: string, password: string) => request('/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify({ token, password }) }),
  lists: () => request<WeddingList[]>('/lists'), createList: (data: CreateListInput) => request<WeddingList>('/lists', { method: 'POST', body: JSON.stringify(data) }),
  getList: (id: string) => request<WeddingList>(`/lists/${id}`), updateList: (id: string, data: UpdateListInput) => request<WeddingList>(`/lists/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  setListStatus: (id: string, status: string) => request<WeddingList & { firstPublication: boolean }>(`/lists/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  gifts: (id: string) => request<Gift[]>(`/lists/${id}/gifts`), addGift: (id: string, data: CreateGiftInput) => request<Gift>(`/lists/${id}/gifts`, { method: 'POST', body: JSON.stringify(data) }),
  updateGift: (listId: string, giftId: string, data: UpdateGiftInput) => request<Gift>(`/lists/${listId}/gifts/${giftId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  intentions: (id: string) => request<{items: Intention[]; total: number}>(`/lists/${id}/intentions`), cancelIntention: (listId: string, intentionId: string) => request(`/lists/${listId}/intentions/${intentionId}/cancel`, { method: 'POST' }),
  rsvps: (id: string) => request<{items: Rsvp[]; total: number}>(`/lists/${id}/rsvps`),
  rsvpEvents: (id: string) => request<RsvpEvent[]>(`/lists/${id}/rsvp-events`),
  createRsvpEvent: (id: string, data: CreateRsvpEventInput) => request<RsvpEvent>(`/lists/${id}/rsvp-events`, { method: 'POST', body: JSON.stringify(data) }),
  updateRsvpEvent: (id: string, data: Partial<CreateRsvpEventInput> & { isOpen?: boolean }) => request<RsvpEvent>(`/rsvp-events/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRsvpEvent: (id: string) => request(`/rsvp-events/${id}`, { method: 'DELETE' }),
  rsvpGuests: (id: string) => request<{ items: RsvpGuest[]; total: number }>(`/rsvp-events/${id}/guests`),
  addRsvpGuest: (id: string, data: CreateRsvpGuestInput) => request(`/rsvp-events/${id}/guests`, { method: 'POST', body: JSON.stringify(data) }),
  previewRsvpImport: (id: string, file: File) => { const form = new FormData(); form.append('file', file); return request<RsvpImportPreview>(`/rsvp-events/${id}/guests/import/preview`, { method: 'POST', body: form }); },
  importRsvpGuests: (id: string, rows: RsvpImportRow[]) => request<{ imported: number }>(`/rsvp-events/${id}/guests/import`, { method: 'POST', body: JSON.stringify({ rows }) }),
  sendRsvpGuest: (eventId: string, guestId: string) => request<{ accepted: boolean; message: string }>(`/rsvp-events/${eventId}/guests/${guestId}/send`, { method: 'POST' }),
  sendAllRsvpGuests: (eventId: string, scope: 'NEW'|'PENDING') => request<{ attempted: number; accepted: number; failed: number; results: Array<{ guestId: string; guestName: string|null; accepted: boolean }> }>(`/rsvp-events/${eventId}/guests/send-all`, { method: 'POST', body: JSON.stringify({ scope }) }),
  rsvpResponses: (id: string) => request<RsvpResponses>(`/rsvp-events/${id}/responses`),
  downloadRsvpExport: async (id: string) => { const response = await fetch(`${API}/rsvp-events/${encodeURIComponent(id)}/responses/export`, { credentials: 'include' }); if (!response.ok) throw new Error('Não foi possível exportar as respostas.'); const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'confirmacoes-presenca.csv'; link.click(); URL.revokeObjectURL(url); },
  requestRsvpLink: (slug: string, eventId: string, phone: string) => request<{ accepted: boolean; message: string }>(`/public/${encodeURIComponent(slug)}/rsvp-events/${encodeURIComponent(eventId)}/request-link`, { method: 'POST', body: JSON.stringify({ phone }) }),
  publicRsvp: (token: string) => request<PublicRsvpForm>(`/public/rsvp/${encodeURIComponent(token)}`),
  markRsvpOpened: (token: string) => request(`/public/rsvp/${encodeURIComponent(token)}/opened`, { method: 'POST' }),
  submitRsvp: (token: string, data: SubmitRsvpInput) => request<{ saved: boolean; message: string }>(`/public/rsvp/${encodeURIComponent(token)}/response`, { method: 'POST', body: JSON.stringify(data) }),
  invite: (id: string, email: string) => request(`/lists/${id}/invitations`, { method: 'POST', body: JSON.stringify({ email }) }),
  acceptInvite: (token: string) => request(`/lists/invitations/${encodeURIComponent(token)}/accept`, { method: 'POST' }),
  publicList: (slug: string) => request<PublicList>(`/lists/public/${encodeURIComponent(slug)}`), intention: (slug: string, data: unknown) => request(`/public/${encodeURIComponent(slug)}/intentions`, { method: 'POST', body: JSON.stringify(data) }),
  rsvp: (slug: string, data: CreateRsvpInput) => request<{ pending: boolean; message: string }>(`/public/${encodeURIComponent(slug)}/rsvps`, { method: 'POST', body: JSON.stringify(data) }),
  resendRsvpConfirmation: (slug: string, guestEmail: string) => request<{ accepted: boolean; message: string }>(`/public/${encodeURIComponent(slug)}/rsvps/resend-confirmation`, { method: 'POST', body: JSON.stringify({ guestEmail } satisfies ResendRsvpConfirmationInput) }),
  confirmRsvp: (slug: string, guestEmail: string, code: string) => request<{ confirmed: boolean; message: string }>(`/public/${encodeURIComponent(slug)}/rsvps/confirm`, { method: 'POST', body: JSON.stringify({ guestEmail, code } satisfies ConfirmRsvpInput) }),
  imageUrl: (listId: string, blob: string) => `${API}/lists/${encodeURIComponent(listId)}/assets/public?blob=${encodeURIComponent(blob)}`,
  imagePreviewUrl: async (listId: string, blob: string) => (await request<{ url: string }>(`/lists/${encodeURIComponent(listId)}/assets/preview?blob=${encodeURIComponent(blob)}`)).url,
  upload: async (listId: string, file: File, giftId?: string, presentation: ImagePresentation = { mode: 'CROP', focalX: 0.5, focalY: 0.5 }) => { const form = new FormData(); form.append('file', file); form.append('mode', presentation.mode); form.append('focalX', String(presentation.focalX)); form.append('focalY', String(presentation.focalY)); const query = giftId ? `?giftId=${encodeURIComponent(giftId)}` : ''; return request<{ blobName: string; url: string; width: number; height: number }>(`/lists/${listId}/assets${query}`, { method: 'POST', body: form }); },
};
export type User = { id: string; email: string; displayName: string };
export type WeddingList = { id: string; coupleNames: string; title: string; description: string; weddingDate?: string|null; firstPublishedAt?: string|null; slug: string; coverBlob?: string; status: 'DRAFT'|'PUBLISHED'|'ARCHIVED'; _count?: {gifts:number;intentions:number;rsvps:number} };
export type Gift = { id:string; name:string; description:string; priceCents:number; imageBlob?:string; active:boolean; sortOrder:number };
export type RsvpMode = 'OPEN' | 'RESERVED';
export type RsvpGroup = { key: string; label: string; maxCount: number };
export type RsvpField = { key: string; label: string; type: 'TEXT'|'YES_NO'|'SELECT'; required: boolean; options?: string[] };
export type RsvpEvent = { id: string; listId: string; name: string; eventDate?: string|null; responseDeadline: string|null; mode: RsvpMode; isOpen: boolean; companionGroups: RsvpGroup[]; customFields: RsvpField[]; _count?: { guests: number } };
export type RsvpGuest = { id: string; guestName: string|null; phoneE164: string|null; guestEmail?: string|null; source: 'OPEN'|'RESERVED'|'LEGACY'; companionAllowance: Record<string, number>; attendance?: 'YES'|'NO'|null; companionCounts?: Record<string, number>|null; customAnswers?: Record<string, string|boolean>|null; firstOpenedAt?: string|null; respondedAt?: string|null; whatsappStatus?: 'PENDING'|'SENT'|'DELIVERED'|'FAILED'|null; whatsappSentAt?: string|null; smsStatus?: 'PENDING'|'SENT'|'DELIVERED'|'FAILED'|null; smsSentAt?: string|null; createdAt?: string };
export type RsvpResponses = { items: Array<{ id: string; guestName: string|null; phoneE164: string|null; attendance: 'YES'|'NO'|null; companionCounts?: Record<string, number>|null; customAnswers?: Record<string, string|boolean>|null; respondedAt: string|null; source: 'OPEN'|'RESERVED'|'LEGACY' }>; total: number; yes: number; no: number };
export type CreateRsvpEventInput = { name: string; eventDate?: string; responseDeadline: string; mode: RsvpMode; companionGroups: RsvpGroup[]; customFields: RsvpField[]; isOpen?: boolean };
export type CreateRsvpGuestInput = { guestName: string; phone: string; guestEmail?: string; companionAllowance?: Record<string, number> };
export type RsvpImportRow = CreateRsvpGuestInput;
export type RsvpImportPreview = { validRows: RsvpImportRow[]; errors: Array<{ row: number; message: string }>; totalRows: number };
export type PublicRsvpForm = { event: Pick<RsvpEvent, 'id'|'name'|'eventDate'|'responseDeadline'|'companionGroups'|'customFields'>; coupleNames: string; guest: { guestName: string|null; source: 'OPEN'|'RESERVED'|'LEGACY'; attendance: 'YES'|'NO'|null; companionCounts?: Record<string, number>|null; customAnswers?: Record<string, string|boolean>|null; companionAllowance: Record<string, number> } };
export type SubmitRsvpInput = { guestName?: string; attendance: 'YES'|'NO'; companionCounts?: Record<string, number>; customAnswers?: Record<string, string|boolean> };
export type PublicList = Omit<WeddingList,'status'|'_count'> & { gifts: Gift[]; rsvpEvents?: Array<Pick<RsvpEvent, 'id'|'name'|'eventDate'|'responseDeadline'|'mode'>> };
export type Intention = {id:string;guestName:string;guestEmail?:string;message?:string;status:'REGISTERED'|'CANCELLED';createdAt:string;gift:{name:string;priceCents:number}};
export type Rsvp = {id:string;guestName:string;attendance:'YES'|'NO';createdAt:string};
