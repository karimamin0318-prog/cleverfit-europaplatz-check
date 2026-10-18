// Studio Check – Clever Fit Europaplatz. Alles lokal im Browser (localStorage).
// shortcut: Daten nur auf diesem Gerät; für mehrere Geräte ein Backend (z.B. Supabase) nachrüsten.

const hm = t => t >= '24:00' ? String(+t.slice(0, 2) - 24).padStart(2, '0') + t.slice(2) : t; // Anzeige: 24:30 → 00:30
const FREE_COLOR = '#bdbdbd'; // Bereich ohne Schicht und ohne eigene Farbe
// Bereichsfarben (Ansicht „nach Bereich“): Gruppen in Farbfamilien, kein Rot/Grün (= überfällig/erledigt)
const AREA_COLORS = {
  cardio: '#f2b705', squat1: '#1e3a8a', squat2: '#1e3a8a', dumbbell: '#1e3a8a',
  plate: '#2563eb', stack: '#60a5fa', legs: '#3b82f6', kabel: '#0d9488', functional: '#7c3aed',
  massage: '#d6b98c', sol1: '#d6b98c', sol2: '#d6b98c', damen: '#e58fb4', herren: '#7b93c9',
  theke: '#111111', ma_vorne: '#6b7280', ma_hinten: '#6b7280', lager: '#6b7280', eingang: '#a8a29e',
};
const KEY = 'cfcheck-v2'; // v2: neue Karte mit Bereichen aus dem eigenen Layout
const ED = { W: 800, H: 600, MIN: 10 }; // Zeichenfläche des Layout-Editors

// Arbeitstag wechselt erst um 4 Uhr: Zusperren um 00:05 gehört noch zum Vortag.
const DAY_START_H = 4;
const bizDay = (d = new Date()) => new Date(d - DAY_START_H * 3600e3).toLocaleDateString('sv'); // YYYY-MM-DD
const today = () => bizDay();
const dayNum = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
// Uhrzeit im Arbeitstag: nach Mitternacht 24:05 statt 00:05, damit Vergleiche mit 23:59 stimmen
const bizHM = d => { const h = d.getHours(), s = d.toTimeString().slice(2, 5); return (h < DAY_START_H ? h + 24 : h).toString().padStart(2, '0') + s; };
const nowHM = () => bizHM(new Date());
console.assert(bizDay(new Date(2026, 9, 19, 0, 30)) === '2026-10-18' && bizHM(new Date(2026, 9, 19, 0, 5)) === '24:05');
console.assert(bizDay(new Date(2026, 9, 19, 4, 0)) === '2026-10-19' && bizHM(new Date(2026, 9, 19, 6, 0)) === '06:00');
const fmtDate = s => s.split('-').reverse().join('.');
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

// Schichtzeiten je Tagesart: wt = Werktag, we = Wochenende & Feiertag (8–22 Uhr). 24:00 = Mitternacht (für Zeitvergleiche).
const SHIFT_TIMES = {
  wt: { frueh: ['06:00', '12:00'], mittel: ['12:00', '18:00'], spaet: ['18:00', '24:00'] },
  we: { frueh: ['08:00', '16:00'], mittel: ['11:00', '19:00'], spaet: ['14:00', '22:00'] }, // Mittel am WE nur, wenn besetzt
};
// Rot bleibt für „überfällig“ reserviert, Grün für „erledigt“
const SHIFTS = {};
for (const [k, name, color] of [['frueh', 'Frühschicht', '#f2b705'], ['mittel', 'Mittelschicht', '#2563eb'], ['spaet', 'Spätschicht', '#5b21b6']])
  SHIFTS[k] = { name, color, get from() { return SHIFT_TIMES[dayType()][k][0]; }, get to() { return SHIFT_TIMES[dayType()][k][1]; } };

// Österreichische Feiertage (inkl. Oster-abhängige), pro Jahr zwischengespeichert
const HOLIDAY_CACHE = {};
function holidaysAT(y) {
  if (HOLIDAY_CACHE[y]) return HOLIDAY_CACHE[y];
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), n = h + l - 7 * m + 114;
  const easter = Date.UTC(y, Math.floor(n / 31) - 1, n % 31 + 1);
  const rel = (days, name) => [new Date(easter + days * 864e5).toISOString().slice(0, 10), name];
  const fix = (md, name) => [`${y}-${md}`, name];
  return HOLIDAY_CACHE[y] = new Map([fix('01-01', 'Neujahr'), fix('01-06', 'Heilige Drei Könige'), rel(1, 'Ostermontag'),
    fix('05-01', 'Staatsfeiertag'), rel(39, 'Christi Himmelfahrt'), rel(50, 'Pfingstmontag'), rel(60, 'Fronleichnam'),
    fix('08-15', 'Mariä Himmelfahrt'), fix('10-26', 'Nationalfeiertag'), fix('11-01', 'Allerheiligen'),
    fix('12-08', 'Mariä Empfängnis'), fix('12-25', 'Christtag'), fix('12-26', 'Stefanitag')]);
}
console.assert(holidaysAT(2026).get('2026-04-06') === 'Ostermontag' && holidaysAT(2025).get('2025-06-19') === 'Fronleichnam');
const holidayName = d => holidaysAT(+d.slice(0, 4)).get(d) || (db.holidays?.includes(d) ? 'Feiertag' : '');
const dayType = (d = today()) => { const wd = new Date(d + 'T12:00').getDay(); return wd === 0 || wd === 6 || holidayName(d) ? 'we' : 'wt'; };
// Mittelschicht: werktags immer, am Wochenende/Feiertag nur, wenn für den Tag eingeschaltet
const mittelActive = (d = today()) => dayType(d) === 'wt' || !!db.mittelDays?.[d];
// Ohne Mittelschicht übernimmt die Frühschicht deren Bereiche/Aufgaben (z.B. Stack Loaded am Wochenende)
const effShift = k => k === 'mittel' && !mittelActive() ? 'frueh' : k;
const dayOk = t => !t.days || t.days === dayType(); // Aufgabe gilt heute? (days: 'wt' | 'we' | leer = immer)

// Intervall-Periode: 0 ab Startdatum, +1 alle everyDays Tage. Vor dem Start: -1.
const period = (t, day = today()) => Math.floor((dayNum(day) - dayNum(t.startDate)) / t.everyDays);
// Stündliche Aufgaben: eigenes Häkchen pro Stunde (Schlüssel z.B. 2026-10-18T14)
const periodKey = (t, day = today(), hour = nowHM().slice(0, 2)) =>
  t.type === 'intervall' ? 'p' + period(t, day) : t.hourly ? `${day}T${hour}` : day;
console.assert(period({ startDate: '2026-10-01', everyDays: 14 }, '2026-10-14') === 0);
console.assert(period({ startDate: '2026-10-01', everyDays: 14 }, '2026-10-15') === 1);
console.assert(periodKey({ type: 'schicht' }, '2026-10-18') === '2026-10-18');
console.assert(periodKey({ type: 'schicht', hourly: true }, '2026-10-18', '09') === '2026-10-18T09');

// Aufgaben-Icons: Art der Aufgabe auf einen Blick. [Icon, Bedeutung, Stichworte im Titel für den Vorschlag]
// Reihenfolge = Priorität beim Vorschlag (z.B. „Bestand prüfen“ vor „Bodyshake“).
const TASK_ICONS = [
  ['💶', 'Tagesabschluss / Finanzen', /tagesabschluss|kasse|rechnung|finanz/],
  ['📱', 'Tablet-Check', /tablet/],
  ['🗑️', 'Müllrunde', /müll/],
  ['📦', 'Bestand prüfen / auffüllen', /bestand|lager|nachfüllen/],
  ['🥤', 'Bodyshake-Automat', /bodyshake/],
  ['☕', 'Kaffeeautomat', /kaffee/],
  ['🧃', 'Getränkebar', /getränk/],
  ['💡', 'Licht an / aus', /licht/],
  ['🔑', 'Aufsperren / Zusperren', /sperren/],
  ['📺', 'Fernseher', /fernseh|tv\b/],
  ['🪟', 'Fenster / Lüften', /fenster|lüft/],
  ['🧴', 'Hygienecheck', /hygiene|desinf/],
  ['👋', 'Kunden', /kunde/],
  ['🔍', 'Umkleide- / Flächen-Check', /umkleide|check|kontroll/],
  ['🏋️', 'Fläche aufräumen / Gewichte', /aufräum|gewicht|hantel|scheiben/],
  ['🧽', 'Putzen / Abstauben', /putz|abstaub|reinig|wisch|saug|clean/],
  ['⏱️', 'Stempeln', /stempel/],
  ['🏠', 'Feierabend', /heim/],
  ['📍', 'Sonstiges', /$^/],
];
const guessIcon = title => TASK_ICONS.find(([, , re]) => re.test(title.toLowerCase()))?.[0];
console.assert(guessIcon('Bodyshake, Kaffeeautomat & Getränkebar auf Bestand prüfen') === '📦');
console.assert(guessIcon('Bodyshake-Automaten putzen und auffüllen') === '🥤');
console.assert(guessIcon('Letzter Umkleide- und Flächencheck (Mittel auffüllen, wenn leer)') === '🔍');
console.assert(guessIcon('Alle Kunden auschecken') === '👋');
console.assert(guessIcon('Studio zusperren') === '🔑' && guessIcon('Fläche aufräumen') === '🏋️');
// Eigene Schwarz-Weiß-Symbole statt bunter Emojis. Gespeichert wird weiter das Emoji (Daten bleiben gleich), angezeigt das Symbol.
// 24er-Raster, nur Linien (Farbe = currentColor). Unbekannte eigene Emojis bleiben Text, aber grau.
const GLYPHS = {
  '💶': '<rect x="2.5" y="6" width="19" height="12" rx="1.5"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9.5v5M18 9.5v5"/>',
  '📱': '<rect x="6" y="2.5" width="12" height="19" rx="2"/><path d="M11 18h2"/>',
  '🗑': '<path d="M4 7h16M10 3.5h4M6 7l1 13.5h10L18 7M10 11v5.5M14 11v5.5"/>',
  '📦': '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5zM3 7.5 12 12l9-4.5M12 12v9"/>',
  '🥤': '<path d="M5 9h14M6.5 9 8 21h8l1.5-12M7 9c0-2.6 2.2-4 5-4s5 1.4 5 4M12 5l3-2.5"/>',
  '☕': '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10.5h1.5a2.5 2.5 0 0 1 0 5H17M8.5 3v3M12.5 3v3"/>',
  '🧃': '<path d="M10 2.5h4M10.5 2.5V6L8 9v12h8V9l-2.5-3V2.5M8 13.5h8"/>',
  '💡': '<path d="M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.5 10.9c.8.6 1.5 1.5 1.5 2.6v1.5h4v-1.5c0-1.1.7-2 1.5-2.6A6 6 0 0 0 12 3z"/>',
  '🔑': '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 20 3M16 7l3 3M13.5 9.5l2 2"/>',
  '📺': '<rect x="3" y="6" width="18" height="12.5" rx="2"/><path d="M8 21.5h8M8.5 2.5 12 6l3.5-3.5"/>',
  '🪟': '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M12 3v18M4 12h16"/>',
  '🧴': '<path d="M8 10h8v10a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 20zM10 10V7h4v3M12 7V4H9M10 15.5h4M12 13.5v4"/>',
  '👋': '<circle cx="12" cy="7.5" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  '🔍': '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
  '🏋': '<path d="M6.5 6v12M17.5 6v12M3 9v6M21 9v6M6.5 12h11"/>',
  '🧽': '<path d="M10 3.5l1.6 4.9 4.9 1.6-4.9 1.6-1.6 4.9-1.6-4.9L3.5 10l4.9-1.6zM18 14l.8 2.2 2.2.8-2.2.8L18 20l-.8-2.2-2.2-.8 2.2-.8z"/>',
  '⏱': '<circle cx="12" cy="13.5" r="7.5"/><path d="M10 2.5h4M12 13.5v-4M18.5 7 20 5.5"/>',
  '🏠': '<path d="M3.5 11 12 3.5l8.5 7.5M6 9v11.5h12V9M10 20.5v-6h4v6"/>',
  '📍': '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  '💧': '<path d="M12 3c3.5 4.5 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 2.5-6.5 6-11z"/>',
  '🧻': '<ellipse cx="6.5" cy="8" rx="3" ry="5"/><path d="M6.5 3H17a3 5 0 0 1 0 10H6.5M11 13v8h6v-8"/>',
  '🧹': '<path d="M17.5 2.5 13 12M7.5 12h9l2 9h-13zM10 16v5M14 16v5"/>',
  '🧯': '<path d="M8 21.5V11a4 4 0 0 1 8 0v10.5zM12 7V4M8.5 4H16l3 2"/>',
  '🔌': '<path d="M9 2.5v4.5M15 2.5v4.5M6 7h12v4a6 6 0 0 1-12 0zM12 17v4.5"/>',
  '🚪': '<path d="M6 21V3h12v18M3.5 21h17"/><circle cx="14.5" cy="12" r="1" fill="currentColor" stroke="none"/>',
  '🚿': '<path d="M5 21V7a4 4 0 0 1 8 0v1M9 8h8M11 11.5v.5M15 11.5v.5M13 14.5v.5M10 17v.5M16 17v.5M13 20v.5"/>',
  '❄': '<path d="M12 2.5v19M3.8 7.3l16.4 9.4M3.8 16.7l16.4-9.4M9 4.5l3 2 3-2M9 19.5l3-2 3 2"/>',
};
const glyphOf = icon => GLYPHS[String(icon || '').replace(/\uFE0F/g, '')];
// attrs: z.B. Position/Größe, wenn das Symbol in der Karte (SVG) sitzt
const glyph = (icon, attrs = '') => glyphOf(icon)
  ? `<svg class="glyph" viewBox="0 0 24 24" ${attrs} aria-hidden="true">${glyphOf(icon)}</svg>`
  : `<span class="glyph-txt">${esc(icon || '•')}</span>`;
