import { useEffect, useMemo, useState } from 'react';

export type ImageTarget = 'cover' | 'gift';
export type ImageMode = 'CROP' | 'FIT_BLURRED';
export type ImagePresentation = { mode: ImageMode; focalX: number; focalY: number };

const targets = {
  cover: { width: 2400, height: 1350, label: 'capa', ratio: 16 / 9 },
  gift: { width: 1200, height: 1200, label: 'presente', ratio: 1 },
} as const;

type Props = {
  file: File;
  target: ImageTarget;
  onCancel: () => void;
  onConfirm: (presentation: ImagePresentation) => Promise<void> | void;
};

export function ImageUploadPreview({ file, target, onCancel, onConfirm }: Props) {
  const [mode, setMode] = useState<ImageMode>('CROP');
  const [focalX, setFocalX] = useState(0.5);
  const [focalY, setFocalY] = useState(0.5);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [src, setSrc] = useState('');
  const shape = targets[target];

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loading, onCancel]);

  const effectiveSize = useMemo(() => {
    if (!dimensions) return null;
    const { width, height } = dimensions;
    if (mode === 'CROP') {
      const sourceRatio = width / height;
      if (sourceRatio > shape.ratio) return { width: Math.floor(height * shape.ratio), height };
      return { width, height: Math.floor(width / shape.ratio) };
    }
    const scale = Math.min(1, shape.width / width, shape.height / height);
    return { width: Math.floor(width * scale), height: Math.floor(height * scale) };
  }, [dimensions, mode, shape]);

  const isLowResolution = Boolean(effectiveSize && (effectiveSize.width < shape.width || effectiveSize.height < shape.height));

  async function confirm() {
    setLoading(true);
    setError('');
    try {
      await onConfirm({ mode, focalX, focalY });
    } catch (cause) {
      setError((cause as Error).message || 'Não foi possível salvar esta imagem.');
    } finally {
      setLoading(false);
    }
  }

  return <div className="settings-modal-backdrop image-editor-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !loading) onCancel(); }}>
    <section className="settings-modal image-editor" role="dialog" aria-modal="true" aria-labelledby="image-editor-title">
      <div className="settings-modal-header">
        <div><span className="eyebrow">PRÉVIA DA IMAGEM</span><h2 id="image-editor-title">Confira como ficará na página</h2></div>
        <button type="button" className="settings-modal-close" aria-label="Fechar prévia" onClick={onCancel} disabled={loading}>×</button>
      </div>
      <p className="image-editor-help">Formato recomendado para {shape.label}: {shape.width} × {shape.height} px.</p>
      {previewError ? <p className="notice error" role="alert">{previewError}</p> : <>
        <div className="image-mode-options" role="group" aria-label="Como ajustar a imagem">
          <button type="button" className={`button ${mode === 'CROP' ? '' : 'ghost'}`} aria-pressed={mode === 'CROP'} onClick={() => setMode('CROP')}>Preencher com corte</button>
          <button type="button" className={`button ${mode === 'FIT_BLURRED' ? '' : 'ghost'}`} aria-pressed={mode === 'FIT_BLURRED'} onClick={() => setMode('FIT_BLURRED')}>Mostrar inteira</button>
        </div>
        <div className={`image-editor-frame ${target} ${mode === 'FIT_BLURRED' ? 'fit-blurred' : 'crop'}`} style={{ aspectRatio: `${shape.width} / ${shape.height}` }}>
          {mode === 'FIT_BLURRED' && <img className="image-editor-blurred" src={src || undefined} alt="" aria-hidden="true" style={{ objectPosition: `${focalX * 100}% ${focalY * 100}%` }} />}
          <img
            className={mode === 'CROP' ? 'image-editor-photo cropped' : 'image-editor-photo contained'}
            src={src || undefined}
            alt={`Prévia da imagem de ${shape.label}`}
            style={mode === 'CROP' ? { objectPosition: `${focalX * 100}% ${focalY * 100}%` } : undefined}
            onLoad={event => {
              setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight });
              setPreviewError('');
            }}
            onError={() => setPreviewError('Não foi possível abrir esta imagem. Escolha outro arquivo JPG, PNG ou WebP.')}
          />
        </div>
        {mode === 'CROP' && dimensions && <div className="image-crop-controls">
          <label>Enquadramento horizontal<input type="range" min="0" max="100" value={Math.round(focalX * 100)} onChange={event => setFocalX(Number(event.target.value) / 100)} aria-label="Enquadramento horizontal" /></label>
          <label>Enquadramento vertical<input type="range" min="0" max="100" value={Math.round(focalY * 100)} onChange={event => setFocalY(Number(event.target.value) / 100)} aria-label="Enquadramento vertical" /></label>
        </div>}
        {isLowResolution && <p className="notice image-resolution-warning" role="status">A parte visível tem {effectiveSize?.width} × {effectiveSize?.height} px. Recomendamos {shape.width} × {shape.height} px; a imagem pode parecer menos nítida em telas grandes. Você ainda pode continuar.</p>}
        {error && <p className="notice error" role="alert">{error}</p>}
        <div className="inline-actions image-editor-actions">
          <button type="button" className="button ghost" disabled={loading} onClick={onCancel}>Escolher outra imagem</button>
          <button type="button" className="button" disabled={loading || !dimensions} onClick={() => void confirm()}>{loading ? 'Salvando…' : 'Usar esta imagem'}</button>
        </div>
      </>}
    </section>
  </div>;
}

export const imageTargetDimensions = targets;
