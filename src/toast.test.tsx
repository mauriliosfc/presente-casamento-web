// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast } from './toast';

let root: Root;
let container: HTMLDivElement;
let toast: ReturnType<typeof useToast>;

function Harness() {
  toast = useToast();
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(createElement(ToastProvider, null, createElement(Harness))));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('ToastProvider', () => {
  it('announces success politely and errors assertively', () => {
    act(() => {
      toast.success('Salvo com sucesso.');
      toast.error('Não foi possível salvar.');
    });

    const success = container.querySelector('.toast-success');
    const error = container.querySelector('.toast-error');
    expect(success?.getAttribute('role')).toBe('status');
    expect(success?.getAttribute('aria-live')).toBe('polite');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(error?.getAttribute('aria-live')).toBe('assertive');
  });

  it('stacks notifications and lets users dismiss one manually', () => {
    act(() => {
      toast.success('Primeira mensagem.');
      toast.error('Segunda mensagem.');
    });
    expect(container.querySelectorAll('.toast')).toHaveLength(2);

    act(() => (container.querySelector('.toast-close') as HTMLButtonElement).click());
    expect(container.querySelectorAll('.toast')).toHaveLength(1);
    expect(container.textContent).toContain('Segunda mensagem.');
  });

  it('expires success after four seconds and errors after eight seconds', () => {
    act(() => {
      toast.success('Sucesso temporário.');
      toast.error('Erro temporário.');
    });

    act(() => vi.advanceTimersByTime(4000));
    expect(container.textContent).not.toContain('Sucesso temporário.');
    expect(container.textContent).toContain('Erro temporário.');

    act(() => vi.advanceTimersByTime(4000));
    expect(container.textContent).not.toContain('Erro temporário.');
  });

  it('supports an action on a success toast', () => {
    const onClick = vi.fn();
    act(() => toast.success('Senha atualizada.', { label: 'Entrar', onClick }));
    expect(container.textContent).toContain('Entrar');
    act(() => (container.querySelector('.toast-action') as HTMLButtonElement).click());
    expect(onClick).toHaveBeenCalledOnce();
  });
});