console.assert(TASK_ICONS.every(([i]) => glyphOf(i)));
const iconChip = t => t.icon ? `<span class="ticon" title="${esc(TASK_ICONS.find(([i]) => i === t.icon)?.[1] || '')}">${glyph(t.icon)}</span>` : '';

// To-dos vom Chef. „ab X“ = Zeitfenster von X bis zum nächsten Block (bzw. Schichtende); „@X“ = feste Uhrzeit.
// Putz-Zuteilung: Früh = Cardio, Mittel = Stack Loaded, Spät = Plate Loaded + Legs & Bänke.
// Wochenende/Feiertag (we): mein Vorschlag aus der Werktags-Liste, ohne Mittelschicht → Früh putzt zusätzlich Stack Loaded.
const CHEF_TODOS = {
  wt: {
    frueh: {
      '06:00': ['Lichter einschalten', 'Getränkebar unten einschalten', 'Kaffeeautomat einschalten', 'Fernseher einschalten',
        'Fenster oben aufmachen', 'Fenster auf der Fläche kippen (im Winter max. 3–4)', 'Ersten Hygienecheck machen'],
      '07:00': ['Bodyshake-Automaten putzen und auffüllen'],
      '08:00': [['Cardio putzen', ['cardio']]],
      '09:00': ['Studio-Tablet-Check machen'],
    },
    mittel: {
      '12:00': [['Stack Loaded putzen', ['stack']]],
      '13:00': ['Studio-Tablet-Check durchführen'],
      '14:00': ['Bodyshake-Automaten putzen und auffüllen'],
      '15:00': ['Wenn notwendig: Müllrunde durchführen'],
      '16:00': ['Studio-Tablet-Check durchführen'],
    },
    spaet: {
      '18:00': [['Plate Loaded putzen', ['plate']], ['Legs & Bänke putzen', ['legs']], 'Wenn notwendig: kleine Müllrunde'],
      '20:00': ['Studio-Tablet-Check', 'Große Müllrunde'],
      '22:00': ['Bodyshake- und Kaffeeautomat putzen und auffüllen', 'Tagesabschluss durchführen'],
      '23:00': ['Fläche aufräumen'],
      '23:30': ['Erste Lichter ausschalten (wenn nicht mehr viele Leute da sind, sonst ab 23:45)'],
      '23:45': [['Letzter Umkleide- und Flächencheck (Mittel auffüllen, wenn leer)', ['damen', 'herren']]],
      '23:55': ['Alle Lichter ausschalten', 'Letzte Kunden freundlich bitten, sich umzuziehen'],
      '@23:59': ['Alle Kunden auschecken', 'Ausstempeln', 'Studio zusperren', 'Heimgehen'], // „ab 00:00“ – gehört noch zum Tag
    },
  },
  we: {
    frueh: {
      '08:00': ['Lichter einschalten', 'Getränkebar unten einschalten', 'Kaffeeautomat einschalten', 'Fernseher einschalten',
        'Fenster oben aufmachen', 'Fenster auf der Fläche kippen (im Winter max. 3–4)', 'Ersten Hygienecheck machen'],
      '09:00': ['Bodyshake-Automaten putzen und auffüllen'],
      '10:00': [['Cardio putzen', ['cardio']], 'Studio-Tablet-Check machen'],
      '13:00': ['Studio-Tablet-Check durchführen'],
      '14:00': ['Wenn notwendig: Müllrunde durchführen'],
    },
    mittel: { // ohne Mittelschicht erledigt das die Frühschicht
      '12:00-16:00': [['Stack Loaded putzen', ['stack']]],
    },
    spaet: {
      '16:00': [['Plate Loaded putzen', ['plate']], ['Legs & Bänke putzen', ['legs']]],
      '17:00': ['Studio-Tablet-Check durchführen', 'Wenn notwendig: kleine Müllrunde'],
      '19:00': ['Große Müllrunde'],
      '20:00': ['Bodyshake- und Kaffeeautomat putzen und auffüllen', 'Tagesabschluss durchführen', 'Studio-Tablet-Check'],
      '21:00': ['Fläche aufräumen'],
      '21:30': ['Erste Lichter ausschalten (wenn nicht mehr viele Leute da sind, sonst ab 21:45)'],
      '21:45': [['Letzter Umkleide- und Flächencheck (Mittel auffüllen, wenn leer)', ['damen', 'herren']]],
      '21:55': ['Alle Lichter ausschalten', 'Letzte Kunden freundlich bitten, sich umzuziehen'],
      '@22:00': ['Alle Kunden auschecken', 'Ausstempeln', 'Studio zusperren', 'Heimgehen'],
    },
  },
};
const CHEF_HOURLY = [ // stündlich: Frühschicht immer (Fenster = Schichtzeit des Tages), Mittelschicht werktags
  ['Hygienecheck (Kabinen, Massageliege, Solarium, Fläche)', ['massage', 'sol1', 'sol2']],
  ['Bodyshake, Kaffeeautomat & Getränkebar auf Bestand prüfen', []],
];
const rulesOf = title => { const r = guessRules(title); return r.length ? { markerRules: r } : {}; };
function chefTasks() {
  const out = [];
  for (const [days, shifts] of Object.entries(CHEF_TODOS))
    for (const [shift, blocks] of Object.entries(shifts)) {
      const starts = Object.keys(blocks), at = s => s.replace('@', '');
      starts.forEach((key, i) => {
        let from = key, to = starts[i + 1] ? at(starts[i + 1]) : SHIFT_TIMES[days][shift][1];
        if (key.includes('-')) [from, to] = key.split('-'); // festes Fenster „12:00-16:00“
        for (const item of blocks[key]) {
          const [title, zoneIds] = Array.isArray(item) ? item : [item];
          out.push({ id: uid(), type: 'schicht', days, title, icon: guessIcon(title), ...rulesOf(title), shift,
            ...(from.startsWith('@') ? { time: at(from) } : { from, to }), ...(zoneIds && { zoneIds }) });
        }
      });
    }
  for (const shift of ['frueh', 'mittel'])
    for (const [title, zoneIds] of CHEF_HOURLY)
      out.push({ id: uid(), type: 'schicht', title, icon: guessIcon(title), ...rulesOf(title), shift, hourly: true, ...(shift === 'mittel' && { days: 'wt' }), ...(zoneIds.length && { zoneIds }) });
  return out;
}
// Vorlagen + selbst angelegte Emojis (werden beim Speichern eines Punkts gemerkt)
const markerIcons = () => [...MARKER_ICONS, ...(db.customIcons || [])];
const rememberIcons = markers => {
  for (const m of markers) if (m.icon && !markerIcons().some(([i]) => i === m.icon)) db.customIcons.push([m.icon, m.name]);
};
// Automatische Punkte: Aufgabe mit Regel bekommt ALLE passenden Punkte – auch später neu gesetzte (z.B. jede Mülltonne)
const MARKER_RULES = {
  muell: { name: 'alle Mülltonnen', match: m => m.icon === '🗑️' || /müll/i.test(m.name) },
  shake: { name: 'Bodyshake', match: m => m.icon === '🥤' || /shake|protein/i.test(m.name) },
  bar: { name: 'Getränkebar', match: m => m.icon === '💧' || /getränk|wasser/i.test(m.name) },
  kaffee: { name: 'Kaffeeautomat', match: m => m.icon === '☕' || /kaffee/i.test(m.name) },
  tablet: { name: 'Studio-Tablet', match: m => m.icon === '📱' || /tablet/i.test(m.name) },
  licht: { name: 'Lichtschalter', match: m => m.icon === '💡' || /licht/i.test(m.name) },
  tv: { name: 'Fernseher', match: m => m.icon === '📺' || /fernseh|tv/i.test(m.name) },
  fenster: { name: 'Fenster', match: m => m.icon === '🪟' || /fenster/i.test(m.name) },
  papier: { name: 'Papierspender', match: m => m.icon === '🧻' || /papier/i.test(m.name) },
};
const guessRules = title => { const s = title.toLowerCase(), r = [];
  if (/müll/.test(s)) r.push('muell');
  if (/bodyshake/.test(s)) r.push('shake');
  if (/getränk|natural power serum/.test(s)) r.push('bar');
  if (/kaffee/.test(s)) r.push('kaffee');
  if (/tablet/.test(s)) r.push('tablet');
  if (/licht/.test(s)) r.push('licht');
  if (/fernseh/.test(s)) r.push('tv');
  if (/fenster/.test(s)) r.push('fenster');
  return r; };
console.assert(guessRules('Bodyshake, Kaffeeautomat & Getränkebar auf Bestand prüfen').join() === 'shake,bar,kaffee');
const taskMarkers = t => db.markers.filter(m => t.markerIds?.includes(m.id) || t.markerRules?.some(k => MARKER_RULES[k]?.match(m)));

function seed() {
  // Sauberes Raster (Gänge/Wände überall 10 breit), Proportionen nach „Self made Layout + Farbe.png“.
  // rects: [x, y, w, h, Beschriftung?] – überlappende Rechtecke ergeben L-Formen; Name steht auf dem ersten.
  const zones = [
    { id: 'ma_hinten',  name: 'Mitarbeiter Kammer Hinten', label: 'MA hinten', shift: 'spaet', rects: [[0, 0, 120, 100]] },
    { id: 'herren',     name: 'Herrenumkleide & WC',       label: 'Herren', shift: 'spaet', rects: [[0, 150, 70, 70], [0, 110, 70, 30, 'WC']] },
    { id: 'damen',      name: 'Frauenumkleide & WC',       label: 'Damen',  shift: 'spaet', rects: [[0, 230, 70, 110]] },
    { id: 'eingang',    name: 'Eingangsbereich',           label: 'Eingang', shift: 'frueh', rects: [[80, 260, 40, 130], [0, 350, 120, 40]] },
    { id: 'massage',    name: 'Massageliege',              label: 'Massage', shift: 'mittel', rects: [[130, 0, 50, 50]] },
    { id: 'sol2',       name: 'Solarium 2',                label: 'Sol 2', shift: 'mittel', rects: [[130, 60, 50, 50]] },
    { id: 'sol1',       name: 'Solarium 1',                label: 'Sol 1', shift: 'mittel', rects: [[130, 120, 50, 70]] },
    { id: 'ma_vorne',   name: 'Mitarbeiter Kammer Vorne',  label: 'MA vorne', shift: 'spaet', rects: [[130, 200, 90, 50]] },
    { id: 'theke',      name: 'Theke',                     shift: 'frueh',  rects: [[130, 260, 50, 60]] },
    { id: 'functional', name: 'Functional Bereich',        label: 'Functional', shift: 'mittel', rects: [[190, 0, 240, 190]] },
    { id: 'plate',      name: 'Plate Loaded Maschinen',    label: 'Plate Loaded', shift: 'spaet', rects: [[230, 200, 200, 80]] },
    { id: 'stack',      name: 'Stack Loaded Maschinen',    label: 'Stack Loaded', shift: 'mittel', rects: [[190, 290, 240, 100]] },
    { id: 'legs',       name: 'Leg-Maschinen & Bankdrücken', label: 'Legs & Bänke', shift: 'spaet', rects: [[440, 0, 60, 190]] },
    { id: 'dumbbell',   name: 'Dumbbell Bereich',          label: 'Dumbbells', shift: 'spaet', rects: [[510, 0, 90, 100]] },
    { id: 'squat1',     name: 'Squat Racks',               shift: 'frueh',  rects: [[510, 110, 90, 80]] },
    { id: 'kabel',      name: 'Kabelturm',                 shift: 'mittel', rects: [[440, 200, 160, 80]] },
    { id: 'squat2',     name: 'Squat Rack & Smith Maschine', label: 'Squat & Smith', shift: 'frueh', rects: [[440, 290, 60, 100]] },
    { id: 'lager',      name: 'Lager',                     shift: 'spaet',  rects: [[550, 290, 50, 100], [510, 290, 90, 30]] },
    { id: 'cardio',     name: 'Cardio Bereich',            label: 'Cardio', shift: 'frueh', rects: [[80, 400, 420, 80], [130, 330, 50, 60]] },
  ];
  const tasks = [...chefTasks(), { id: uid(), type: 'intervall', title: 'Natural Power Serum Deep Clean', icon: '🧽', markerRules: ['bar'], everyDays: 14, startDate: today() }];
  zones.forEach(z => z.color = AREA_COLORS[z.id]);
  return { colorBy: 'schicht', tasks, zones, done: {} };
}

