import type { components } from './generated/api-schema';
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
  setListStatus: (id: string, status: string) => request<WeddingList>(`/lists/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  gifts: (id: string) => request<Gift[]>(`/lists/${id}/gifts`), addGift: (id: string, data: CreateGiftInput) => request<Gift>(`/lists/${id}/gifts`, { method: 'POST', body: JSON.stringify(data) }),
  updateGift: (listId: string, giftId: string, data: UpdateGiftInput) => request<Gift>(`/lists/${listId}/gifts/${giftId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  intentions: (id: string) => request<{items: Intention[]; total: number}>(`/lists/${id}/intentions`), cancelIntention: (listId: string, intentionId: string) => request(`/lists/${listId}/intentions/${intentionId}/cancel`, { method: 'POST' }),
  rsvps: (id: string) => request<{items: Rsvp[]; total: number}>(`/lists/${id}/rsvps`), invite: (id: string, email: string) => request(`/lists/${id}/invitations`, { method: 'POST', body: JSON.stringify({ email }) }),
  acceptInvite: (token: string) => request(`/lists/invitations/${encodeURIComponent(token)}/accept`, { method: 'POST' }),
  publicList: (slug: string) => request<PublicList>(`/lists/public/${encodeURIComponent(slug)}`), intention: (slug: string, data: unknown) => request(`/public/${encodeURIComponent(slug)}/intentions`, { method: 'POST', body: JSON.stringify(data) }),
  rsvp: (slug: string, data: CreateRsvpInput) => request<{ pending: boolean; message: string }>(`/public/${encodeURIComponent(slug)}/rsvps`, { method: 'POST', body: JSON.stringify(data) }),
  resendRsvpConfirmation: (slug: string, guestEmail: string) => request<{ accepted: boolean; message: string }>(`/public/${encodeURIComponent(slug)}/rsvps/resend-confirmation`, { method: 'POST', body: JSON.stringify({ guestEmail } satisfies ResendRsvpConfirmationInput) }),
  confirmRsvp: (slug: string, guestEmail: string, code: string) => request<{ confirmed: boolean; message: string }>(`/public/${encodeURIComponent(slug)}/rsvps/confirm`, { method: 'POST', body: JSON.stringify({ guestEmail, code } satisfies ConfirmRsvpInput) }),
  imageUrl: (listId: string, blob: string) => `${API}/lists/${encodeURIComponent(listId)}/assets/public?blob=${encodeURIComponent(blob)}`,
  imagePreviewUrl: async (listId: string, blob: string) => (await request<{ url: string }>(`/lists/${encodeURIComponent(listId)}/assets/preview?blob=${encodeURIComponent(blob)}`)).url,
  upload: async (listId: string, file: File, giftId?: string) => { const form = new FormData(); form.append('file', file); const query = giftId ? `?giftId=${encodeURIComponent(giftId)}` : ''; return request<{ blobName: string; url: string }>(`/lists/${listId}/assets${query}`, { method: 'POST', body: form }); },
};
export type User = { id: string; email: string; displayName: string };
export type WeddingList = { id: string; coupleNames: string; title: string; description: string; weddingDate?: string|null; slug: string; coverBlob?: string; status: 'DRAFT'|'PUBLISHED'|'ARCHIVED'; _count?: {gifts:number;intentions:number;rsvps:number} };
export type Gift = { id:string; name:string; description:string; priceCents:number; imageBlob?:string; active:boolean; sortOrder:number };
export type PublicList = Omit<WeddingList,'status'|'_count'> & { gifts: Gift[] };
export type Intention = {id:string;guestName:string;guestEmail?:string;message?:string;status:'REGISTERED'|'CANCELLED';createdAt:string;gift:{name:string;priceCents:number}};
export type Rsvp = {id:string;guestName:string;attendance:'YES'|'NO';createdAt:string};
