// Datas gravadas no formato do app ("06/10/2026, 16:52" ou "06/10/2026 16:52:30") -> Date
export const parseDataBr = (txt?: string): Date | null => {
  if (!txt) return null;
  const m = txt.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return new Date(ano, Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]), Number(m[6] || 0));
};

// Tempo entre início e fim: "45 min", "1h 25min", "2d 3h 10min"
export const formatarDuracao = (inicio?: string, fim?: string): string | null => {
  const a = parseDataBr(inicio);
  const b = parseDataBr(fim);
  if (!a || !b) return null;
  const min = Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d > 0) return `${d}d ${h}h ${m}min`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`;
  return `${m} min`;
};