let db;
{ // Laden; ist der Speicher unlesbar, Rohtext sichern statt still zu überschreiben
  const raw = localStorage.getItem(KEY);
  try { db = raw ? JSON.parse(raw) : null; } catch {
    localStorage.setItem(KEY + '-defekt', raw);
    alert('Die gespeicherten Daten waren beschädigt und wurden als „' + KEY + '-defekt“ gesichert. Die App startet mit den Standarddaten – bitte ein Backup importieren.');
  }
  db ||= seed();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} // nur Zwischenspeicher; die echten Daten liegen in Supabase
  sync();
}
function normalize() {
db.colorBy ??= 'schicht';
db.mittelDays ??= {}; // Wochenende/Feiertag: Tage mit Mittelschicht { '2026-10-18': true }
db.holidays ??= []; // zusätzliche Feiertage/Sonderöffnungstage (YYYY-MM-DD)
db.markers ??= []; // Punkte: Mülltonne, Wasserspender … ({ id, name, icon, x, y })
db.customIcons ??= []; // eigene Punkt-Emojis [[icon, name]]
db.layouts ??= []; // gespeicherte Layouts: { id, studio, name, note, savedAt, zones, markers }
delete db.pin; // früher: Admin-PIN, jetzt Admin-Konten
}
normalize();

const ui = { tab: 'dashboard', admin: false, shift: currentShift(), zone: null, pick: null, doneOpen: false, showMarkers: false };
const $ = s => document.querySelector(s);

function currentShift() {
  const t = nowHM();
  return t >= SHIFTS.spaet.from ? 'spaet' : t >= SHIFTS.mittel.from && mittelActive() ? 'mittel' : 'frueh';
}

const doneAt = t => db.done[t.id + '|' + periodKey(t)];
// Aufgabe antippen: ist sie gerade auf der Karte → ausblenden (ganzer Raum), sonst ihren Ort zeigen
function pickTask(id) {
  const shown = !ui.hideMap && (ui.pick || document.querySelector('.task.dash.next')?.dataset.pick);
  if (id === 'next') Object.assign(ui, { pick: null, hideMap: false });
  else if (id === shown) Object.assign(ui, { pick: null, hideMap: true });
  else Object.assign(ui, { pick: id, hideMap: false });
  render();
}
function toggle(id) {
  const t = db.tasks.find(x => x.id === id);
  const k = t.id + '|' + periodKey(t);
  if (db.done[k]) delete db.done[k]; else db.done[k] = new Date().toISOString();
  ui.pick = null; ui.hideMap = false; // nach dem Abhaken weiter mit der nächsten Aufgabe
  save(); render();
}
const timeOf = t => new Date(t).toTimeString().slice(0, 5);

