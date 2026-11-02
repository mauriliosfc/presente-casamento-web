// @vitest-environment jsdom
import { act, createElement, StrictMode, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './app';
import { RsvpTokenPage } from './rsvp';
import { SuccessRedirectModal } from './success-redirect-modal';
import { ToastProvider } from './toast';

let root: Root;
let container: HTMLDivElement;

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.history.pushState({}, '', '/');
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('invite success redirect', () => {
  it('shows the countdown, accepts once in StrictMode, and opens the invited list editor after three seconds', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/csrf')) return Promise.resolve(jsonResponse({ csrfToken: 'csrf-test' }));
      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse({ user: { id: 'user-2', email: 'editor@example.com', displayName: 'Editor' } }));
      if (url.endsWith('/lists/invitations/invite-token/accept')) return Promise.resolve(jsonResponse({ accepted: true, listId: 'list-42' }));
      if (url.endsWith('/lists/list-42')) return Promise.resolve(jsonResponse({ id: 'list-42', coupleNames: 'Ana e Pedro', title: 'Casamento', description: '', slug: 'ana-pedro', status: 'DRAFT' }));
      if (url.endsWith('/lists/list-42/gifts')) return Promise.resolve(jsonResponse([]));
      if (url.endsWith('/lists/list-42/rsvp-events')) return Promise.resolve(jsonResponse([]));
      if (url.endsWith('/lists/list-42/payments?page=1&limit=50')) return Promise.resolve(jsonResponse({ items: [], total: 0, approvedTotal: 0, refundedTotal: 0, page: 1, limit: 50 }));
      throw new Error(`Requisição inesperada: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    window.history.pushState({}, '', '/aceitar-convite?token=invite-token');

    await act(async () => {
      root.render(createElement(StrictMode, null, createElement(BrowserRouter, null,
        createElement(ToastProvider, null, createElement(App)),
      )));
      await flushPromises();
    });

    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('Convite aceito!');
    expect(container.textContent).toContain('Redirecionando em 3 segundos');
    expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/lists/invitations/invite-token/accept'))).toHaveLength(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(2999); });
    expect(window.location.pathname).toBe('/aceitar-convite');
    await act(async () => { await vi.advanceTimersByTimeAsync(1); await flushPromises(); });

    expect(window.location.pathname).toBe('/painel/listas/list-42');
    expect(container.textContent).toContain('Ana e Pedro');
    expect(container.textContent).toContain('Presentes');
  });
});

function RsvpDestination() {
  const { slug } = useParams();
  return <main>Lista pública: {slug}</main>;
}

describe('RSVP success redirect', () => {
  it.each([
    { attendance: 'YES', existingAttendance: null, message: 'Presença confirmada com sucesso!' },
    { attendance: 'NO', existingAttendance: null, message: 'Sua resposta foi registrada com sucesso.' },
    { attendance: 'NO', existingAttendance: 'YES', message: 'Sua resposta foi atualizada com sucesso.' },
  ] as const)('saves $attendance response and redirects to the public gift list after three seconds', async ({ attendance, existingAttendance, message }) => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/auth/csrf')) return Promise.resolve(jsonResponse({ csrfToken: 'csrf-test' }));
      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse({ user: null }, 401));
      if (url.endsWith('/public/rsvp/rsvp-token')) return Promise.resolve(jsonResponse({
        event: { id: 'event-1', name: 'Casamento', eventDate: null, responseDeadline: '2027-01-01T00:00:00.000Z', companionGroups: [], customFields: [] },
        coupleNames: 'Ana e Pedro', listSlug: 'ana-e-pedro',
        guest: { guestName: 'Marina', source: 'RESERVED', attendance: existingAttendance, companionCounts: {}, customAnswers: {}, companionAllowance: {} },
      }));
      if (url.endsWith('/public/rsvp/rsvp-token/opened')) return Promise.resolve(jsonResponse({ opened: true }));
      if (url.endsWith('/public/rsvp/rsvp-token/response')) {
        expect(JSON.parse(String(init?.body)).attendance).toBe(attendance);
        return Promise.resolve(jsonResponse({ saved: true, message: 'Resposta salva.' }));
      }
      throw new Error(`Requisição inesperada: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    window.history.pushState({}, '', '/confirmar-presenca/rsvp-token');

    await act(async () => {
      root.render(createElement(BrowserRouter, null, createElement(ToastProvider, null,
        createElement(Routes, null,
          createElement(Route, { path: '/confirmar-presenca/:token', element: createElement(RsvpTokenPage) }),
          createElement(Route, { path: '/lista/:slug', element: createElement(RsvpDestination) }),
        ),
      )));
      await flushPromises();
    });

    const form = container.querySelector('form')!;
    (form.elements.namedItem('attendance') as HTMLSelectElement).value = attendance;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flushPromises();
    });

    expect(container.querySelector('[role="dialog"]')?.textContent).toContain(message);
    expect(container.textContent).toContain('Redirecionando em 3 segundos');
    await act(async () => { await vi.advanceTimersByTimeAsync(2999); });
    expect(window.location.pathname).toBe('/confirmar-presenca/rsvp-token');
    await act(async () => { await vi.advanceTimersByTimeAsync(1); await flushPromises(); });
    expect(window.location.pathname).toBe('/lista/ana-e-pedro');
    expect(container.textContent).toContain('Lista pública: ana-e-pedro');
  });

  it('keeps the form open and skips the success modal when saving fails', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/csrf')) return Promise.resolve(jsonResponse({ csrfToken: 'csrf-test' }));
      if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse({ user: null }, 401));
      if (url.endsWith('/public/rsvp/rsvp-token')) return Promise.resolve(jsonResponse({
        event: { id: 'event-1', name: 'Casamento', eventDate: null, responseDeadline: '2027-01-01T00:00:00.000Z', companionGroups: [], customFields: [] },
        coupleNames: 'Ana e Pedro', listSlug: 'ana-e-pedro',
        guest: { guestName: 'Marina', source: 'RESERVED', attendance: null, companionCounts: {}, customAnswers: {}, companionAllowance: {} },
      }));
      if (url.endsWith('/public/rsvp/rsvp-token/opened')) return Promise.resolve(jsonResponse({ opened: true }));
      if (url.endsWith('/public/rsvp/rsvp-token/response')) return Promise.resolve(jsonResponse({ message: 'Prazo encerrado.' }, 400));
      throw new Error(`Requisição inesperada: ${url}`);
    }));
    window.history.pushState({}, '', '/confirmar-presenca/rsvp-token');

    await act(async () => {
      root.render(createElement(BrowserRouter, null, createElement(ToastProvider, null, createElement(Routes, null,
        createElement(Route, { path: '/confirmar-presenca/:token', element: createElement(RsvpTokenPage) }),
        createElement(Route, { path: '/lista/:slug', element: createElement(RsvpDestination) }),
      ))));
      await flushPromises();
    });
    await act(async () => {
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flushPromises();
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector('form')).not.toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(window.location.pathname).toBe('/confirmar-presenca/rsvp-token');
  });
});

describe('success redirect modal cleanup', () => {
  it('clears the redirect timer when the modal unmounts', async () => {
    vi.useFakeTimers();
    function Harness() {
      const [show, setShow] = useState(true);
      return <>{show && <SuccessRedirectModal title="Sucesso" message="Tudo certo." to="/destino" />}<button onClick={() => setShow(false)}>Fechar host</button></>;
    }
    window.history.pushState({}, '', '/origem');
    await act(async () => { root.render(createElement(BrowserRouter, null, createElement(Harness))); });
    await act(async () => { (container.querySelector('button') as HTMLButtonElement).click(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(window.location.pathname).toBe('/origem');
  });
});
