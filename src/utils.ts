/** Local-time YYYY-MM-DD (toISOString would give the UTC date, off by a day for IST mornings). */
export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const today = () => ymd(new Date());
export const nowDateTime = () => {
  const d = new Date();
  return `${ymd(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
export const formatDateTime = (s?: string | null) => {
  if (!s) return '—';
  const clean = s.replace('T', ' ');
  if (clean.length > 16) return clean.slice(0, 16);
  return clean;
};
export const money = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
export const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
/** "13:30" -> "1:30 PM" */
export const clock12 = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

export const isDateTime = (s: string) => /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/.test(s);

export const PRESETS = ['Today', 'Yesterday', 'This Week', 'This Month', 'All'] as const;
export type Preset = (typeof PRESETS)[number];

/** Inclusive YYYY-MM-DD range for a date preset; `All` has no bounds. */
export function presetRange(p: Preset): { from?: string; to?: string } {
  const now = new Date();
  const to = ymd(now);
  if (p === 'All') return {};
  if (p === 'Yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { from: ymd(y), to: ymd(y) };
  }
  if (p === 'This Week') {
    const w = new Date(now);
    w.setDate(w.getDate() - 6);
    return { from: ymd(w), to };
  }
  if (p === 'This Month') return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to };
  return { from: to, to };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-04" -> "Apr" */
export const monthLabel = (ym: string) => MONTHS[Number(ym.slice(5, 7)) - 1] ?? ym;