function taskRow(t, meta, overdue = false) {
  const d = doneAt(t);
  return `<div class="task ${d ? 'done' : overdue ? 'overdue' : ''}" data-toggle="${t.id}" role="checkbox" aria-checked="${!!d}" tabindex="0">
    <div class="check">${d ? '✓' : ''}</div>
    ${iconChip(t)}<div class="body"><div class="title">${esc(t.title)}</div>
    <div class="meta">${meta}${d ? ` <span class="badge green">erledigt ${timeOf(d)}</span>` : ''}</div></div></div>`;
}
const shiftOpts = sel => `<option value="">— keine Schicht —</option>` +
  Object.entries(SHIFTS).map(([k, s]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${s.name}</option>`).join('');

// --- Karte zeichnen (Putzplan + Layout-Editor) ---
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const pale = hex => '#' + rgb(hex).map(c => Math.round(c * .28 + 255 * .72).toString(16).padStart(2, '0')).join('');
const isLight = hex => { const [r, g, b] = rgb(hex); return r * .299 + g * .587 + b * .114 > 160; };
const fillOf = z => db.colorBy === 'bereich'
  ? z.color || SHIFTS[effShift(z.shift)]?.color || FREE_COLOR
  : SHIFTS[effShift(z.shift)]?.color || z.color || FREE_COLOR;
const colorToggle = () => `<div class="seg small">${[['schicht', 'Nach Schicht'], ['bereich', 'Nach Bereich']].map(([k, l]) =>
  `<button data-colorby="${k}" class="${db.colorBy === k ? 'active' : ''}">${l}</button>`).join('')}</div>`;
// Heutige Aufgaben eines Bereichs (Putzbereich-Aufgaben, Orte und Punkte) – gilt für Dashboard und Putzplan gleich
const zoneTasks = z => todayTasks().filter(t => taskZones(t).includes(z.id));
const zoneDone = z => { const l = zoneTasks(z); return l.length > 0 && l.every(doneAt); };

function svgLabel([x, y, w, h], txt) {
  const rot = h > w * 1.4, long = rot ? h : w, short = rot ? w : h;
  const fs = Math.max(7, Math.min(14, short * 0.42, long * 1.6 / txt.length));
  const cx = x + w / 2, cy = y + h / 2;
  return `<text x="${cx}" y="${cy}" font-size="${fs.toFixed(1)}" ${rot ? `transform="rotate(-90 ${cx} ${cy})"` : ''}>${esc(txt)}</text>`;
}
// rects: [x, y, w, h, Beschriftung?] – überlappende Teile ergeben L-Formen; Name steht auf dem ersten Teil.
function zoneSvg(z, { done = false, sel = false, piece = -1, hl = false, green = false } = {}) {
  const fill = green ? '#1a9c4a' : done ? pale(fillOf(z)) : fillOf(z);
  return `<g class="zone ${sel ? 'sel' : ''} ${hl ? 'hl' : ''}" data-zone="${z.id}" style="--fill:${fill};--txt:${isLight(fill) ? '#111' : '#fff'}">
    <title>${esc(z.name)}</title>${z.rects.map(([x, y, w, h], i) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" data-piece="${i}" class="${i === piece ? 'cur' : ''}"/>`).join('')}
    ${svgLabel(z.rects[0], (done || green ? '✓ ' : '') + (z.label || z.name))}${z.rects.slice(1).filter(r => r[4]).map(r => svgLabel(r, r[4])).join('')}</g>`;
}
// Punkt (Mülltonne, Wasserspender …): Kreis mit Symbol, Name darunter
function markerSvg(m, { hl = false, sel = false } = {}) {
  return `<g class="marker ${hl ? 'hl' : ''} ${sel ? 'sel' : ''}" data-marker="${m.id}" transform="translate(${m.x} ${m.y})">
    <title>${esc(m.name)}</title>${hl ? '<circle class="pulse" r="11"/>' : ''}<circle r="11"/>
    ${glyphOf(m.icon) ? glyph(m.icon, 'x="-7" y="-7" width="14" height="14"') : `<text class="ico" font-size="12">${esc(m.icon || '•')}</text>`}</g>`; // nur Icon, Name als Tooltip
}
const MARKER_ICONS = [['🗑️', 'Mülltonne'], ['💧', 'Getränkebar'], ['🥤', 'Bodyshake'], ['☕', 'Kaffeeautomat'], ['📱', 'Studio-Tablet'],
  ['💡', 'Lichtschalter'], ['📺', 'Fernseher'], ['🪟', 'Fenster'], ['🧴', 'Desinfektion'], ['🧻', 'Papierspender'], ['🧹', 'Putzmittel'],
  ['🧯', 'Feuerlöscher'], ['🔌', 'Steckdose'], ['📦', 'Kiste'], ['🚪', 'Tür'], ['❄️', 'Kühlschrank'], ['📍', 'Sonstiges']];
console.assert(MARKER_ICONS.every(([i]) => glyphOf(i)));
const inRect = (m, [x, y, w, h]) => m.x >= x && m.x <= x + w && m.y >= y && m.y <= y + h;
const markerZone = m => db.zones.find(z => z.rects.some(r => inRect(m, r)))?.id;
function mapSvg(cls, inner) { // gemeinsamer Rahmen für Dashboard- und Putzplan-Karte
  const [vx, vy, vw, vh] = fitView(db.zones);
  return `<svg class="map ${cls}" viewBox="${vx} ${vy} ${vw} ${vh}" role="img" aria-label="Studio-Karte"><defs>${HL_FILTER}</defs>
    <rect class="floor" x="${vx}" y="${vy}" width="${vw}" height="${vh}" rx="8"/>${inner}</svg>`;
}
const markerToggle = () => db.markers.length
  ? `<button class="btn small ghost marker-btn" data-markers>${ui.showMarkers ? 'Punkte ausblenden' : `Punkte einblenden (${db.markers.length})`}</button>` : '';

function fitView(zones) {
  const r = zones.flatMap(z => z.rects);
  if (!r.length) return [0, 0, 100, 100];
  const x0 = Math.min(...r.map(a => a[0])), y0 = Math.min(...r.map(a => a[1]));
  const x1 = Math.max(...r.map(a => a[0] + a[2])), y1 = Math.max(...r.map(a => a[1] + a[3]));
  return [x0 - 10, y0 - 10, x1 - x0 + 20, y1 - y0 + 20];
}

// --- Dashboard: alle heutigen Aufgaben in zeitlicher Reihenfolge + Karte ---
const taskZones = t => [...new Set([...(t.type === 'zone' ? [t.zoneId] : t.zoneIds || []), ...taskMarkers(t).map(markerZone).filter(Boolean)])];
const taskShift = t => effShift(t.type === 'zone' ? db.zones.find(z => z.id === t.zoneId)?.shift : t.shift);
const isToday = iso => !!iso && bizDay(new Date(iso)) === today();
// Intervall-Aufgaben nur, wenn fällig (offen) oder heute erledigt
const win = t => [t.from || SHIFTS[t.shift]?.from || '00:00', t.to || SHIFTS[t.shift]?.to || '24:00'];
const nextHour = () => String(+nowHM().slice(0, 2) + 1).padStart(2, '0') + ':00';
const whenText = t => t.hourly ? `stündlich · bis ${hm(nextHour())}` : t.time ? `${hm(t.time)} Uhr` : t.from ? `${hm(t.from)}–${hm(t.to)} Uhr` : '';
// überfällig: Uhrzeit/Fensterende vorbei; stündliche nie (sie kommen jede Stunde neu)
const isOverdue = t => !t.hourly && !doneAt(t) && !!(t.to || t.time) && nowHM() > (t.to || t.time);
// Stündliche Aufgaben nur während ihres Zeitfensters (sonst Schicht) zeigen
const hourlyActive = t => { const [a, b] = win(t), n = nowHM(); return n >= a && n < b; };
const todayTasks = () => db.tasks.filter(t => dayOk(t) && (t.hourly ? hourlyActive(t) : t.type !== 'intervall' || period(t) >= 0 && (!doneAt(t) || isToday(doneAt(t)))));
// Intervall = wichtig, kommt zuerst; sonst Uhrzeit, Zeitfenster-Beginn oder Schichtbeginn
const sortKey = t => t.type === 'intervall' ? '' : t.hourly ? nowHM().slice(0, 2) + ':00' : t.time || t.from || SHIFTS[taskShift(t)]?.from || '99:99';
const endKey = t => t.to || t.time || '99:99';
const byTime = (a, b) => sortKey(a).localeCompare(sortKey(b)) || endKey(a).localeCompare(endKey(b)) || (a.type === 'zone') - (b.type === 'zone') || db.tasks.indexOf(a) - db.tasks.indexOf(b); // gleiche Zeit: Reihenfolge wie eingetragen
// Umriss um die ganze (auch L-förmige) Fläche, ohne innere Linien
const HL_FILTER = `<filter id="hlOutline" x="-20%" y="-20%" width="140%" height="140%"><feMorphology in="SourceAlpha" operator="dilate" radius="4" result="d"/>
  <feFlood flood-color="#111"/><feComposite in2="d" operator="in" result="o"/><feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;

const placeNames = t => [...new Set(taskMarkers(t).map(m => m.name)), ...(t.type === 'zone' ? [t.zoneId] : t.zoneIds || []).map(id => db.zones.find(z => z.id === id)?.name)].filter(Boolean);
function dashRow(t, isNext = false) {
  const d = doneAt(t), s = taskShift(t);
  const since = t.type === 'intervall' ? dayNum(today()) - (dayNum(t.startDate) + period(t) * t.everyDays) : 0;
  const over = t.type === 'intervall' ? !d && since > 0 : isOverdue(t);
  const tag = t.type === 'intervall' ? '<span class="tag imp">Wichtig · Intervall</span>'
    : s ? `<span class="tag" style="--c:${SHIFTS[s].color}">${SHIFTS[s].name.replace('schicht', '')}</span>` : '';
  const when = t.type === 'intervall' ? `alle ${t.everyDays} Tage` : whenText(t);
  const places = placeNames(t).join(', ');
  const stripe = t.type === 'intervall' ? 'var(--red)' : SHIFTS[s]?.color || 'transparent';
  return `<div class="task dash ${d ? 'done' : ''} ${ui.pick === t.id ? 'picked' : ''} ${isNext ? 'next' : ''}" data-pick="${t.id}" tabindex="0" style="--stripe:${stripe}">
    <button class="check" data-toggle="${t.id}" aria-label="${d ? 'Wieder öffnen' : 'Erledigt'}">${d ? '✓' : ''}</button>
    ${iconChip(t)}<div class="body"><div class="title">${esc(t.title)}</div>
    <div class="meta">${isNext ? '<span class="badge next-b">▶ Als Nächstes</span>' : ''}${tag}${when ? `<span class="badge">${when}</span>` : ''}${over ? `<span class="badge red">${since > 0 ? `überfällig seit ${since} T.` : 'überfällig'}</span>` : ''}
    ${places ? `<span class="place">${esc(places)}</span>` : ''}${d ? `<span class="badge green">erledigt ${timeOf(d)}</span>` : ''}</div></div></div>`;
}

function dayBanner() {
  const d = today(), t = dayType(d), hol = holidayName(d);
  const label = t === 'wt' ? 'Werktag' : hol ? `Feiertag · ${hol}` : 'Wochenende';
  const mittel = t === 'we' ? `<button class="btn small ${mittelActive() ? '' : 'ghost'}" data-mittel>Mittelschicht heute: ${mittelActive() ? 'ja' : 'nein'}</button>` : '';
  return `<div class="day-banner ${t}"><b>${label}</b><span>Öffnungszeit ${hm(SHIFT_TIMES[t].frueh[0])}–${hm(SHIFT_TIMES[t].spaet[1])}</span>
    <span class="grow"></span>${mittel}</div>`;
}
const progress = list => {
  const n = list.filter(doneAt).length;
  return `<div class="progress" title="${n}/${list.length}"><div style="width:${list.length ? n / list.length * 100 : 0}%"></div></div>`;
};

const views = {
  dashboard() {
    const list = todayTasks().sort(byTime);
    const zone = db.zones.find(z => z.id === ui.zone); // Bereich angetippt → links nur dessen Aufgaben
    const shown = zone ? list.filter(t => taskZones(t).includes(zone.id)) : list;
    const open = shown.filter(t => !doneAt(t)), done = shown.filter(doneAt).sort((a, b) => doneAt(b).localeCompare(doneAt(a)));
    // Intervall-Aufgaben eigener Block oben; klassische Aufgaben: die nächste offene wird automatisch auf der Karte gezeigt
    const imp = open.filter(t => t.type === 'intervall'), todo = open.filter(t => t.type !== 'intervall'), next = todo[0];
    const pick = ui.hideMap ? null : db.tasks.find(t => t.id === ui.pick) || next, auto = pick && pick === next && !ui.pick;
    const hl = new Set(pick ? taskZones(pick) : []);
    const pm = new Set(pick ? taskMarkers(pick).map(m => m.id) : []); // Punkte der Aufgabe immer zeigen, auch wenn ausgeblendet
    const map = mapSvg(hl.size || pm.size ? 'focus' : '', db.zones.map(z => zoneSvg(z, { green: zoneDone(z), hl: hl.has(z.id), sel: ui.zone === z.id })).join('')
      + db.markers.filter(m => ui.showMarkers || pm.has(m.id)).map(m => markerSvg(m, { hl: pm.has(m.id) })).join(''));
    const hint = ui.hideMap ? 'Ganzer Raum sichtbar. Aufgabe antippen = Ort zeigen · abhaken = weiter mit der nächsten.'
      : !pick ? 'Alles erledigt. Bereich antippen = links nur seine Aufgaben.'
      : `${auto ? 'Als Nächstes: ' : ''}<b>${iconChip(pick)}${esc(pick.title)}</b> – ${hl.size || pm.size ? 'markiert auf der Karte.' : 'kein fester Ort.'}`
        + (ui.pick ? ' <button class="btn small ghost" data-pick="next">Zurück zur nächsten Aufgabe</button>' : '');
    const zs = zone && SHIFTS[effShift(zone.shift)];
    const head = zone
      ? `<button class="btn small ghost" data-zone="${zone.id}">← Alle To-dos</button><h2>${esc(zone.name)}</h2>${zs ? `<span class="tag" style="--c:${zs.color}">${zs.name}</span>` : ''}`
      : '<h2>Heute zu tun</h2>';
    const empty = zone ? (shown.length ? 'Alles erledigt in diesem Bereich!' : 'Heute keine Aufgaben in diesem Bereich.') : 'Alles erledigt für heute!';
    return `${dayBanner()}<div class="dash-grid">
      <section><div class="row ed-bar">${head}<span class="grow"></span><span class="meta">${open.length} offen · ${done.length} erledigt</span></div>
        ${progress(shown)}
        ${imp.length ? `<div class="imp-box"><h3>⚠ Wichtig · Intervall (${imp.length})</h3><div class="list">${imp.map(dashRow).join('')}</div></div>` : ''}
        <div class="list">${todo.map(t => dashRow(t, t === next)).join('') || `<div class="empty">${empty}</div>`}</div>
        <details class="done-box" ${ui.doneOpen ? 'open' : ''}><summary>Erledigt (${done.length})</summary>
          <div class="list">${done.map(dashRow).join('') || '<div class="empty">Noch nichts erledigt.</div>'}</div></details></section>
      <section class="dash-map"><div class="row ed-bar"><h2>Studio Layout</h2><span class="grow"></span>${markerToggle()}</div><div class="map-wrap">${map}</div><p class="meta hint">${hint}</p>
        <div class="legend"><span style="--c:#1a9c4a">alles erledigt</span><span class="done-key">schwarzer Rand = hier zu tun</span></div></section></div>`;
  },

  heute() {
    if (!mittelActive() && ui.shift === 'mittel') ui.shift = 'frueh';
    const list = db.tasks.filter(t => t.type === 'schicht' && dayOk(t) && effShift(t.shift) === ui.shift)
      .sort(byTime);
    const seg = Object.entries(SHIFTS).filter(([k]) => k !== 'mittel' || mittelActive()).map(([k, s]) =>
      `<button data-shift="${k}" class="${k === ui.shift ? 'active' : ''}">${s.name} <small>${hm(s.from)}–${hm(s.to)}</small></button>`).join('');
    const rows = list.map(t => {
      const when = whenText(t) ? `<span class="badge">${whenText(t)}</span>` : '';
      const over = isOverdue(t);
      return taskRow(t, when + (over ? '<span class="badge red">überfällig</span>' : ''), over);
    }).join('');
    return `${dayBanner()}<div class="seg">${seg}</div>${progress(list)}<div class="list">${rows || '<div class="empty">Keine Aufgaben für diese Schicht.</div>'}</div>`;
  },

  intervall() {
    const list = db.tasks.filter(t => t.type === 'intervall');
    const rows = list.map(t => {
      const p = period(t);
      if (p < 0) return taskRow(t, `<span class="badge">alle ${t.everyDays} Tage</span>startet am ${fmtDate(t.startDate)}`);
      const since = dayNum(today()) - (dayNum(t.startDate) + p * t.everyDays);
      const next = t.everyDays - since;
      const last = Object.entries(db.done).filter(([k]) => k.startsWith(t.id + '|')).map(([, v]) => v).sort().pop();
      const status = doneAt(t) ? `nächste in ${next} Tag${next === 1 ? '' : 'en'}`
        : since === 0 ? '<span class="badge red">fällig heute</span>'
        : `<span class="badge red">überfällig seit ${since} Tag${since === 1 ? '' : 'en'}</span>`;
      const lastTxt = last ? ` · zuletzt ${new Date(last).toLocaleDateString('de-AT')}` : '';
      return taskRow(t, `<span class="badge">alle ${t.everyDays} Tage</span>${status}${lastTxt}`, !doneAt(t));
    }).join('');
    return `<h2>Intervall-Aufgaben</h2><div class="list">${rows || '<div class="empty">Keine Intervall-Aufgaben.</div>'}</div>`;
  },

  putzplan() {
    const zones = db.zones.map(z => zoneSvg(z, { done: zoneDone(z), sel: ui.zone === z.id })).join('');
    const map = mapSvg('', zones + (ui.showMarkers ? db.markers.map(m => markerSvg(m)).join('') : ''));
    const legend = (db.colorBy === 'bereich' ? '' : Object.values(SHIFTS).map(s => `<span style="--c:${s.color}">${s.name}</span>`).join('')) + '<span class="done-key">✓ erledigt (blass)</span>';
    const z = db.zones.find(z => z.id === ui.zone);
    let detail = '<div class="empty">Bereich auf der Karte antippen.</div>';
    if (z) {
      const list = zoneTasks(z).sort(byTime);
      const s = SHIFTS[effShift(z.shift)];
      detail = `<h2>${esc(z.name)} ${s ? `<span class="badge" style="background:${s.color};color:${isLight(s.color) ? '#111' : '#fff'}">${s.name}</span>` : ''}</h2>
        ${progress(list)}<div class="list">${list.map(t => taskRow(t, whenText(t) ? `<span class="badge">${whenText(t)}</span>` : '')).join('') || '<div class="empty">Heute keine Aufgaben hier.</div>'}</div>`;
    }
    return `<div class="row ed-bar"><h2>Putzplan</h2><span class="grow"></span>${markerToggle()}${colorToggle()}</div><div class="plan"><div><div class="map-wrap">${map}</div><div class="legend">${legend}</div></div><div>${detail}</div></div>`;
  },

  admin() {
    const DAYS = { wt: ' · Werktags', we: ' · Wochenende/Feiertag' };
    const where = t => (t.type === 'schicht' ? SHIFTS[t.shift].name + (DAYS[t.days] || '') + (t.hourly ? ' · stündlich' : '') + (t.time ? ' · ' + hm(t.time) : t.from ? ` · ${hm(t.from)}–${hm(t.to)}` : '')
      : t.type === 'intervall' ? `alle ${t.everyDays} Tage ab ${fmtDate(t.startDate)}`
      : 'Putzbereich: ' + esc(db.zones.find(z => z.id === t.zoneId)?.name || '–'));
    const ortOf = t => {
      const n = t.type === 'zone' ? [] : placeNames(t); // Putzbereich steht schon davor
      return n.length ? ' · Ort: ' + esc(n.join(', ')) : '';
    };
    const order = { schicht: 0, intervall: 1, zone: 2 };
    const tasks = [...db.tasks].sort((a, b) => order[a.type] - order[b.type]).map(t => `<tr><td>${iconChip(t)}<b>${esc(t.title)}</b><div class="meta">${where(t)}${ortOf(t)}</div></td>
      <td><button class="btn small ghost" data-edit="${t.id}">Bearbeiten</button> <button class="btn small ghost" data-del="${t.id}">Löschen</button></td></tr>`).join('');
    const zones = db.zones.map(z => `<tr><td><input data-zname="${z.id}" value="${esc(z.name)}"></td>
      <td><select data-zshift="${z.id}">${shiftOpts(z.shift)}</select></td></tr>`).join('');
    return `<div class="row" style="justify-content:space-between"><h2>Verwaltung</h2><button class="btn" data-edit="">+ Neue Aufgabe</button></div>
      ${dataSection()}
      <div class="admin-sec"><h3>Aufgaben</h3><table>${tasks}</table></div>
      <div class="admin-sec"><div class="row" style="justify-content:space-between"><h3>Putzbereiche & Schicht</h3>
        <button class="btn small" data-tab="layout">Layout-Editor öffnen</button></div><table>${zones}</table></div>
      <div class="admin-sec"><h3>Zusätzliche Feiertage / Wochenend-Tage</h3>
        <p class="meta">Österreichische Feiertage erkennt die App automatisch. Hier weitere Tage mit Wochenend-Zeiten (8–22 Uhr) eintragen.</p>
        <div class="row"><label>Datum <input type="date" id="holidayInput"></label><button class="btn small" data-holiday="add">Hinzufügen</button></div>
        <div class="holidays">${[...db.holidays].sort().map(d => `<span class="badge">${fmtDate(d)} <button class="x" data-holiday="${d}" aria-label="Entfernen">✕</button></span>`).join('') || '<span class="meta">Keine.</span>'}</div></div>
      <div class="admin-sec"><h3>Einstellungen</h3>
        <p class="meta">Admins und Passwörter verwaltest du im Supabase-Dashboard (Authentication → Users; Admin-Liste: Tabelle „admins“).</p>
        <div class="row"><button class="btn small ghost danger" id="deviceLogout">Dieses Gerät abmelden</button></div></div>`;
  },
};

// --- Daten & Backup: alles als eine .json-Datei raus/rein (Aufgaben, Häkchen, Layout, Punkte, Layouts, Feiertage …) ---
// Der Admin-PIN kommt nicht in die Datei; beim Import bleibt der PIN dieses Geräts.
const BACKUP_KEY = KEY + '-vor-import'; // Stand vor dem letzten Import (für „Rückgängig“)
const counts = d => ({ Aufgaben: d.tasks.length, Bereiche: d.zones.length, Punkte: d.markers?.length || 0,
  'gespeicherte Layouts': d.layouts?.length || 0, Häkchen: Object.keys(d.done || {}).length });
function backupFile() {
  const { pin, ...data } = db; // pin: nur in alten Daten
  const json = JSON.stringify({ app: 'studio-check', version: 1, exportedAt: new Date().toISOString(), studio: ui.libStudio, data }, null, 2);
  const stamp = new Date().toLocaleString('sv').slice(0, 16).replace(/[ :]/g, '-');
  return new File([json], `studio-check-${stamp}.json`, { type: 'application/json' });
}
function parseBackup(txt) {
  const j = JSON.parse(txt), data = j.app === 'studio-check' ? j.data : j; // alte Backups: direkt die Daten
  if (!Array.isArray(data?.tasks) || !Array.isArray(data?.zones) || typeof data.done !== 'object' || !validData(data)) throw new Error('kein Backup');
  return { data, meta: j.app === 'studio-check' ? j : {} };
}
// Alles, was ungeschützt ins HTML wandert (IDs, Zahlen, Zeiten, Farben), muss diese Form haben – sonst Datei ablehnen.
// Texte (Titel, Namen, Emojis) werden beim Anzeigen ohnehin mit esc() geschützt.
function validData(d) {
  const id = v => typeof v === 'string' && /^[\w-]{1,40}$/.test(v), opt = (v, ok) => v == null || ok(v);
  const num = v => Number.isFinite(v), time = v => /^\d\d:\d\d$/.test(v), date = v => /^\d{4}-\d\d-\d\d$/.test(v);
  const color = v => /^#[0-9a-f]{6}$/i.test(v), shift = v => opt(v, s => s === '' || s in SHIFTS);
  const zonesOk = zs => zs.every(z => id(z.id) && shift(z.shift) && opt(z.color, color) && Array.isArray(z.rects) && z.rects.length
    && z.rects.every(r => Array.isArray(r) && r.slice(0, 4).every(num)));
  const markersOk = ms => (ms || []).every(m => id(m.id) && num(m.x) && num(m.y));
  return zonesOk(d.zones) && markersOk(d.markers)
    && d.tasks.every(t => id(t.id) && ['schicht', 'intervall', 'zone'].includes(t.type) && shift(t.shift)
      && ['time', 'from', 'to'].every(k => opt(t[k], time)) && opt(t.startDate, date) && opt(t.everyDays, num)
      && opt(t.zoneId, id) && (t.zoneIds || []).every(id) && (t.markerIds || []).every(id))
    && Object.values(d.done).every(v => typeof v === 'string' && !isNaN(Date.parse(v)))
    && (d.holidays || []).every(date) && (d.layouts || []).every(l => zonesOk(l.zones) && markersOk(l.markers));
}
function dataSection() {
  const imp = ui.importData, fmt = iso => iso ? new Date(iso).toLocaleString('de-AT', { dateStyle: 'medium', timeStyle: 'short' }) : 'unbekannt';
  const list = c => Object.entries(c).map(([k, v]) => `<li><b>${v}</b> ${k}</li>`).join('');
  const preview = imp ? `<div class="import-box"><h3>Datei prüfen: ${esc(imp.name)}</h3>
      <p class="meta">Exportiert am ${fmt(imp.meta.exportedAt)}${imp.meta.studio ? ' · ' + esc(imp.meta.studio) : ''}</p>
      <div class="cmp"><div><b>In der Datei</b><ul>${list(counts(imp.data))}</ul></div><div><b>Aktuell auf diesem Gerät</b><ul>${list(counts(db))}</ul></div></div>
      <div class="row"><button class="btn small" data-import="all">Alles ersetzen</button>
        <button class="btn small ghost" data-import="layout">Nur Layout & Punkte übernehmen</button>
        <button class="btn small ghost" data-import="cancel">Abbrechen</button></div>
      <p class="meta">„Nur Layout & Punkte“ behält eure Aufgaben und Häkchen und tauscht Karte, Punkte, gespeicherte Layouts und eigene Emojis aus.</p></div>` : '';
  const canShare = !!navigator.canShare?.({ files: [new File([''], 'x.json', { type: 'application/json' })] });
  const undo = localStorage.getItem(BACKUP_KEY) ? '<button class="btn small ghost" data-import="undo">Letzten Import rückgängig machen</button>' : '';
  return `<div class="admin-sec"><h3>Daten & Backup</h3>
    <p class="meta">Speichert <b>alles</b> in einer Datei: Aufgaben, Häkchen, Layout, Punkte, gespeicherte Layouts, Feiertage, eigene Emojis. Passwörter sind nicht enthalten.</p>
    <div class="data-grid">
      <div><h4>Exportieren</h4><p class="meta">Als Backup am PC/in der Cloud ablegen oder an ein anderes Gerät schicken.</p>
        <div class="row"><button class="btn small" data-export="download">⬇ Datei herunterladen</button>
          ${canShare ? '<button class="btn small ghost" data-export="share">Teilen … (Mail, WhatsApp, Drive)</button>' : ''}</div></div>
      <div><h4>Importieren</h4><p class="meta">Backup-Datei auswählen – du siehst vorher, was drin ist.</p>
        <div class="row"><label class="btn small ghost">📂 Datei auswählen<input type="file" id="importFile" accept=".json,application/json" hidden></label>${undo}</div></div>
    </div>${preview}</div>`;
}
// Monats-Backup: Vermerk „backup|JJJJ-MM“ in der Datenbank – sobald ein Gerät gespeichert hat, ist die Erinnerung überall weg
const monthKey = () => 'backup|' + today().slice(0, 7);
function markBackup() { db.done[monthKey()] = new Date().toISOString(); save(); }
// In den letzten 3 Tagen des Monats erinnern, solange diesen Monat noch kein Backup gespeichert wurde
function checkBackup() {
  const d = new Date(today() + 'T12:00'), lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  if (!cloud.ready || d.getDate() < lastDay - 2 || db.done[monthKey()] || document.querySelector('dialog[open]')) return;
  let later = ''; try { later = localStorage.getItem('backup-later'); } catch {}
  if (later !== today()) $('#backupDlg').showModal();
}
console.assert(new Date(2026, 1 + 1, 0).getDate() === 28 && new Date(2028, 2, 0).getDate() === 29); // Feb + Schaltjahr
$('#backupNow').onclick = () => { exportData('download'); $('#backupDlg').close(); render(); };
$('#backupLater').onclick = () => { try { localStorage.setItem('backup-later', today()); } catch {} $('#backupDlg').close(); };

async function exportData(how) {
  const file = backupFile();
  if (how === 'share') { try { await navigator.share({ files: [file], title: 'Studio Check Backup' }); markBackup(); } catch {} return; }
  markBackup();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function importData(mode) {
  const imp = ui.importData;
  if (mode === 'undo') {
    if (!confirm('Stand vor dem letzten Import wiederherstellen?')) return;
    db = JSON.parse(localStorage.getItem(BACKUP_KEY)); localStorage.removeItem(BACKUP_KEY);
    normalize(); save(); return render();
  }
  ui.importData = null;
  if (mode === 'cancel' || !imp) return render();
  if (!confirm(mode === 'all' ? 'Alle Daten auf diesem Gerät durch die Datei ersetzen?' : 'Layout und Punkte durch die aus der Datei ersetzen?')) return render();
  localStorage.setItem(BACKUP_KEY, JSON.stringify(db));
  const next = mode === 'all' ? { ...imp.data, colorBy: db.colorBy }
    : { ...db, zones: imp.data.zones, markers: imp.data.markers || [], layouts: imp.data.layouts || db.layouts,
        customIcons: imp.data.customIcons || db.customIcons, colorBy: imp.data.colorBy || db.colorBy };
  if (mode === 'layout') { // Putzaufgaben ohne Bereich wären verwaist
    const ids = new Set(next.zones.map(z => z.id));
    next.tasks = next.tasks.filter(t => t.type !== 'zone' || ids.has(t.zoneId));
  }
  db = next; normalize(); save(); render(); // speichert in die Datenbank – alle Geräte sehen es sofort
}

// --- Layout-Editor (nur Admin). Arbeitet auf einer Kopie (ui.draft), erst „Speichern“ übernimmt sie. ---
Object.assign(ui, { draft: null, draftM: null, sel: null, snap: true, grid: 10, pieceMode: false, lib: false, libMsg: '', libStudio: 'Clever Fit Europaplatz' });
const edZone = () => ui.sel?.zone && ui.draft.find(z => z.id === ui.sel.zone);
const edMarker = () => ui.sel?.marker && ui.draftM.find(m => m.id === ui.sel.marker);
const snapV = v => ui.snap ? Math.round(v / ui.grid) * ui.grid : Math.round(v);
const HANDLES = { nw: [0, 0], n: [.5, 0], ne: [1, 0], e: [1, .5], se: [1, 1], s: [.5, 1], sw: [0, 1], w: [0, .5] };

function edLayer() {
  const z = edZone();
  let handles = '';
  if (z) {
    const [x, y, w, h] = z.rects[ui.sel.piece];
    handles = Object.entries(HANDLES).map(([k, [fx, fy]]) =>
      `<rect class="handle h-${k}" data-h="${k}" x="${x + w * fx - 5}" y="${y + h * fy - 5}" width="10" height="10" rx="2"/>`).join('');
  }
  const order = z ? [...ui.draft.filter(d => d !== z), z] : ui.draft; // ausgewählter Bereich oben
  const mk = edMarker();
  const all = ui.scaleMode ? (([x, y, w, h]) => `<rect class="all-box" x="${x - 4}" y="${y - 4}" width="${w + 8}" height="${h + 8}" rx="6"/>`)(layoutBox()) : '';
  return order.map(d => zoneSvg(d, { sel: d === z, piece: d === z ? ui.sel.piece : -1 })).join('') + handles
    + ui.draftM.map(m => markerSvg(m, { sel: m === mk })).join('') + all;
}

// --- Ganzes Layout gleichmäßig skalieren (Bereiche + Punkte, Abstände wachsen mit) ---
const layoutBox = () => { const [x, y, w, h] = fitView(ui.draft); return [x + 10, y + 10, w - 20, h - 20]; };
const maxScale = () => { const [x, y, w, h] = layoutBox(); return Math.min((ED.W - x) / w, (ED.H - y) / h); };
function scaleAll(f) {
  f = Math.min(f, maxScale()); // nie über den Rand der Zeichenfläche
  const [bx, by] = layoutBox(), sx = v => bx + Math.round((v - bx) * f), sy = v => by + Math.round((v - by) * f);
  // Kanten statt Breiten runden: gleiche Kante → gleiche neue Kante, Gänge bleiben überall gleich breit
  ui.draft.forEach(z => z.rects.forEach(r => {
    const x1 = sx(r[0]), y1 = sy(r[1]);
    r.splice(0, 4, x1, y1, Math.max(ED.MIN, sx(r[0] + r[2]) - x1), Math.max(ED.MIN, sy(r[1] + r[3]) - y1));
  }));
  ui.draftM.forEach(m => { m.x = sx(m.x); m.y = sy(m.y); });
}
function scalePanel() {
  const [, , w, h] = layoutBox(), max = Math.floor(maxScale() * 100);
  return `<div class="admin-sec ed-form"><h3>Alles skalieren</h3>
    <p class="meta">Alle Bereiche und Punkte sind markiert und werden gemeinsam vergrößert oder verkleinert – Formen und Abstände bleiben gleich.</p>
    <p>Aktuelle Größe: <b>${w} × ${h}</b> · max. <b>${max} %</b></p>
    <div class="row"><button class="btn small ghost" data-ed="scaleBy" data-val="0.9">−10 %</button>
      <button class="btn small ghost" data-ed="scaleBy" data-val="1.1">+10 %</button>
      <button class="btn small ghost" data-ed="scaleBy" data-val="1.25">+25 %</button></div>
    <div class="row"><label>Eigener Wert (%)<input type="number" id="scalePct" value="${Math.min(150, max)}" min="10" step="5"></label>
      <button class="btn small" data-ed="scalePct">Anwenden</button></div>
    <div class="row"><button class="btn small" data-ed="scaleBy" data-val="99">Maximal (ganze Fläche nutzen)</button></div>
    <p class="meta">Rückgängig: „Verwerfen“. Übernehmen: „Speichern“.</p>
    <div class="row"><button class="btn small ghost" data-ed="scale">Fertig</button></div></div>`;
}

// Kleine Vorschau eines gespeicherten Layouts
const thumb = l => { const [x, y, w, h] = fitView(l.zones);
  return `<svg viewBox="${x} ${y} ${w} ${h}" class="lib-thumb"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#e9e9e9"/>${l.zones.map(z =>
    z.rects.map(([rx, ry, rw, rh]) => `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="4" fill="${fillOf(z)}"/>`).join('')).join('')}</svg>`; };

function libPanel() {
  const fmt = iso => new Date(iso).toLocaleString('de-AT', { dateStyle: 'short', timeStyle: 'short' });
  const list = [...db.layouts].sort((a, b) => a.studio.localeCompare(b.studio) || b.savedAt.localeCompare(a.savedAt)).map(l => `<div class="lib-item">
    ${thumb(l)}<div class="lib-info"><b>${esc(l.studio)}</b><div>${esc(l.name)}</div>
      <div class="meta">${fmt(l.savedAt)} · ${l.zones.length} Bereiche · ${l.markers.length} Punkte</div>${l.note ? `<div class="meta">${esc(l.note)}</div>` : ''}
      <div class="row"><button class="btn small" data-ed="libLoad" data-val="${l.id}">Laden</button>
        <button class="btn small ghost danger" data-ed="libDel" data-val="${l.id}">Löschen</button></div></div></div>`).join('');
  return `<div class="admin-sec ed-form">${ui.libMsg ? `<p class="lib-msg">${ui.libMsg}</p>` : ''}
    <h3>Aktuelles Layout speichern</h3>
    <label>Studio-Name<input id="libStudio" value="${esc(ui.libStudio)}"></label>
    <label>Bezeichnung<input id="libName" placeholder="z.B. Sommer-Umbau 2026"></label>
    <label>Notiz (optional)<input id="libNote" placeholder="z.B. neue Cardio-Reihe"></label>
    <button class="btn small" data-ed="libSave">In Bibliothek speichern</button>
    <h3>Gespeicherte Layouts (${db.layouts.length})</h3>${list || '<p class="meta">Noch keine Layouts gespeichert.</p>'}
    <div class="row"><button class="btn small ghost" data-ed="lib">Schließen</button></div></div>`;
}

function edPanel() {
  if (ui.scaleMode) return scalePanel();
  if (ui.lib) return libPanel();
  const z = edZone(), mk = edMarker();
  if (mk) return `<div class="admin-sec ed-form"><h3>Punkt</h3>
    <label>Name<input data-mf="name" value="${esc(mk.name)}"></label>
    <span class="lbl">Symbol</span><div class="icon-pick">${markerIcons().map(([i, n]) =>
      `<button class="${i === mk.icon ? 'active' : ''}" data-ed="icon" data-val="${esc(i)}" title="${esc(n)}">${glyph(i)}</button>`).join('')}</div>
    <label>Eigenes Symbol (Emoji oder Buchstabe)<input data-mf="icon" value="${esc(mk.icon || '')}" maxlength="4"></label>
    <p class="meta">Liegt in: <b>${esc(ui.draft.find(z => z.rects.some(r => inRect(mk, r)))?.name || 'keinem Bereich')}</b></p>
    <div class="row"><button class="btn small ghost danger" data-ed="delMarker">Punkt löschen</button></div></div>`;
  if (!z) return `<div class="admin-sec ed-help"><h3>So geht's</h3><ul>
    <li><b>+ Punkt</b> = Mülltonne, Wasserspender usw. setzen (auf der Karte normal versteckt)</li>
    <li><b>Bereich/Punkt antippen</b> = auswählen</li><li><b>Ziehen</b> = verschieben</li>
    <li><b>Weiße Punkte</b> ziehen = Größe ändern</li><li><b>Teil hinzufügen</b> = L-Formen bauen</li>
    <li>Pfeiltasten = fein verschieben</li></ul></div>`;
  const [x, y, w, h, lbl] = z.rects[ui.sel.piece], n = z.rects.length;
  return `<div class="admin-sec ed-form">
    <label>Name<input data-f="name" value="${esc(z.name)}"></label>
    <label>Kurzname auf der Karte <input data-f="label" value="${esc(z.label || '')}" placeholder="${esc(z.name)}"></label>
    <label>Schicht<select data-f="shift">${shiftOpts(z.shift)}</select></label>
    <div class="row"><label>Bereichsfarbe<input type="color" data-f="color" value="${z.color || SHIFTS[z.shift]?.color || FREE_COLOR}"></label>
      ${z.color ? '<button class="btn small ghost" data-ed="resetColor">Farbe entfernen</button>' : ''}</div>
    <h3>Teil ${ui.sel.piece + 1} von ${n}</h3>
    <div class="row"><label>X<input type="number" data-p="0" value="${x}"></label><label>Y<input type="number" data-p="1" value="${y}"></label>
      <label>Breite<input type="number" data-p="2" value="${w}" min="${ED.MIN}"></label><label>Höhe<input type="number" data-p="3" value="${h}" min="${ED.MIN}"></label></div>
    ${ui.sel.piece > 0 ? `<label>Eigene Beschriftung (optional)<input data-p="4" value="${esc(lbl || '')}" placeholder="z.B. WC"></label>` : ''}
    <div class="row"><button class="btn small ghost" data-ed="addPiece">+ Teil anbauen</button>
      ${n > 1 ? '<button class="btn small ghost" data-ed="delPiece">Teil entfernen</button>' : ''}
      <button class="btn small ghost" data-ed="dup">Duplizieren</button>
      <button class="btn small ghost danger" data-ed="del">Bereich löschen</button></div></div>`;
}

views.layout = () => {
  ui.draft ??= structuredClone(db.zones);
  ui.draftM ??= structuredClone(db.markers);
  return `<div class="row ed-bar"><h2>Layout-Editor</h2>
      <label class="chk"><input type="checkbox" data-opt="snap" ${ui.snap ? 'checked' : ''}> Einrasten</label>
      <label class="chk">Raster <select data-opt="grid">${[5, 10, 20].map(g => `<option ${g === ui.grid ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
      <label class="chk"><input type="checkbox" data-opt="pieceMode" ${ui.pieceMode ? 'checked' : ''}> Teile einzeln ziehen</label>
      <span class="grow"></span>${colorToggle()}
      <button class="btn small ghost" data-ed="add">+ Bereich</button>
      <button class="btn small ghost" data-ed="addMarker">+ Punkt</button>
      <button class="btn small ghost" data-ed="scale">⤢ Alles skalieren</button>
      <button class="btn small ghost" data-ed="lib">Layouts (${db.layouts.length})</button>
      <button class="btn small ghost" data-ed="reset">Standard-Layout</button>
      <button class="btn small ghost" data-ed="cancel">Verwerfen</button>
      <button class="btn small" data-ed="save">Speichern</button></div>
    <div class="plan ed-plan"><div class="map-wrap"><svg id="edSvg" class="map editor" viewBox="-10 -10 ${ED.W + 20} ${ED.H + 20}">
      <defs><pattern id="grid" width="${ui.grid}" height="${ui.grid}" patternUnits="userSpaceOnUse">
        <path d="M${ui.grid} 0H0V${ui.grid}" fill="none" stroke="#d0d0d0" stroke-width=".6"/></pattern></defs>
      <rect class="floor" x="0" y="0" width="${ED.W}" height="${ED.H}"/>
      ${ui.snap ? `<rect x="0" y="0" width="${ED.W}" height="${ED.H}" fill="url(#grid)"/>` : ''}
      <g id="edLayer">${edLayer()}</g></svg></div><div id="edPanel">${edPanel()}</div></div>`;
};
const redrawEd = (panel = true) => { $('#edLayer').innerHTML = edLayer(); if (panel) $('#edPanel').innerHTML = edPanel(); };

const moveMarker = (m, [ox, oy], dx, dy) => { m.x = Math.max(0, Math.min(ED.W, snapV(ox + dx))); m.y = Math.max(0, Math.min(ED.H, snapV(oy + dy))); };
// Verschieben/Größe ändern; Teile werden in der Zeichenfläche gehalten.
function edMove(z, idx, orig, dx, dy) {
  const xs = idx.map(k => orig[k]);
  const minX = Math.min(...xs.map(r => r[0])), minY = Math.min(...xs.map(r => r[1]));
  const maxX = Math.max(...xs.map(r => r[0] + r[2])), maxY = Math.max(...xs.map(r => r[1] + r[3]));
  const ddx = Math.max(-minX, Math.min(ED.W - maxX, snapV(minX + dx) - minX));
  const ddy = Math.max(-minY, Math.min(ED.H - maxY, snapV(minY + dy) - minY));
  idx.forEach(k => { z.rects[k][0] = orig[k][0] + ddx; z.rects[k][1] = orig[k][1] + ddy; });
}
function edResize(r, o, hd, dx, dy) {
  let x1 = o[0], y1 = o[1], x2 = o[0] + o[2], y2 = o[1] + o[3];
  if (hd.includes('w')) x1 = Math.max(0, Math.min(snapV(x1 + dx), x2 - ED.MIN));
  if (hd.includes('e')) x2 = Math.min(ED.W, Math.max(snapV(x2 + dx), x1 + ED.MIN));
  if (hd.includes('n')) y1 = Math.max(0, Math.min(snapV(y1 + dy), y2 - ED.MIN));
  if (hd.includes('s')) y2 = Math.min(ED.H, Math.max(snapV(y2 + dy), y1 + ED.MIN));
  r.splice(0, 4, x1, y1, x2 - x1, y2 - y1);
}
{ // Selbsttest Resize/Snap
  const r = [10, 10, 50, 50]; ui.snap = true; edResize(r, [10, 10, 50, 50], 'se', 23, -100);
  console.assert(r.join() === '10,10,70,10', 'edResize', r);
}

let drag = null;
const svgPt = (svg, e) => new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
$('#view').addEventListener('pointerdown', e => {
  const svg = e.target.closest('#edSvg');
  if (!svg) return;
  const mg = e.target.closest('[data-marker]');
  if (mg) {
    ui.sel = { marker: mg.dataset.marker }; ui.lib = ui.scaleMode = false;
    const m = edMarker();
    drag = { m, start: svgPt(svg, e), orig: [m.x, m.y] };
    svg.setPointerCapture(e.pointerId);
    return redrawEd();
  }
  const hd = e.target.dataset.h, g = e.target.closest('[data-zone]');
  if (!hd && !g) { ui.sel = null; return redrawEd(); }
  if (g) { ui.sel = { zone: g.dataset.zone, piece: +(e.target.dataset.piece ?? 0) }; ui.lib = ui.scaleMode = false; }
  const z = edZone();
  drag = { hd, z, start: svgPt(svg, e), orig: structuredClone(z.rects) };
  svg.setPointerCapture(e.pointerId);
  redrawEd();
});
$('#view').addEventListener('pointermove', e => {
  if (!drag) return;
  const p = svgPt($('#edSvg'), e), dx = p.x - drag.start.x, dy = p.y - drag.start.y, i = ui.sel.piece;
  if (drag.m) moveMarker(drag.m, drag.orig, dx, dy);
  else if (drag.hd) edResize(drag.z.rects[i], drag.orig[i], drag.hd, dx, dy);
  else edMove(drag.z, ui.pieceMode ? [i] : drag.orig.map((_, k) => k), drag.orig, dx, dy);
  redrawEd(false);
});
const endDrag = () => { if (drag) { drag = null; redrawEd(); } };
$('#view').addEventListener('pointerup', endDrag);
$('#view').addEventListener('pointercancel', endDrag);

document.addEventListener('keydown', e => {
  const z = ui.tab === 'layout' && edZone(), mk = ui.tab === 'layout' && edMarker();
  if (!z && !mk || !e.key.startsWith('Arrow') || e.target.matches('input, select, textarea')) return;
  e.preventDefault();
  const step = ui.snap ? ui.grid : 1, d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
  if (mk) moveMarker(mk, [mk.x, mk.y], ...d);
  else edMove(z, ui.pieceMode ? [ui.sel.piece] : z.rects.map((_, k) => k), structuredClone(z.rects), ...d);
  redrawEd();
});

$('#view').addEventListener('input', e => {
  const z = edZone(), d = e.target.dataset, v = e.target.value;
  if (d.opt) {
    ui[d.opt] = e.target.type === 'checkbox' ? e.target.checked : +v;
    return render();
  }
  const mk = edMarker();
  if (mk && d.mf) { mk[d.mf] = v.trim() || (d.mf === 'name' ? 'Punkt' : '📍'); return redrawEd(false); }
  if (!z) return;
  if (d.f === 'name') z.name = v.trim() || 'Bereich';
  else if (d.f === 'label') { if (v.trim()) z.label = v.trim(); else delete z.label; }
  else if (d.f === 'shift') { z.shift = v; return redrawEd(); }
  else if (d.f === 'color') { z.color = v; if (db.colorBy !== 'bereich') { db.colorBy = 'bereich'; save(); return render(); } }
  else if (d.p === '4') { const r = z.rects[ui.sel.piece]; if (v.trim()) r[4] = v.trim(); else r.length = 4; }
  else if (d.p !== undefined && v !== '') {
    const r = z.rects[ui.sel.piece], k = +d.p;
    r[k] = Math.max(k < 2 ? 0 : ED.MIN, Math.round(+v) || 0);
    r[2] = Math.min(r[2], ED.W); r[3] = Math.min(r[3], ED.H);
    r[0] = Math.min(r[0], ED.W - r[2]); r[1] = Math.min(r[1], ED.H - r[3]);
  } else return;
  redrawEd(false);
});

function edAction(a, val) {
  const z = edZone(), mk = edMarker();
  if (a === 'scale') { ui.scaleMode = !ui.scaleMode; ui.lib = false; ui.sel = null; return redrawEd(); }
  if (a === 'scaleBy' || a === 'scalePct') {
    const f = a === 'scalePct' ? +$('#scalePct').value / 100 : +val;
    if (f > 0) scaleAll(f);
    return redrawEd();
  }
  if (a.startsWith('lib')) { ui.sel = null; ui.libMsg = ''; ui.scaleMode = false; }
  if (a === 'lib') { ui.lib = !ui.lib; return render(); }
  if (a === 'libSave') {
    const studio = $('#libStudio').value.trim(), note = $('#libNote').value.trim();
    const name = $('#libName').value.trim() || new Date().toLocaleDateString('de-AT');
    if (!studio) return alert('Bitte einen Studio-Namen eingeben.');
    const ex = db.layouts.find(l => l.studio === studio && l.name === name);
    if (ex && !confirm(`„${studio} – ${name}“ gibt es schon. Überschreiben?`)) return;
    const entry = { id: ex?.id || uid(), studio, name, note, savedAt: new Date().toISOString(), zones: structuredClone(ui.draft), markers: structuredClone(ui.draftM) };
    if (ex) Object.assign(ex, entry); else db.layouts.push(entry);
    save(); ui.libStudio = studio; ui.libMsg = `✓ Gespeichert: <b>${esc(studio)} – ${esc(name)}</b>`;
    return render();
  }
  if (a === 'libLoad') {
    const l = db.layouts.find(l => l.id === val);
    if (!confirm(`„${l.studio} – ${l.name}“ in den Editor laden? Nicht gespeicherte Änderungen im Editor gehen verloren.`)) return;
    ui.draft = structuredClone(l.zones); ui.draftM = structuredClone(l.markers); ui.libStudio = l.studio;
    ui.libMsg = `✓ Geladen: <b>${esc(l.studio)} – ${esc(l.name)}</b>. Zum Übernehmen oben <b>Speichern</b> drücken.`;
    return render();
  }
  if (a === 'libDel') {
    const l = db.layouts.find(l => l.id === val);
    if (!confirm(`„${l.studio} – ${l.name}“ aus der Bibliothek löschen?`)) return;
    db.layouts = db.layouts.filter(x => x !== l); save();
    return render();
  }
  if (a === 'addMarker') {
    const [vx, vy, vw, vh] = fitView(ui.draft); // Mitte des Layouts
    const m = { id: uid(), name: 'Neuer Punkt', icon: '📍', x: snapV(vx + vw / 2), y: snapV(vy + vh / 2) };
    ui.draftM.push(m); ui.sel = { marker: m.id };
  } else if (a === 'icon' && mk) {
    const preset = markerIcons().find(([i]) => i === val);
    if (mk.name === 'Neuer Punkt' || markerIcons().some(([, n]) => n === mk.name)) mk.name = preset[1]; // Vorschlags-Name übernehmen
    mk.icon = val;
  } else if (a === 'delMarker' && mk) {
    const n = db.tasks.filter(t => t.markerIds?.includes(mk.id)).length;
    if (n && !confirm(`„${mk.name}“ ist bei ${n} Aufgabe(n) als Ort eingetragen. Trotzdem löschen?`)) return;
    ui.draftM = ui.draftM.filter(m => m !== mk); ui.sel = null;
  } else if (a === 'add') {
    const [vx, vy, , vh] = fitView(ui.draft), below = vy + vh; // freier Platz unter dem Layout, sonst oben links
    const nz = { id: uid(), name: 'Neuer Bereich', shift: '', rects: [below + 60 <= ED.H ? [Math.max(0, vx + 10), below, 100, 60] : [20, 20, 100, 60]] };
    ui.draft.push(nz); ui.sel = { zone: nz.id, piece: 0 };
  } else if (a === 'dup' && z) {
    const nz = { ...structuredClone(z), id: uid(), name: z.name + ' (Kopie)' };
    delete nz.label;
    edMove(nz, nz.rects.map((_, k) => k), structuredClone(nz.rects), 20, 20);
    ui.draft.push(nz); ui.sel = { zone: nz.id, piece: 0 };
  } else if (a === 'addPiece' && z) {
    const [x, y, w, h] = z.rects[ui.sel.piece];
    z.rects.push([x, Math.min(y + h, ED.H - 40), Math.min(w, 60), 40]); // direkt darunter angebaut
    ui.sel.piece = z.rects.length - 1;
  } else if (a === 'delPiece' && z) { z.rects.splice(ui.sel.piece, 1); ui.sel.piece = 0; }
  else if (a === 'del' && z) {
    const n = db.tasks.filter(t => t.zoneId === z.id).length;
    if (!confirm(`„${z.name}“ löschen?${n ? ` Die ${n} Putzaufgabe(n) dieses Bereichs werden beim Speichern mitgelöscht.` : ''}`)) return;
    ui.draft = ui.draft.filter(d => d !== z); ui.sel = null;
  } else if (a === 'resetColor' && z) delete z.color;
  else if (a === 'reset') {
    if (!confirm('Standard-Layout laden? Deine Änderungen im Editor gehen verloren.')) return;
    const old = Object.fromEntries(db.zones.map(z => [z.id, z]));
    ui.draft = seed().zones.map(z => old[z.id] ? { ...z, shift: old[z.id].shift } : z); ui.sel = null;
  } else if (a === 'cancel') {
    if (!confirm('Änderungen verwerfen?')) return;
    ui.draft = ui.draftM = ui.sel = null; ui.tab = 'admin'; return render();
  } else if (a === 'save') {
    const ids = new Set(ui.draft.map(z => z.id));
    const lost = db.tasks.filter(t => t.type === 'zone' && !ids.has(t.zoneId)).length;
    if (lost && !confirm(`${lost} Putzaufgabe(n) gehören zu Bereichen, die es in diesem Layout nicht mehr gibt, und werden gelöscht. Trotzdem speichern?`)) return;
    const mids = new Set(ui.draftM.map(m => m.id));
    rememberIcons(ui.draftM);
    db.zones = ui.draft; db.markers = ui.draftM;
    db.tasks.forEach(t => { if (t.markerIds) t.markerIds = t.markerIds.filter(id => mids.has(id)); });
    db.tasks = db.tasks.filter(t => t.type !== 'zone' || ids.has(t.zoneId));
    db.tasks.forEach(t => { if (t.zoneIds) t.zoneIds = t.zoneIds.filter(id => ids.has(id)); });
    if (!ids.has(ui.zone)) ui.zone = null;
    save(); ui.draft = ui.draftM = ui.sel = null; ui.tab = 'putzplan'; return render();
  }
  redrawEd();
}

function render() {
  document.body.classList.toggle('admin', ui.admin);
  $('#adminBtn').textContent = ui.admin ? 'Admin beenden' : 'Admin';
  // Wer ist angemeldet? Gerät abmelden nur im Admin-Modus, damit an der Theke niemand aus Versehen abmeldet
  $('#account').innerHTML = cloud.email ? `<span title="Angemeldet">👤 ${esc(cloud.email)}</span>`
    + (ui.admin ? ' <button class="btn small ghost" id="topLogout">Gerät abmelden</button>' : '') : '';
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === ui.tab));
  $('#view').classList.toggle('full', ui.tab === 'layout');
  $('#view').classList.toggle('wide', ui.tab === 'dashboard');
  $('#view').innerHTML = views[ui.tab]();
}

// --- Events ---
$('#tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b) { ui.tab = b.dataset.tab; render(); } };

$('#view').addEventListener('click', e => {
  if (e.target.closest('#edSvg')) return; // Editor-Karte läuft über Pointer-Events
  const el = e.target.closest('[data-toggle],[data-shift],[data-zone],[data-edit],[data-del],[data-ed],[data-tab],[data-colorby],[data-pick],[data-markers],[data-mittel],[data-holiday],[data-export],[data-import],#deviceLogout');
  if (!el) return;
  const d = el.dataset;
  if (d.ed) edAction(d.ed, d.val);
  else if (d.colorby) { db.colorBy = d.colorby; save(); render(); }
  else if (d.tab) { ui.tab = d.tab; render(); }
  else if (d.toggle) toggle(d.toggle);
  else if (d.mittel !== undefined) { if (mittelActive()) delete db.mittelDays[today()]; else db.mittelDays[today()] = new Date().toISOString(); ui.shift = currentShift(); save(); render(); }
  else if (d.holiday) {
    if (d.holiday === 'add') { const v = $('#holidayInput').value; if (!v) return; if (!db.holidays.includes(v)) db.holidays.push(v); }
    else db.holidays = db.holidays.filter(x => x !== d.holiday);
    save(); render();
  }
  else if (d.markers !== undefined) { ui.showMarkers = !ui.showMarkers; render(); }
  else if (d.pick) { pickTask(d.pick); }
  else if (d.shift) { ui.shift = d.shift; render(); }
  else if (d.zone) { ui.zone = ui.tab === 'dashboard' && ui.zone === d.zone ? null : d.zone; render(); } // Dashboard: nochmal tippen = schließen
  else if (d.edit !== undefined) openTask(d.edit);
  else if (d.del && confirm('Aufgabe wirklich löschen?')) { db.tasks = db.tasks.filter(t => t.id !== d.del); save(); render(); }
  else if (el.id === 'deviceLogout') deviceLogout();
  else if (d.export) exportData(d.export);
  else if (d.import) importData(d.import);
});
$('#view').addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const d = e.target.dataset;
  if (d.toggle && e.target.tagName !== 'BUTTON') { e.preventDefault(); toggle(d.toggle); }
  else if (d.pick) { e.preventDefault(); pickTask(d.pick); }
});
// <details> „Erledigt“: Auf/Zu über Neuzeichnen hinweg merken (toggle-Event bubbelt nicht)
document.addEventListener('toggle', e => { if (e.target.classList?.contains('done-box')) ui.doneOpen = e.target.open; }, true);

$('#view').addEventListener('change', e => {
  const d = e.target.dataset;
  if (d.zname) { const z = db.zones.find(z => z.id === d.zname); z.name = e.target.value.trim() || 'Bereich'; delete z.label; save(); }
  else if (d.zshift) { db.zones.find(z => z.id === d.zshift).shift = e.target.value; save(); }
  else if (e.target.id === 'importFile') {
    const file = e.target.files[0];
    file?.text().then(txt => { ui.importData = { ...parseBackup(txt), name: file.name }; render(); })
      .catch(() => alert('Datei ist kein gültiges Studio-Check-Backup.'));
  }
});

// Gerät abmelden (z.B. um am Theken-PC das Theke-Konto anzumelden)
function deviceLogout() {
  if (!confirm('Dieses Gerät abmelden? Danach muss sich hier jemand neu anmelden (z.B. mit dem Theke-Konto).')) return;
  Promise.all([sb.auth.signOut(), sbAdmin.auth.signOut()]).finally(() => location.reload());
}
$('#account').onclick = e => { if (e.target.id === 'topLogout') deviceLogout(); };

// Admin-Login
$('#adminBtn').onclick = () => {
  if (ui.admin) {
    ui.admin = false; ui.draft = ui.draftM = ui.sel = null;
    if (cloud.admin === sbAdmin) { sbAdmin.auth.signOut(); cloud.admin = null; }
    if (ui.tab === 'admin' || ui.tab === 'layout') ui.tab = 'dashboard';
    return render();
  }
  if (cloud.isAdmin) { ui.admin = true; ui.tab = 'admin'; return render(); } // Gerät ist schon mit Admin-Konto angemeldet
  $('#adminEmail').value = ''; $('#pinInput').value = ''; $('#pinErr').textContent = ''; $('#pinDlg').showModal();
};
$('#pinForm').onsubmit = async e => {
  if (e.submitter?.value === 'cancel') return;
  e.preventDefault();
  const email = $('#adminEmail').value.trim();
  const { error } = await sbAdmin.auth.signInWithPassword({ email, password: $('#pinInput').value });
  if (error) return $('#pinErr').textContent = 'E-Mail oder Passwort falsch.';
  if (!await isAdminEmail(sbAdmin, email)) { await sbAdmin.auth.signOut(); return $('#pinErr').textContent = 'Dieses Konto ist kein Admin.'; }
  cloud.admin = sbAdmin; $('#pinDlg').close();
  ui.admin = true; ui.tab = 'admin'; render();
};

// Aufgabe anlegen / bearbeiten
const form = $('#taskForm');
let editing = null;
form.elements.shift.innerHTML = Object.entries(SHIFTS).map(([k, s]) => `<option value="${k}">${s.name}</option>`).join('');
const showTypeFields = () => {
  form.querySelectorAll('[data-for]').forEach(el => el.hidden = el.dataset.for !== form.elements.type.value);
  $('#daysField').hidden = form.elements.type.value === 'intervall';
  $('#ortLabel').textContent = form.elements.type.value === 'zone' ? 'Bereich + Punkte auf der Karte antippen' : 'Ort auf der Karte (optional, mehrere möglich)';
  drawPick();
};

// --- Orte im Aufgaben-Dialog: Bereiche/Punkte auf der Karte antippen, neue Punkte setzen ---
const pick = { zones: new Set(), markers: new Set(), newMarkers: [], placing: null };
const pickMarkers = () => [...db.markers, ...pick.newMarkers];
function drawPick() {
  const isZone = form.elements.type.value === 'zone', zsel = isZone ? new Set([form.elements.zoneId.value]) : pick.zones;
  const any = zsel.size || pick.markers.size;
  $('#ortMap').innerHTML = mapSvg(`pick ${any && !pick.placing ? 'focus' : ''} ${pick.placing ? 'placing' : ''}`,
    db.zones.map(z => zoneSvg(z, { hl: zsel.has(z.id) })).join('') + pickMarkers().map(m => markerSvg(m, { sel: pick.markers.has(m.id) })).join(''));
  const names = [...[...zsel].map(id => db.zones.find(z => z.id === id)?.name), ...pickMarkers().filter(m => pick.markers.has(m.id)).map(m => m.name)].filter(Boolean);
  $('#ortSummary').innerHTML = names.length ? `Ausgewählt: <b>${esc(names.join(', '))}</b>` : 'Nichts ausgewählt – Bereich oder Punkt antippen.';
}
$('#ortMap').addEventListener('click', e => {
  const svg = e.target.closest('svg');
  if (!svg) return;
  if (pick.placing) { // neuen Punkt an die angetippte Stelle setzen
    const p = svgPt(svg, e), m = { id: uid(), icon: pick.placing, name: $('#newPointName').value.trim() || 'Punkt', x: Math.round(p.x), y: Math.round(p.y) };
    pick.newMarkers.push(m); pick.markers.add(m.id); stopPlacing();
    return drawPick();
  }
  const mk = e.target.closest('[data-marker]'), zg = e.target.closest('[data-zone]');
  if (mk) { const id = mk.dataset.marker; pick.markers.has(id) ? pick.markers.delete(id) : pick.markers.add(id); }
  else if (zg) {
    const id = zg.dataset.zone;
    if (form.elements.type.value === 'zone') form.elements.zoneId.value = id; // Putzaufgabe: genau ein Bereich
    else pick.zones.has(id) ? pick.zones.delete(id) : pick.zones.add(id);
  }
  drawPick();
});
form.elements.zoneId.addEventListener('change', drawPick);
const setPlacing = i => {
  const old = markerIcons().find(([x]) => x === pick.placing)?.[1], name = $('#newPointName');
  if (!name.value || name.value === old) name.value = markerIcons().find(([x]) => x === i)?.[1] || '';
  $('#newPointEmoji').value = markerIcons().some(([x]) => x === i) ? '' : i; // Vorschlags-Name
  pick.placing = i;
  $('#newPointIcons').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.picon === i));
  drawPick();
};
function stopPlacing() { pick.placing = null; $('#newPointBar').hidden = true; $('#newPointBtn').hidden = false; $('#newPointName').value = ''; $('#newPointEmoji').value = ''; }
$('#newPointBtn').onclick = () => {
  $('#newPointIcons').innerHTML = markerIcons().map(([i, n]) => `<button type="button" data-picon="${esc(i)}" title="${esc(n)}">${glyph(i)}</button>`).join('');
  $('#newPointBar').hidden = false; $('#newPointBtn').hidden = true; setPlacing(MARKER_ICONS[0][0]);
};
$('#newPointEmoji').addEventListener('input', e => { const v = e.target.value.trim(); if (v) { pick.placing = v; $('#newPointIcons').querySelectorAll('button').forEach(b => b.classList.remove('active')); drawPick(); } });
$('#newPointIcons').onclick = e => { const b = e.target.closest('[data-picon]'); if (b) setPlacing(b.dataset.picon); };
$('#newPointCancel').onclick = () => { stopPlacing(); drawPick(); };
form.elements.type.onchange = showTypeFields;

// Icon-Auswahl im Dialog; solange nicht selbst gewählt, schlägt der Titel ein Icon vor
let iconTouched = false;
$('#taskIcons').innerHTML = '<button type="button" data-ticon="" title="Kein Icon">–</button>' +
  TASK_ICONS.map(([i, n]) => `<button type="button" data-ticon="${i}" title="${n}">${glyph(i)}</button>`).join('');
function setTaskIcon(i) {
  form.elements.icon.value = i;
  form.querySelectorAll('[data-ticon]').forEach(b => b.classList.toggle('active', b.dataset.ticon === i));
  $('#taskIconName').textContent = TASK_ICONS.find(([x]) => x === i)?.[1] || 'kein Icon';
}
$('#taskIcons').onclick = e => { const b = e.target.closest('[data-ticon]'); if (b) { iconTouched = true; setTaskIcon(b.dataset.ticon); } };
form.elements.title.addEventListener('input', () => { if (!iconTouched) setTaskIcon(guessIcon(form.elements.title.value) || ''); });

function openTask(id) {
  editing = db.tasks.find(t => t.id === id) || null;
  const t = editing || { type: 'schicht', shift: ui.shift, everyDays: 14, startDate: today() };
  form.elements.zoneId.innerHTML = db.zones.map(z => `<option value="${z.id}">${esc(z.name)}</option>`).join('');
  for (const f of ['title', 'type', 'shift', 'time', 'from', 'to', 'everyDays', 'startDate', 'zoneId'])
    form.elements[f].value = t[f] ?? (f === 'zoneId' ? db.zones[0]?.id ?? '' : f === 'startDate' ? today() : f === 'everyDays' ? 14 : '');
  pick.rules = editing?.markerRules || [];
  Object.assign(pick, { zones: new Set(t.zoneIds || []), markers: new Set(editing ? taskMarkers(editing).map(m => m.id) : []), newMarkers: [] });
  stopPlacing();
  form.elements.hourly.checked = !!t.hourly;
  form.elements.days.value = t.days || '';
  iconTouched = !!editing; setTaskIcon(t.icon || '');
  $('#taskDlgTitle').textContent = editing ? 'Aufgabe bearbeiten' : 'Neue Aufgabe';
  showTypeFields();
  $('#taskDlg').showModal();
}

form.onsubmit = e => {
  if (e.submitter?.value === 'cancel') return;
  const f = Object.fromEntries(new FormData(form));
  const t = { id: editing?.id || uid(), type: f.type, title: f.title.trim(), ...(f.icon && { icon: f.icon }), ...(f.type !== 'intervall' && f.days && { days: f.days }) };
  if (f.type === 'schicht') {
    if (f.from && f.to && f.from >= f.to) { e.preventDefault(); return alert('„von" muss vor „bis" liegen.'); }
    if (f.hourly) t.hourly = true;
    Object.assign(t, { shift: f.shift, time: f.time || undefined, from: f.time ? undefined : f.from || undefined, to: f.time ? undefined : f.to || undefined });
  } else if (f.type === 'intervall') Object.assign(t, { everyDays: Math.max(1, +f.everyDays || 1), startDate: f.startDate || today() });
  else t.zoneId = f.zoneId;
  if (f.type !== 'zone' && pick.zones.size) t.zoneIds = [...pick.zones];
  const added = pick.newMarkers.filter(m => pick.markers.has(m.id));
  db.markers.push(...added); rememberIcons(added); // neu gesetzte Punkte erst beim Speichern übernehmen
  // Regel behalten, solange alle ihre Punkte noch gewählt sind; Rest als feste Punkte
  const rules = pick.rules.filter(k => db.markers.filter(MARKER_RULES[k].match).every(m => pick.markers.has(m.id)));
  if (rules.length) t.markerRules = rules;
  const fixed = [...pick.markers].filter(id => !rules.some(k => MARKER_RULES[k].match(db.markers.find(m => m.id === id))));
  if (fixed.length) t.markerIds = fixed;
  // Intervall/Startdatum geändert -> Periodenschlüssel verschieben sich, alte Häkchen gelten nicht mehr; ist gewollt.
  const i = db.tasks.findIndex(x => x.id === t.id);
  if (i >= 0) db.tasks[i] = t; else db.tasks.push(t);
  save(); render();
};

// --- Gemeinsame Daten über Supabase (Theken-PC, Chef zu Hause …) ---
// Aufgaben/Layout/Punkte = ein Dokument „studio“ (nur Admins schreiben), Häkchen = einzelne Zeilen „done“ (alle Angemeldeten).
// Der Browser-Speicher bleibt als Zwischenspeicher, damit die App sofort etwas zeigt.
const SB_URL = 'https://lbnmpuatinalptvoqpyp.supabase.co', SB_KEY = 'sb_publishable_MqttaU1uP5kVuzPahOowJw_EMik8yID'; // öffentlich gedacht, Schutz über RLS
const STUDIO_ID = 'europaplatz';
const sb = supabase.createClient(SB_URL, SB_KEY); // Konto dieses Geräts (Theke oder Admin zu Hause), bleibt angemeldet
// Admin an der Theke: zweite Anmeldung nur im Arbeitsspeicher – das Theke-Konto bleibt angemeldet
const sbAdmin = supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: false, storageKey: 'sb-admin' } });
const cloud = { ready: false, isAdmin: false, admin: null, config: '', done: {} }; // admin = Verbindung mit Schreibrecht für Aufgaben
const CONFIG_KEYS = ['tasks', 'zones', 'markers', 'layouts', 'customIcons', 'holidays'];
const configJson = () => JSON.stringify(Object.fromEntries(CONFIG_KEYS.map(k => [k, db[k]])));
// Häkchen + „Mittelschicht heute“ als Zeilen der Tabelle done
const doneRows = () => ({ ...db.done, ...Object.fromEntries(Object.entries(db.mittelDays).filter(([, v]) => v)
  .map(([d, v]) => ['mittel|' + d, typeof v === 'string' ? v : new Date(0).toISOString()])) });
const chunks = (a, n = 200) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

function cloudBar(msg) { const b = $('#cloudBar'); b.hidden = !msg; b.textContent = msg; }
const isAdminEmail = async (client, email) =>
  !!(await client.from('admins').select('email').eq('email', email.toLowerCase()).maybeSingle()).data;

let syncing = Promise.resolve();
const sync = () => { syncing = syncing.then(pushChanges).catch(e => cloudBar('⚠ Nicht gespeichert – keine Verbindung zur Datenbank. Wird beim nächsten Speichern erneut versucht. (' + (e.message || e) + ')')); };
async function pushChanges() {
  if (!cloud.ready) return;
  const cfg = configJson();
  if (cfg !== cloud.config && cloud.admin) { // Nicht-Admins ändern keine Aufgaben; Ansichts-Einstellungen bleiben lokal
    const { error } = await cloud.admin.from('studio').upsert({ id: STUDIO_ID, data: JSON.parse(cfg), updated_at: new Date().toISOString() });
    if (error) throw error;
    cloud.config = cfg;
  }
  const now = doneRows();
  const add = Object.entries(now).filter(([k, v]) => cloud.done[k] !== v), del = Object.keys(cloud.done).filter(k => !(k in now));
  for (const part of chunks(add)) { const { error } = await sb.from('done').upsert(part.map(([key, done_at]) => ({ key, done_at }))); if (error) throw error; }
  for (const part of chunks(del)) { const { error } = await sb.from('done').delete().in('key', part); if (error) throw error; }
  cloud.done = now;
  cloudBar('');
}
// Lädt Aufgaben + Häkchen der letzten 2 Tage (+ Intervall-Häkchen). Ältere Häkchen bleiben in der Datenbank, werden aber nicht gebraucht.
async function cloudLoad() {
  const since = new Date(Date.now() - 2 * 864e5).toISOString();
  const [st, recent, intervals, backups] = await Promise.all([
    sb.from('studio').select('data').eq('id', STUDIO_ID).maybeSingle(),
    sb.from('done').select('key,done_at').gte('done_at', since).limit(5000),
    sb.from('done').select('key,done_at').like('key', '%|p%').limit(5000),
    sb.from('done').select('key,done_at').like('key', 'backup|%').limit(500),
  ]);
  const err = st.error || recent.error || intervals.error || backups.error;
  if (err) throw err;
  if (st.data) Object.assign(db, st.data.data);
  else if (cloud.admin) cloudBar('Noch keine Daten in der Datenbank – sie werden jetzt von diesem Gerät hochgeladen.');
  else return cloudBar('Noch keine Aufgaben in der Datenbank. Ein Admin muss sich einmal anmelden.');
  db.done = {}; db.mittelDays = {};
  for (const r of [...recent.data, ...intervals.data, ...backups.data])
    if (r.key.startsWith('mittel|')) db.mittelDays[r.key.slice(7)] = r.done_at; else db.done[r.key] = r.done_at;
  normalize();
  cloud.config = st.data ? configJson() : ''; // leer → erster Speichervorgang lädt alles hoch
  cloud.done = doneRows();
  localStorage.setItem(KEY, JSON.stringify(db));
}
// Änderungen anderer Geräte übernehmen (Live + jede Minute als Sicherheitsnetz)
const quiet = () => !document.querySelector('dialog[open]') && ui.tab !== 'admin' && ui.tab !== 'layout' && !drag;
let refreshTimer;
function refresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    await syncing;
    try { await cloudLoad(); if (quiet()) render(); } catch (e) { cloudBar('⚠ Keine Verbindung zur Datenbank – zeige den letzten Stand.'); }
  }, 300);
}

async function afterLogin(user) {
  $('#loginScreen').hidden = true;
  cloud.email = user.email;
  cloud.isAdmin = await isAdminEmail(sb, user.email);
  cloud.admin = cloud.isAdmin ? sb : null;
  try { await cloudLoad(); } catch (e) { cloudBar('⚠ Keine Verbindung zur Datenbank – zeige den letzten Stand dieses Geräts.'); }
  cloud.ready = true;
  sync(); // falls die Datenbank noch leer war: hochladen
  sb.channel('studio-check')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'studio' }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'done' }, refresh)
    .subscribe();
  render();
  checkBackup();
}
$('#loginForm').onsubmit = async e => {
  e.preventDefault();
  const f = e.target.elements;
  $('#loginErr').textContent = '';
  const { data, error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
  if (error) return $('#loginErr').textContent = 'Anmeldung fehlgeschlagen – E-Mail oder Passwort falsch.';
  afterLogin(data.user);
};
async function start() {
  const { data } = await sb.auth.getSession();
  if (data.session) afterLogin(data.session.user); else $('#loginScreen').hidden = false;
}

// Uhr + Ansicht minütlich auffrischen (überfällig-Status, Tageswechsel) und Stand aus der Datenbank holen
const tick = () => { $('#clock').textContent = new Date().toLocaleString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
setInterval(() => { tick(); if (cloud.ready) { refresh(); checkBackup(); } else if (quiet()) render(); }, 60000);
tick(); render(); start();
