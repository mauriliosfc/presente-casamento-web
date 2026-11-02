import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function SuccessRedirectModal({ title, message, to }: { title: string; message: string; to: string }) {
  const navigate = useNavigate();
  const [seconds, setSeconds] = useState(3);

  useEffect(() => {
    const countdown = window.setInterval(() => setSeconds(current => Math.max(0, current - 1)), 1000);
    const redirect = window.setTimeout(() => navigate(to, { replace: true }), 3000);
    return () => {
      window.clearInterval(countdown);
      window.clearTimeout(redirect);
    };
  }, [navigate, to]);

  return <div className="settings-modal-backdrop success-redirect-backdrop">
    <section className="settings-modal success-redirect-modal" role="dialog" aria-modal="true" aria-labelledby="success-redirect-title" aria-describedby="success-redirect-message">
      <span className="eyebrow">CONCLUÍDO</span>
      <h2 id="success-redirect-title">{title}</h2>
      <p id="success-redirect-message">{message}</p>
      <p className="success-redirect-countdown" role="status" aria-live="polite">Redirecionando em {seconds} {seconds === 1 ? 'segundo' : 'segundos'}…</p>
    </section>
  </div>;
}
