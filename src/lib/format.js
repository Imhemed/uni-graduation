// Display formatting helpers. Screens use Arabic month names with Western
// digits (e.g. "15 أكتوبر 2026"). Currency is Libyan Dinar (LYD / د.ل) by
// default, shown after the amount in Arabic style: "1,350.00 د.ل".

const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

// Symbols placed BEFORE the number (Western convention).
const PREFIX_SYMBOLS = { USD: '$' };
// Symbols placed AFTER the number (Arabic convention).
const SUFFIX_SYMBOLS = { LYD: 'د.ل', SAR: 'ر.س', AED: 'د.إ', EGP: 'ج.م' };

export function formatMoney(amount, currency = 'LYD') {
  const n = Number(amount || 0);
  const body = n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (PREFIX_SYMBOLS[currency]) return `${PREFIX_SYMBOLS[currency]}${body}`;
  if (SUFFIX_SYMBOLS[currency]) return `${body} ${SUFFIX_SYMBOLS[currency]}`;
  return `${body} ${currency}`;
}

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value) {
  const d = toDate(value);
  if (!d) return value ? String(value) : '';
  return `${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return value ? String(value) : '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(d)} ${hh}:${mm}`;
}

// For <input type="date"> values (yyyy-mm-dd).
export function toInputDate(value) {
  const d = toDate(value);
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}
