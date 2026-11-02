// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './app';
import { ToastProvider } from './toast';

let root: Root;
let container: HTMLDivElement;

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function installApiMock(getLists: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/auth/me')) {
      return Promise.resolve(jsonResponse({ user: { id: 'user-1', email: 'ana@example.com', displayName: 'Ana' } }));
    }
    if (url.endsWith('/lists')) return getLists();
    throw new Error(`Requisição inesperada no teste: ${url}`);
  }));
}

async function mountDashboard() {
  window.history.pushState({}, '', '/painel');
  await act(async () => {
    root.render(createElement(BrowserRouter, null,
      createElement(ToastProvider, null, createElement(App)),
    ));
  });
  await act(async () => new Promise(resolve => window.setTimeout(resolve, 0)));
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
});

describe('Dashboard list loading states', () => {
  it('shows loading before the response and then the empty state only after a successful empty response', async () => {
    let resolveLists!: (response: Response) => void;
    installApiMock(() => new Promise(resolve => { resolveLists = resolve; }));
    await mountDashboard();

    expect(container.querySelector('[aria-busy="true"]')?.textContent).toContain('Carregando suas listas');
    expect(container.textContent).not.toContain('A história de vocês começa aqui');

    await act(async () => { resolveLists(jsonResponse([])); });
    expect(container.textContent).toContain('A história de vocês começa aqui');
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('shows an error instead of an empty account and lets the user retry successfully', async () => {
    let listAttempts = 0;
    installApiMock(() => {
      listAttempts += 1;
      return Promise.resolve(listAttempts === 1
        ? jsonResponse({ message: 'Serviço indisponível.' }, 503)
        : jsonResponse([{ id: 'list-1', coupleNames: 'Ana e Pedro', title: 'Casamento', status: 'DRAFT', _count: { gifts: 0, intentions: 0 } }]),
      );
    });
    await mountDashboard();

    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Não foi possível carregar suas listas');
    expect(container.textContent).not.toContain('A história de vocês começa aqui');

    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Tentar novamente') as HTMLButtonElement).click();
    });
    await act(async () => new Promise(resolve => window.setTimeout(resolve, 0)));

    expect(container.textContent).toContain('Ana e Pedro');
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
