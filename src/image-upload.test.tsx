// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageUploadPreview } from './image-upload';

let root: Root;
let container: HTMLDivElement;
const onCancel = vi.fn();
const onConfirm = vi.fn();

async function mount(target: 'cover' | 'gift' = 'cover') {
  const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' });
  await act(async () => { root.render(createElement(ImageUploadPreview, { file, target, onCancel, onConfirm })); await Promise.resolve(); });
  return container;
}

function loadPreview(width: number, height: number) {
  const image = container.querySelector('.image-editor-photo') as HTMLImageElement;
  Object.defineProperty(image, 'naturalWidth', { configurable: true, value: width });
  Object.defineProperty(image, 'naturalHeight', { configurable: true, value: height });
  act(() => image.dispatchEvent(new Event('load')));
}

beforeEach(() => {
  onCancel.mockReset();
  onConfirm.mockReset();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:photo') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe('ImageUploadPreview', () => {
  it('does not confirm until the user accepts the preview', async () => {
    await mount('gift');
    loadPreview(1200, 1200);
    expect(container.textContent).toContain('1200 × 1200 px');
    expect(onConfirm).not.toHaveBeenCalled();

    await act(async () => { (Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Usar esta imagem') as HTMLButtonElement).click(); await Promise.resolve(); });
    expect(onConfirm).toHaveBeenCalledWith({ mode: 'CROP', focalX: 0.5, focalY: 0.5 });
  });

  it('shows the crop and full-image modes and warns about low resolution', async () => {
    await mount('cover');
    loadPreview(800, 600);
    expect(container.textContent).toContain('A parte visível tem');
    expect(container.textContent).toContain('2400 × 1350 px');

    act(() => (Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Mostrar inteira') as HTMLButtonElement).click());
    expect(container.querySelector('.image-editor-frame.fit-blurred')).not.toBeNull();
    expect(container.querySelector('.image-editor-blurred')).not.toBeNull();
    expect(container.querySelector('.image-editor-photo.contained')).not.toBeNull();
  });

  it('lets the user cancel without confirming or uploading', async () => {
    await mount();
    loadPreview(2400, 1350);
    act(() => (Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Escolher outra imagem') as HTMLButtonElement).click());
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
