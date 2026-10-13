// Suomalaiset muotoilut. Päivämäärät kulkevat 'YYYY-MM-DD'-merkkijonoina; ne puretaan
// paikalliseksi päiväksi, ei new Date('YYYY-MM-DD') (joka tulkitaan UTC:nä).
const pad = n => String(n).padStart(2, '0');

export const parseISO = s => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISO(new Date());

export const formatDate = s => {
  const d = parseISO(s);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
};

export const weekday = s => parseISO(s).toLocaleDateString('fi-FI', { weekday: 'long' });
export const formatLongDate = s => `${weekday(s)} ${formatDate(s)}`;

export const MONTHS = ['tammikuu', 'helmikuu', 'maaliskuu', 'huhtikuu', 'toukokuu', 'kesäkuu',
  'heinäkuu', 'elokuu', 'syyskuu', 'lokakuu', 'marraskuu', 'joulukuu'];
export const WEEKDAYS_SHORT = ['ma', 'ti', 'ke', 'to', 'pe', 'la', 'su'];

export const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
export const monthRange = (y, m) => [`${y}-${pad(m)}-01`, `${y}-${pad(m)}-${pad(daysInMonth(y, m))}`];
export const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return toISO(d); };
export { pad };

export const formatNumber = (n, digits = 1) =>
  Number(n).toLocaleString('fi-FI', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const formatCoords = (lat, lon) => `${formatNumber(lat, 5)}, ${formatNumber(lon, 5)}`;
