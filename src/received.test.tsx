// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './app';
import { ToastProvider } from './toast';

let root: Root;
let container: HTMLDivElement;

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  window.history.pushState({}, '', '/painel/listas/list-1');
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/auth/me')) return Promise.resolve(jsonResponse({ user: { id: 'user-1', email: 'casal@example.com', displayName: 'Casal' } }));
    if (url.endsWith('/lists/list-1')) return Promise.resolve(jsonResponse({ id: 'list-1', coupleNames: 'Ana e Pedro', title: 'Casamento', description: '', slug: 'ana-e-pedro', status: 'PUBLISHED' }));
    if (url.endsWith('/lists/list-1/gifts')) return Promise.resolve(jsonResponse([]));
    if (url.endsWith('/lists/list-1/rsvp-events')) return Promise.resolve(jsonResponse([]));
    if (url.endsWith('/lists/list-1/payments?page=1&limit=50')) return Promise.resolve(jsonResponse({ items: [
      { id: 'paid-1', giftName: 'Cota para vestido', payerName: 'Marina', payerEmail: 'marina@example.com', amountCents: 4750, currency: 'BRL', method: 'CREDIT_CARD', providerPaymentMethodId: 'visa', status: 'APPROVED', createdAt: '2026-11-01T10:00:00.000Z', confirmedAt: '2026-11-01T10:05:00.000Z', providerTransactionId: 'txn-1' },
      { id: 'refund-1', giftName: 'Jogo de jantar', payerName: 'Paulo', amountCents: 35000, currency: 'BRL', method: 'PIX', providerPaymentMethodId: 'pix', status: 'REFUNDED', createdAt: '2026-10-31T10:00:00.000Z', confirmedAt: '2026-10-31T10:05:00.000Z', providerTransactionId: 'txn-2' },
    ], total: 2, approvedTotal: 1, refundedTotal: 1, page: 1, limit: 50 }));
    throw new Error(`Requisição inesperada no teste: ${url}`);
  }));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.history.pushState({}, '', '/');
  vi.unstubAllGlobals();
});

describe('Recebidos na administração da lista', () => {
  it('replaces intentions and displays the approved amount, payer, method, and refunded status', async () => {
    await act(async () => {
      root.render(createElement(BrowserRouter, null, createElement(ToastProvider, null, createElement(App))));
    });
    await act(async () => new Promise(resolve => window.setTimeout(resolve, 0)));

    expect(container.textContent).toContain('Recebidos');
    expect(container.textContent).toContain('Recebidos 1');
    expect(container.textContent).not.toContain('Intenções');
    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find(button => button.textContent?.includes('Recebidos')) as HTMLButtonElement).click();
    });

    expect(container.textContent).toContain('Marina');
    expect(container.textContent?.replace(/\u00a0/g, ' ')).toContain('R$ 47,50');
    expect(container.textContent).toContain('Cartão de crédito · Visa');
    expect(container.textContent).toContain('Paulo');
    expect(container.textContent).toContain('Estornado');
    expect(container.textContent).toContain('Apenas os aprovados contam como recebidos.');
  });
});
