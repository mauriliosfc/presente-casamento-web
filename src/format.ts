export function formatBRL(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export function parseBRLCents(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 15);
  return Number(digits || 0);
}

export function maskBRLInput(value: string) {
  return formatBRL(parseBRLCents(value));
}
