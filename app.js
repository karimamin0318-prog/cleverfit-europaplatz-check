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
// Eingabe 00:15 gehört zum Arbeitstag davor → 24:15 (Vergleiche/Sortierung); Gegenstück zur Anzeige hm()
const bizTime = v => v && +v.slice(0, 2) < DAY_START_H ? String(+v.slice(0, 2) + 24) + v.slice(2) : v;
console.assert(bizTime('00:15') === '24:15' && bizTime('03:59') === '27:59' && bizTime('04:00') === '04:00' && bizTime('') === '');
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
// Tage seit fällig: ab der ersten nicht erledigten Periode – eine verpasste Periode wird nicht „vergessen“
function dueSince(t, day = today()) {
  const p = period(t, day), done = Object.keys(db.done).filter(k => k.startsWith(t.id + '|p')).map(k => +k.slice(t.id.length + 2)).filter(n => n <= p);
  const first = Math.min(done.length ? Math.max(...done) + 1 : 0, p);
  return dayNum(day) - (dayNum(t.startDate) + first * t.everyDays);
}
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
  '⚠': '<path d="M12 3.5 2.5 20h19zM12 10v4.5M12 17.5v.01"/>',
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
const CHEF_HOURLY = [ // stündlich über die ganze Öffnungszeit, ein Häkchen pro Stunde für alle Schichten
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
  for (const [title, zoneIds] of CHEF_HOURLY)
    out.push({ id: uid(), type: 'schicht', title, icon: guessIcon(title), ...rulesOf(title), shift: 'frueh', hourly: true, ...(zoneIds.length && { zoneIds }) });
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
// früher je Schicht eine Kopie jedes stündlichen Checks mit eigenem Häkchen → dieselbe Stunde kam wieder; nur die erste bleibt
const seen = new Set();
db.tasks = db.tasks.filter(t => !t.hourly || !seen.has(t.title) && seen.add(t.title));
}
normalize();
{ // Selbsttest dueSince: verpasste Periode zählt weiter
  const keep = db.done, t = { id: 'T', everyDays: 14, startDate: '2026-10-01' };
  db.done = { 'T|p0': 'x' };
  console.assert(dueSince(t, '2026-10-20') === 5 && dueSince(t, '2026-10-30') === 15, 'dueSince');
  db.done = keep;
}

const ui = { tab: 'dashboard', admin: false, shift: currentShift(), zone: null, pick: null, doneOpen: false, showMarkers: false };
const $ = s => document.querySelector(s);

function currentShift() {
  const t = nowHM();
  return t >= SHIFTS.spaet.from ? 'spaet' : t >= SHIFTS.mittel.from && mittelActive() ? 'mittel' : 'frueh';
}

const doneAt = t => db.done[t.id + '|' + periodKey(t)];
// Aufgabe antippen: ist sie gerade auf der Karte → ausblenden (ganzer Raum), sonst ihren Ort zeigen
function pickTask(id) {
  const shown = !ui.hideMap && (ui.pick || document.querySelector('.strip.next')?.dataset.pick);
  if (id === 'next') Object.assign(ui, { pick: null, hideMap: false });
  else if (id === shown) Object.assign(ui, { pick: null, hideMap: true });
  else Object.assign(ui, { pick: id, hideMap: false });
  render();
}
// Animationen: einmal abspielen (Klasse neu setzen); bei „weniger Bewegung“ im System aus
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const replay = (el, cls) => { if (!el || reduceMotion()) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
toggle.pending = new Set();
function toggle(id) {
  const t = db.tasks.find(x => x.id === id);
  const k = t.id + '|' + periodKey(t);
  const commit = () => {
    if (db.done[k]) delete db.done[k]; else db.done[k] = new Date().toISOString();
    ui.pick = null; ui.hideMap = false; // nach dem Abhaken weiter mit der nächsten Aufgabe
    save(); render();
    if (ui.tab === 'dashboard') replay($('.map.board'), 'hl-in'); // nächster Ort wird rot eingeblendet
  };
  const rows = [...document.querySelectorAll(`[data-toggle="${CSS.escape(id)}"]`)].map(b => b.closest('.strip, .task, .sign')).filter(Boolean);
  if (reduceMotion() || !rows.length) return commit();
  if (toggle.pending.has(id)) return; // läuft schon (auch wenn die Liste inzwischen neu gezeichnet wurde)
  toggle.pending.add(id);
  rows.forEach(r => r.classList.add(db.done[k] ? 'unchecking' : 'checking')); // Wieder öffnen = dieselbe Animation rückwärts
  if (!db.done[k] && ui.tab === 'dashboard') { // Karte: Bereiche/Punkte der Aufgabe werden grün
    taskZones(t).forEach(z => $(`.map.board .zone[data-zone="${CSS.escape(z)}"]`)?.classList.add('cleared'));
    taskMarkers(t).forEach(m => $(`.map.board .marker[data-marker="${CSS.escape(m.id)}"]`)?.classList.add('cleared'));
  }
  setTimeout(() => { toggle.pending.delete(id); commit(); }, 520); // Haken + grüner Strich sichtbar, dann rutscht die Aufgabe weg
}
const timeOf = t => new Date(t).toTimeString().slice(0, 5);

function taskRow(t, meta, overdue = false) {
  const d = doneAt(t);
  return `<div class="task ${d ? 'done' : overdue ? 'overdue' : ''}" data-toggle="${t.id}" role="checkbox" aria-checked="${!!d}" tabindex="0">
    <div class="check">${d ? '✓' : ''}</div>
    ${iconChip(t)}<div class="body"><div class="title"><span class="tx">${esc(t.title)}</span></div>
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
  return `<g class="zone ${sel ? 'sel' : ''} ${hl ? 'hl' : ''} ${green ? 'green' : ''}" data-zone="${z.id}" tabindex="0" role="button" aria-label="${esc(z.name)}" style="--fill:${fill};--txt:${isLight(fill) ? '#111' : '#fff'}">
    <title>${esc(z.name)}</title>${z.rects.map(([x, y, w, h], i) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" data-piece="${i}" class="${i === piece ? 'cur' : ''}"/>`).join('')}
    ${svgLabel(z.rects[0], (done || green ? '✓ ' : '') + (z.label || z.name))}${z.rects.slice(1).filter(r => r[4]).map(r => svgLabel(r, r[4])).join('')}</g>`;
}
// Punkt (Mülltonne, Wasserspender …): Kreis mit Symbol, Name darunter
function markerSvg(m, { hl = false, sel = false } = {}) {
  return `<g class="marker ${hl ? 'hl' : ''} ${sel ? 'sel' : ''}" data-marker="${m.id}" transform="translate(${m.x} ${m.y})">
    <title>${esc(m.name)}</title><circle class="hit" r="19"/>${hl ? '<rect class="pulse" x="-13" y="-13" width="26" height="26" rx="2"/>' : ''}<rect class="plate" x="-13" y="-13" width="26" height="26" rx="2"/>
    ${glyphOf(m.icon) ? glyph(m.icon, 'x="-8.5" y="-8.5" width="17" height="17"') : `<text class="ico" font-size="12">${esc(m.icon || '•')}</text>`}</g>`; // nur Icon, Name als Tooltip
}
const MARKER_ICONS = [['🗑️', 'Mülltonne'], ['💧', 'Getränkebar'], ['🥤', 'Bodyshake'], ['☕', 'Kaffeeautomat'], ['📱', 'Studio-Tablet'],
  ['💡', 'Lichtschalter'], ['📺', 'Fernseher'], ['🪟', 'Fenster'], ['🧴', 'Desinfektion'], ['🧻', 'Papierspender'], ['🧹', 'Putzmittel'],
  ['🧯', 'Feuerlöscher'], ['🔌', 'Steckdose'], ['📦', 'Kiste'], ['🚪', 'Tür'], ['❄️', 'Kühlschrank'], ['📍', 'Sonstiges']];
console.assert(MARKER_ICONS.every(([i]) => glyphOf(i)));
const inRect = (m, [x, y, w, h]) => m.x >= x && m.x <= x + w && m.y >= y && m.y <= y + h;
const markerZone = m => db.zones.find(z => z.rects.some(r => inRect(m, r)))?.id;
function mapSvg(cls, inner) { // gemeinsamer Rahmen für Dashboard- und Putzplan-Karte
  const [vx, vy, vw, vh] = fitView(db.zones);
  return `<svg class="map ${cls}" viewBox="${vx} ${vy} ${vw} ${vh}" role="group" aria-label="Studio-Karte"><defs>${HL_FILTER}</defs>
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
const nextHour = () => String(+nowHM().slice(0, 2) + 1).padStart(2, '0') + ':00';
const whenText = t => t.hourly ? `stündlich · bis ${hm(nextHour())}` : t.time ? `${hm(t.time)} Uhr` : t.from ? `${hm(t.from)}–${hm(t.to)} Uhr` : '';
// überfällig: Uhrzeit/Fensterende vorbei; stündliche nie (sie kommen jede Stunde neu)
const isOverdue = t => !t.hourly && !doneAt(t) && !!(t.to || t.time) && nowHM() > (t.to || t.time);
// Stündliche Aufgaben laufen über die ganze Öffnungszeit, egal welche Schicht gerade ist
const hourlyActive = () => { const o = SHIFT_TIMES[dayType()], n = nowHM(); return n >= o.frueh[0] && n < o.spaet[1]; };
const todayTasks = () => db.tasks.filter(t => dayOk(t) && (t.hourly ? hourlyActive(t) : t.type !== 'intervall' || period(t) >= 0 && (!doneAt(t) || isToday(doneAt(t)))));
// Intervall = wichtig, kommt zuerst; sonst Uhrzeit, Zeitfenster-Beginn oder Schichtbeginn
const sortKey = t => t.type === 'intervall' ? '' : t.hourly ? nowHM().slice(0, 2) + ':00' : t.time || t.from || SHIFTS[taskShift(t)]?.from || '99:99';
const endKey = t => t.to || t.time || '99:99';
const byTime = (a, b) => sortKey(a).localeCompare(sortKey(b)) || endKey(a).localeCompare(endKey(b)) || (a.type === 'zone') - (b.type === 'zone') || db.tasks.indexOf(a) - db.tasks.indexOf(b); // gleiche Zeit: Reihenfolge wie eingetragen
// Umriss um die ganze (auch L-förmige) Fläche, ohne innere Linien
const HL_FILTER = `<filter id="hlOutline" x="-20%" y="-20%" width="140%" height="140%"><feMorphology in="SourceAlpha" operator="dilate" radius="4" result="d"/>
  <feFlood class="hl-flood" flood-color="#111"/><feComposite in2="d" operator="in" result="o"/><feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;

const placeNames = t => [...new Set(taskMarkers(t).map(m => m.name)), ...(t.type === 'zone' ? [t.zoneId] : t.zoneIds || []).map(id => db.zones.find(z => z.id === id)?.name)].filter(Boolean);
function dashRow(t, isNext = false) {
  const d = doneAt(t), s = taskShift(t);
  const since = t.type === 'intervall' ? dueSince(t) : 0;
  const over = t.type === 'intervall' ? !d && since > 0 : isOverdue(t);
  const when = t.type === 'intervall' ? 'Intervall' : t.hourly ? 'Stündl.' : hm(t.time || t.from || SHIFTS[s]?.from || '') || '–';
  const stripe = t.type === 'intervall' ? 'var(--red)' : SHIFTS[s]?.color || 'transparent';
  const late = over ? `<em class="sp-late">${since > 0 ? `überfällig seit ${since} T.` : 'überfällig'}</em>` : '';
  return `<div class="strip ${d ? 'done' : ''} ${ui.pick === t.id ? 'picked' : ''} ${isNext ? 'next' : ''}" data-pick="${t.id}" tabindex="0" role="button" aria-pressed="${ui.pick === t.id}" style="--stripe:${stripe}">
    <span class="sp-tm ${/\d/.test(when) ? '' : 'txt'}">${when}</span><span class="sp-ti"><span class="tx">${esc(t.title)}</span>${late}</span>
    <span class="sp-pl">${d ? `✓ ${timeOf(d)}` : esc(placeNames(t).join(' · '))}</span>
    <button class="check" data-toggle="${t.id}" aria-label="${d ? 'Wieder öffnen' : 'Erledigt'}">${d ? '✓' : ''}</button></div>`;
}

// Stundenleiste: laufende Schicht als Zeitachse, Aufgaben als Striche, rote Jetzt-Marke
const mins = s => +s.slice(0, 2) * 60 + +s.slice(3, 5);
function hourBar(list) {
  const sh = SHIFTS[currentShift()], a = mins(sh.from), b = mins(sh.to);
  const pos = m => Math.max(0, Math.min(100, (m - a) / (b - a) * 100));
  const inShift = list.filter(t => t.type !== 'intervall' && sortKey(t) >= sh.from && sortKey(t) < sh.to);
  const next = inShift.find(t => !doneAt(t)), same = {};
  const d = today(), type = dayType(d), hol = holidayName(d);
  const label = type === 'wt' ? 'Werktag' : hol ? `Feiertag · ${hol}` : 'Wochenende';
  const mittel = type === 'we' ? `<button class="btn small ${mittelActive() ? '' : 'ghost'}" data-mittel>Mittelschicht heute: ${mittelActive() ? 'ja' : 'nein'}</button>` : '';
  const hours = []; for (let m = Math.ceil(a / 60) * 60; m <= b; m += 60) hours.push(m);
  const now = pos(mins(nowHM()));
  return `<div class="hourbar"><div class="hb-day"><b>${new Date(d + 'T12:00').toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long' })}</b>
      <span>${label} · ${sh.name} ${hm(sh.from).slice(0, 2)}–${hm(sh.to).slice(0, 2)}</span></div>
    <div class="hb-track" aria-hidden="true"><i class="hb-fill" style="width:${now}%"></i>
      ${inShift.map(t => { const k = sortKey(t), n = same[k] = (same[k] ?? -1) + 1; // gleiche Uhrzeit: Striche leicht versetzt
        return `<i class="hb-tick ${doneAt(t) ? 'd' : t === next ? 'n' : ''}" style="left:${pos(mins(k)) + n * .7}%"></i>`; }).join('')}
      <i class="hb-now" style="left:${now}%"><span>Jetzt ${hm(nowHM())}</span></i>
      ${hours.map(m => `<em style="left:${pos(m)}%">${hm(String(m / 60).padStart(2, '0') + ':00').slice(0, 2)}</em>`).join('')}</div>
    <div class="hb-score"><b>${inShift.filter(doneAt).length}</b>/${inShift.length} erledigt</div>${mittel}</div>`;
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

// Zeitfenster-Regler in der Verwaltung: Aufgaben nach Uhrzeit filtern (Öffnung bis Schluss, Werktags-Schichten als Farben)
const TR = { min: mins(SHIFT_TIMES.wt.frueh[0]), max: mins(SHIFT_TIMES.wt.spaet[1]), step: 15, minLen: 30 };
// Zeitfenster einer Aufgabe in Minuten; ohne Uhrzeit: ihre Schicht; Intervall-Aufgaben haben keine Uhrzeit → immer sichtbar
function taskWin(t) {
  if (t.type === 'intervall') return [-1, 1e4];
  const s = SHIFT_TIMES.wt[taskShift(t)], a = t.time || t.from || s?.[0], b = t.to || t.time || s?.[1];
  return a ? [mins(a), mins(b)] : [-1, 1e4];
}
const trPct = m => (m - TR.min) / (TR.max - TR.min) * 100;
const trHM = m => hm(String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'));
function timeRange() {
  const [a, b] = ui.range ??= [TR.min, TR.max];
  const hours = []; for (let m = TR.min; m <= TR.max; m += 60) hours.push(m);
  return `<div class="tr" id="tr"><div class="tr-shifts">${Object.entries(SHIFT_TIMES.wt).map(([k, [f, e]]) =>
      `<button type="button" data-trshift="${k}" style="left:${trPct(mins(f))}%;width:${trPct(mins(e)) - trPct(mins(f))}%;--c:${SHIFTS[k].color}">${SHIFTS[k].name.replace('schicht', '')}</button>`).join('')}</div>
    <div class="tr-track">${Object.entries(SHIFT_TIMES.wt).map(([k, [f, e]]) => `<i style="left:${trPct(mins(f))}%;width:${trPct(mins(e)) - trPct(mins(f))}%;background:${SHIFTS[k].color}"></i>`).join('')}
      <div class="tr-win" style="left:${trPct(a)}%;width:${trPct(b) - trPct(a)}%"><b class="tr-h" data-h="l"></b><b class="tr-h" data-h="r"></b></div></div>
    <div class="tr-ticks">${hours.map(m => `<em style="left:${trPct(m)}%">${trHM(m).slice(0, 2)}</em>`).join('')}</div>
    <span class="tr-label"></span></div>`;
}
// Ausgewählte Zeit anwenden ohne Neuzeichnen (läuft bei jedem Ziehen)
// Überschneidung: ein Fenster, das genau am Anfang endet, zählt nicht
function applyRange() {
  const [a, b] = ui.range, tr = $('#tr'), all = a === TR.min && b === TR.max; if (!tr) return;
  Object.assign(tr.querySelector('.tr-win').style, { left: trPct(a) + '%', width: trPct(b) - trPct(a) + '%' });
  let n = 0; const rows = document.querySelectorAll('tr[data-win]');
  rows.forEach(r => { const [f, e] = r.dataset.win.split(',').map(Number), on = all || (f === e ? f >= a && f < b : e > a && f < b); r.hidden = !on; n += on; });
  tr.querySelectorAll('[data-trshift]').forEach(x => { const [f, e] = SHIFT_TIMES.wt[x.dataset.trshift].map(mins); x.classList.toggle('on', f === a && e === b); });
  tr.querySelector('.tr-label').textContent = `${trHM(a)}–${trHM(b)} · ${n} von ${rows.length}`;
}
{ // Ziehen: Ränder ändern die Länge, die Mitte verschiebt das Fenster, Schicht antippen = genau diese Schicht
  let drag = null;
  const at = (tr, x) => { const r = tr.querySelector('.tr-track').getBoundingClientRect(); return TR.min + (x - r.left) / r.width * (TR.max - TR.min); };
  const snap = m => Math.round(m / TR.step) * TR.step, clamp = (m, lo, hi) => Math.max(lo, Math.min(hi, m));
  document.addEventListener('pointerdown', e => {
    const tr = e.target.closest('#tr'); if (!tr) return;
    const sh = e.target.closest('[data-trshift]');
    if (sh) { ui.range = SHIFT_TIMES.wt[sh.dataset.trshift].map(mins); return applyRange(); }
    const h = e.target.closest('[data-h]')?.dataset.h, [a, b] = ui.range;
    if (!h && !e.target.closest('.tr-win')) {
      if (!e.target.closest('.tr-track')) return; // daneben in die Leiste getippt: Fenster dorthin schieben
      const len = b - a, c = snap(at(tr, e.clientX) - len / 2); ui.range = [clamp(c, TR.min, TR.max - len), clamp(c, TR.min, TR.max - len) + len]; applyRange();
    }
    drag = { tr, h, x0: at(tr, e.clientX), r0: [...ui.range] };
    tr.setPointerCapture(e.pointerId); e.preventDefault();
  });
  document.addEventListener('pointermove', e => {
    if (!drag) return;
    const d = at(drag.tr, e.clientX) - drag.x0, [a, b] = drag.r0;
    if (drag.h === 'l') ui.range = [clamp(snap(a + d), TR.min, b - TR.minLen), b];
    else if (drag.h === 'r') ui.range = [a, clamp(snap(b + d), a + TR.minLen, TR.max)];
    else { const s = clamp(snap(a + d), TR.min, TR.max - (b - a)); ui.range = [s, s + b - a]; }
    applyRange();
  });
  document.addEventListener('pointerup', () => { drag = null; });
}

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
    const map = mapSvg(`board ${hl.size || pm.size ? 'focus' : ''}`, db.zones.map(z => zoneSvg(z, { green: zoneDone(z), hl: hl.has(z.id), sel: ui.zone === z.id })).join('')
      + db.markers.filter(m => ui.showMarkers || pm.has(m.id)).map(m => markerSvg(m, { hl: pm.has(m.id) })).join(''));
    const hint = ui.hideMap ? 'Ganzer Raum sichtbar. Aufgabe antippen = Ort zeigen.'
      : !pick ? 'Bereich antippen = links nur seine Aufgaben.'
      : `${auto ? '' : '<b>' + esc(pick.title) + '</b> – '}${hl.size || pm.size ? 'Rot = hier zu tun.' : 'Diese Aufgabe hat keinen festen Ort.'}`
        + (ui.pick ? ' <button class="btn small ghost" data-pick="next">Zurück zur nächsten</button>' : '');
    const empty = zone ? (shown.length ? 'Alles erledigt in diesem Bereich' : 'Heute nichts in diesem Bereich') : 'Alles erledigt für heute';
    // Rote Tafel: die nächste Aufgabe (sonst eine fällige Intervall-Aufgabe), mit ihrem Symbol wie ein Schild
    const cur = next || imp[0], places = cur && placeNames(cur).join(' · ');
    const sign = cur ? `<div class="sign ${isOverdue(cur) ? 'late' : ''}"><div class="sg-txt">
        <span class="sg-k">${zone ? esc(zone.name) + ' · ' : ''}${cur === next ? 'Als Nächstes' : 'Intervall fällig'}${whenText(cur) ? ' · ' + whenText(cur) : ''}${isOverdue(cur) ? ' · überfällig' : ''}</span>
        <h2>${esc(cur.title)}</h2>${places ? `<span class="sg-w">→ ${esc(places)}</span>` : ''}</div>
        <button class="sg-done" data-toggle="${cur.id}">Erledigt</button>
        <span class="sg-ico" aria-hidden="true">${cur.icon ? glyph(cur.icon) : '<svg class="glyph" viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6"/></svg>'}</span></div>`
      : `<div class="sign ok"><div class="sg-txt"><span class="sg-k">${zone ? esc(zone.name) : 'Heute'}</span><h2>${empty}</h2></div><span class="sg-ico" aria-hidden="true">✓</span></div>`;
    const pct = shown.length ? done.length / shown.length * 100 : 0;
    return `${hourBar(list)}<div class="board">
      <div class="b-sign">${sign}</div>
      <div class="b-stats">
        <div class="pane"><span class="pane-k">Fortschritt</span><b class="big">${done.length}/${shown.length}</b>
          <span class="pane-k">${zone ? esc(zone.name) : 'heute erledigt'}</span><div class="progress"><div style="width:${pct}%"></div></div></div>
        <div class="pane ${imp.length ? 'imp' : ''}"><span class="pane-k">Intervall</span>${imp.length
          ? `<b class="imp-t">${esc(imp[0].title)}</b><span class="pane-k">${imp.length > 1 ? `+ ${imp.length - 1} weitere · ` : ''}heute fällig</span>`
          : '<b class="imp-t muted">Nichts fällig</b>'}</div></div>
      <section class="b-list">${zone ? `<div class="list-head"><button class="btn small ghost" data-zone="${zone.id}">← Alle To-dos</button><b>${esc(zone.name)}</b></div>` : ''}
        <div class="list">${[...imp, ...todo].map(t => dashRow(t, t === next)).join('') || `<div class="empty">${empty}</div>`}</div>
        <details class="done-box" ${ui.doneOpen ? 'open' : ''}><summary>Erledigt (${done.length})</summary>
          <div class="list">${done.map(t => dashRow(t)).join('') || '<div class="empty">Noch nichts erledigt.</div>'}</div></details></section>
      <section class="pane b-map"><div class="pane-h"><span class="pane-k">Übersichtsplan</span><span class="grow"></span>${markerToggle()}</div>
        <div class="map-fill">${map}</div><p class="hint">${hint}</p></section></div>`;
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
      const due = dueSince(t);
      const status = doneAt(t) ? `nächste in ${next} Tag${next === 1 ? '' : 'en'}`
        : due === 0 ? '<span class="badge red">fällig heute</span>'
        : `<span class="badge red">überfällig seit ${due} Tag${due === 1 ? '' : 'en'}</span>`;
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
    return `<div class="row ed-bar"><h2>Putzplan</h2><span class="grow"></span>${markerToggle()}${colorToggle()}</div>
      <div class="pp"><aside class="pane pp-legend"><span class="pane-k">Legende</span><div class="legend">${legend}</div></aside>
        <div class="pane pp-map"><div class="map-fill">${map}</div></div><div class="pp-detail">${detail}</div></div>`;
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
    const stripeOf = t => t.type === 'intervall' ? 'var(--red)' : SHIFTS[taskShift(t)]?.color || 'transparent';
    const tasks = [...db.tasks].sort((a, b) => order[a.type] - order[b.type]).map(t => `<tr style="--stripe:${stripeOf(t)}" data-win="${taskWin(t)}"><td>${iconChip(t)}<b>${esc(t.title)}</b><div class="meta">${where(t)}${ortOf(t)}</div></td>
      <td><button class="btn small ghost" data-edit="${t.id}">Bearbeiten</button> <button class="btn small ghost" data-del="${t.id}">Löschen</button></td></tr>`).join('');
    const zones = db.zones.map(z => `<tr><td><input data-zname="${z.id}" value="${esc(z.name)}"></td>
      <td><select data-zshift="${z.id}">${shiftOpts(z.shift)}</select></td></tr>`).join('');
    return `<div class="page-head"><h2>Verwaltung</h2><button class="btn" data-edit="">+ Neue Aufgabe</button></div>
      ${dataSection()}
      <div class="admin-sec"><div class="tasks-head"><h3>Aufgaben</h3>${timeRange()}</div><table>${tasks}</table></div>
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
// Bedien-Symbole im gleichen Linienstil wie die Seitenleiste
const UI_ICON = Object.fromEntries(Object.entries({
  download: '<path d="M12 3.5v11M7.5 10 12 14.5l4.5-4.5M4.5 19.5h15"/>',
  upload: '<path d="M12 14.5v-11M7.5 8 12 3.5 16.5 8M4.5 19.5h15"/>',
  file: '<path d="M6 3.5h7.5l4.5 4.5v12.5H6z"/><path d="M13.5 3.5V8H18"/>',
  share: '<circle cx="17.5" cy="6" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="18" r="2.5"/><path d="m8.7 10.8 6.6-3.6M8.7 13.2l6.6 3.6"/>',
  undo: '<path d="M9 5 4.5 9.5 9 14"/><path d="M4.5 9.5H14a5.5 5.5 0 0 1 0 11h-3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pin: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M12 9.5v5M9.5 12h5"/>',
  scale: '<path d="M4 9.5V4h5.5M20 14.5V20h-5.5M4 4l6.5 6.5M20 20l-6.5-6.5"/>',
  rotate: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3L20 9.5M20 4v5.5h-5.5"/>',
  stack: '<path d="M12 4 3.5 8.5 12 13l8.5-4.5z"/><path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5"/>',
  reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4 9.5M4 4v5.5h5.5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10.5 11v5.5M13.5 11v5.5"/>',
}).map(([k, p]) => [k, `<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`]));
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
  const undo = localStorage.getItem(BACKUP_KEY) ? `<button class="btn small ghost" data-import="undo">${UI_ICON.undo}Import rückgängig</button>` : '';
  return `<div class="admin-sec"><h3>Daten & Backup</h3>
    <p class="meta">Speichert <b>alles</b> in einer Datei: Aufgaben, Häkchen, Layout, Punkte, gespeicherte Layouts, Feiertage, eigene Emojis. Passwörter sind nicht enthalten.</p>
    <div class="data-grid">
      <div class="data-card"><span class="dc-ico">${UI_ICON.download}</span><div><h4>Exportieren</h4><p class="meta">Als Backup am PC/in der Cloud ablegen oder an ein anderes Gerät schicken.</p></div>
        <div class="dc-act"><button class="btn small" data-export="download">${UI_ICON.download}Datei herunterladen</button>
          ${canShare ? `<button class="btn small ghost" data-export="share">${UI_ICON.share}Teilen</button>` : ''}</div></div>
      <div class="data-card"><span class="dc-ico">${UI_ICON.upload}</span><div><h4>Importieren</h4><p class="meta">Backup-Datei auswählen – du siehst vorher, was drin ist.</p></div>
        <div class="dc-act"><label class="btn small ghost">${UI_ICON.file}Datei auswählen<input type="file" id="importFile" accept=".json,application/json" hidden></label>${undo}</div></div>
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
  if (!confirm(mode === 'all' ? 'Aufgaben, Layout und Punkte für ALLE Geräte durch die Datei ersetzen? (Heutige Häkchen bleiben erhalten.)' : 'Layout und Punkte für ALLE Geräte durch die aus der Datei ersetzen?')) return render();
  localStorage.setItem(BACKUP_KEY, JSON.stringify(db));
  const next = mode === 'all' ? { ...imp.data, done: { ...imp.data.done, ...db.done }, colorBy: db.colorBy }
    : { ...db, zones: imp.data.zones, markers: imp.data.markers || [], layouts: imp.data.layouts || db.layouts,
        customIcons: imp.data.customIcons || db.customIcons, colorBy: imp.data.colorBy || db.colorBy };
  if (mode === 'layout') { // Putzaufgaben ohne Bereich wären verwaist
    const ids = new Set(next.zones.map(z => z.id));
    next.tasks = next.tasks.filter(t => t.type !== 'zone' || ids.has(t.zoneId));
  }
  db = next; normalize(); save(); render(); // speichert in die Datenbank – alle Geräte sehen es sofort
}

// --- Layout-Editor (nur Admin). Arbeitet auf einer Kopie (ui.draft), erst „Speichern“ übernimmt sie. ---
Object.assign(ui, { draft: null, draftM: null, sel: null, multi: null, band: null, snap: true, grid: 10, pieceMode: false, lib: false, libMsg: '', libStudio: 'Clever Fit Europaplatz' });
const edZone = () => ui.sel?.zone && ui.draft.find(z => z.id === ui.sel.zone);
const edMarker = () => ui.sel?.marker && ui.draftM.find(m => m.id === ui.sel.marker);
const snapV = v => ui.snap ? Math.round(v / ui.grid) * ui.grid : Math.round(v);
// Mehrfachauswahl (Rahmen ziehen / Strg+Klick): ui.multi = { z: Set(Bereich-IDs), m: Set(Punkt-IDs) }
const multiCount = () => ui.multi ? ui.multi.z.size + ui.multi.m.size : 0;
function multiToggle(kind, id) {
  ui.multi ??= { z: new Set(), m: new Set() };
  if (ui.sel?.zone) ui.multi.z.add(ui.sel.zone); // bisherige Einzelauswahl kommt mit dazu
  if (ui.sel?.marker) ui.multi.m.add(ui.sel.marker);
  ui.sel = null;
  const s = ui.multi[kind]; if (s.has(id)) s.delete(id); else s.add(id);
  if (!multiCount()) ui.multi = null;
}
// Genau ein Ding ausgewählt → normale Einzelauswahl (mit Griffen und Eigenschaften)
function multiSettle() {
  if (multiCount() !== 1) return;
  const [z] = ui.multi.z, [m] = ui.multi.m;
  ui.sel = z ? { zone: z, piece: 0 } : { marker: m }; ui.multi = null;
}
// Ganze Auswahl gemeinsam verschieben, als Block in der Zeichenfläche gehalten
function groupMove(orig, dx, dy) {
  const rs = orig.zones.flatMap(([, r]) => r), ms = orig.markers.map(([, p]) => p);
  const x1 = Math.min(...rs.map(r => r[0]), ...ms.map(p => p[0])), y1 = Math.min(...rs.map(r => r[1]), ...ms.map(p => p[1]));
  const x2 = Math.max(...rs.map(r => r[0] + r[2]), ...ms.map(p => p[0])), y2 = Math.max(...rs.map(r => r[1] + r[3]), ...ms.map(p => p[1]));
  const ddx = Math.max(-x1, Math.min(ED.W - x2, snapV(x1 + dx) - x1)), ddy = Math.max(-y1, Math.min(ED.H - y2, snapV(y1 + dy) - y1));
  orig.zones.forEach(([z, r]) => z.rects.forEach((q, k) => { q[0] = r[k][0] + ddx; q[1] = r[k][1] + ddy; }));
  orig.markers.forEach(([m, [x, y]]) => { m.x = x + ddx; m.y = y + ddy; });
}
const groupOrig = () => ({ zones: ui.draft.filter(z => ui.multi.z.has(z.id)).map(z => [z, structuredClone(z.rects)]),
  markers: ui.draftM.filter(m => ui.multi.m.has(m.id)).map(m => [m, [m.x, m.y]]) });
{ // Selbsttest: Block bleibt am Rand stehen, Abstände bleiben gleich
  const z = { rects: [[10, 10, 20, 20]] }, m = { x: 50, y: 50 }, s = ui.snap; ui.snap = false;
  groupMove({ zones: [[z, [[10, 10, 20, 20]]]], markers: [[m, [50, 50]]] }, -30, 5);
  console.assert(z.rects[0][0] === 0 && m.x === 40 && m.y === 55, 'groupMove', z.rects[0], m); ui.snap = s;
}
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
  const inZ = d => ui.multi?.z.has(d.id), inM = m => ui.multi?.m.has(m.id);
  const band = ui.band ? (([x1, y1, x2, y2]) => `<rect class="band" x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}" width="${Math.abs(x2 - x1)}" height="${Math.abs(y2 - y1)}"/>`)(ui.band) : '';
  return order.map(d => zoneSvg(d, { sel: d === z, piece: d === z ? ui.sel.piece : -1 }).replace('class="zone ', inZ(d) ? 'class="zone msel ' : 'class="zone ')).join('') + handles
    + ui.draftM.map(m => markerSvg(m, { sel: m === mk || inM(m) })).join('') + all + band;
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
// Ganzes Layout 90° im Uhrzeigersinn drehen; bleibt in der Zeichenfläche (zu groß → wird verkleinert)
function rotateAll() {
  const [bx, by, w, h] = layoutBox();
  const ox = Math.max(0, Math.min(bx, ED.W - h)), oy = Math.max(0, Math.min(by, ED.H - w));
  ui.draft.forEach(z => z.rects.forEach(r => r.splice(0, 4, ox + by + h - r[1] - r[3], oy + r[0] - bx, r[3], r[2])));
  ui.draftM.forEach(m => { [m.x, m.y] = [Math.max(0, Math.min(ED.W, ox + by + h - m.y)), Math.max(0, Math.min(ED.H, oy + m.x - bx))]; });
  scaleAll(1);
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
    ${thumb(l)}<div class="lib-info"><b>${esc(l.name)}</b><span class="lib-studio">${esc(l.studio)}</span>
      <span class="meta">${fmt(l.savedAt)} · ${l.zones.length} Bereiche · ${l.markers.length} Punkte</span>${l.note ? `<span class="meta lib-note">${esc(l.note)}</span>` : ''}</div>
    <div class="lib-act"><button class="btn small ghost" data-ed="libLoad" data-val="${l.id}">${UI_ICON.download}Laden</button>
      <button class="btn small ghost icon-btn danger" data-ed="libDel" data-val="${l.id}" title="Löschen" aria-label="Löschen">${UI_ICON.trash}</button></div></div>`).join('');
  return `<div class="admin-sec ed-form lib">
    <div class="lib-head"><h3>Layouts</h3><button class="btn small ghost icon-btn" data-ed="lib" title="Schließen" aria-label="Schließen">${UI_ICON.x}</button></div>
    ${ui.libMsg ? `<p class="lib-msg">${ui.libMsg}</p>` : ''}
    <span class="lib-k">Aktuelles Layout speichern</span>
    <label>Studio<input id="libStudio" value="${esc(ui.libStudio)}"></label>
    <label>Bezeichnung<input id="libName" placeholder="z.B. Sommer-Umbau 2026"></label>
    <label>Notiz <small>optional</small><input id="libNote" placeholder="z.B. neue Cardio-Reihe"></label>
    <button class="btn lib-save" data-ed="libSave">${UI_ICON.check}In Bibliothek speichern</button>
    <span class="lib-k">Gespeichert <b>${db.layouts.length}</b></span>
    <div class="lib-list">${list || '<p class="meta">Noch keine Layouts gespeichert.</p>'}</div></div>`;
}

function edPanel() {
  if (ui.scaleMode) return scalePanel();
  if (ui.lib) return libPanel();
  if (multiCount()) return `<div class="admin-sec ed-form"><h3>Auswahl</h3>
    <p class="big-count"><b>${ui.multi.z.size}</b> Bereiche · <b>${ui.multi.m.size}</b> Punkte</p>
    <ul class="meta"><li>Ziehen oder Pfeiltasten = alles gemeinsam verschieben</li><li>Strg + Klick = hinzufügen/entfernen</li><li>Esc oder leere Fläche antippen = aufheben</li></ul>
    <div class="row"><button class="btn small ghost" data-ed="clearSel">Auswahl aufheben</button></div></div>`;
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
  const tool = (ed, icon, label, on = false, title = '') => `<button class="btn small ghost ${on ? 'on' : ''}" data-ed="${ed}" ${title ? `title="${title}"` : ''}>${UI_ICON[icon]}${label}</button>`;
  const sw = (opt, label) => `<label class="sw"><input type="checkbox" data-opt="${opt}" ${ui[opt] ? 'checked' : ''}><i></i>${label}</label>`;
  // Kopf: Titel + Speichern/Verwerfen; darunter Werkzeuge in beschrifteten Gruppen (Hinzufügen → Layout → Raster → Farbe); Vorlagen oben neben Speichern
  return `<div class="ed-head"><h2>Layout-Editor</h2><span class="ed-note">Änderungen gelten erst nach „Speichern“</span><span class="grow"></span>
      <div class="ed-files">${tool('lib', 'stack', `Layouts (${db.layouts.length})`, ui.lib)}${tool('reset', 'reset', 'Standard-Layout')}</div>
      <button class="btn ghost" data-ed="cancel">Verwerfen</button><button class="btn" data-ed="save">${UI_ICON.check}Speichern</button></div>
    <div class="ed-tools">
      <div class="tgrp"><span class="tgrp-k">Hinzufügen</span><div class="tgrp-b">${tool('add', 'plus', 'Bereich')}${tool('addMarker', 'pin', 'Punkt')}</div></div>
      <div class="tgrp"><span class="tgrp-k">Ganzes Layout</span><div class="tgrp-b">${tool('scale', 'scale', 'Skalieren', ui.scaleMode)}${tool('rotate', 'rotate', 'Drehen 90°', false, 'Ganzes Layout um 90° im Uhrzeigersinn drehen')}</div></div>
      <div class="tgrp"><span class="tgrp-k">Raster</span><div class="tgrp-b">${sw('snap', 'Einrasten')}
        <select data-opt="grid" aria-label="Rastergröße">${[5, 10, 20].map(g => `<option value="${g}" ${g === ui.grid ? 'selected' : ''}>${g} px</option>`).join('')}</select>${sw('pieceMode', 'Teile einzeln')}</div></div>
      <div class="tgrp"><span class="tgrp-k">Farbe</span><div class="tgrp-b">${colorToggle()}</div></div>
    </div>
    <div class="plan ed-plan"><div class="map-wrap"><svg id="edSvg" class="map editor" viewBox="-10 -10 ${ED.W + 20} ${ED.H + 20}">
      <defs><pattern id="grid" width="${ui.grid}" height="${ui.grid}" patternUnits="userSpaceOnUse">
        <path class="grid-ln" d="M${ui.grid} 0H0V${ui.grid}" fill="none" stroke-width=".6"/></pattern></defs>
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
  const mg = e.target.closest('[data-marker]'), zg = e.target.closest('[data-zone]'), add = e.ctrlKey || e.metaKey;
  if (add && (mg || zg)) { multiToggle(mg ? 'm' : 'z', mg ? mg.dataset.marker : zg.dataset.zone); ui.lib = ui.scaleMode = false; return redrawEd(); }
  if (multiCount() && (mg ? ui.multi.m.has(mg.dataset.marker) : zg && ui.multi.z.has(zg.dataset.zone))) { // Teil der Auswahl → alles zusammen ziehen
    drag = { group: groupOrig(), start: svgPt(svg, e) };
    svg.setPointerCapture(e.pointerId); return;
  }
  if (!e.target.dataset.h && !mg && !zg) { // leere Fläche: Auswahlrahmen aufziehen (Strg = zur Auswahl hinzufügen)
    if (!add) { ui.multi = null; ui.sel = null; }
    const p = svgPt(svg, e); ui.band = [p.x, p.y, p.x, p.y]; drag = { band: true };
    svg.setPointerCapture(e.pointerId); return redrawEd();
  }
  ui.multi = null;
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
  const p = svgPt($('#edSvg'), e);
  if (drag.band) { ui.band[2] = p.x; ui.band[3] = p.y; return redrawEd(false); }
  const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
  if (drag.group) { groupMove(drag.group, dx, dy); return redrawEd(false); }
  const i = ui.sel.piece;
  if (drag.m) moveMarker(drag.m, drag.orig, dx, dy);
  else if (drag.hd) edResize(drag.z.rects[i], drag.orig[i], drag.hd, dx, dy);
  else edMove(drag.z, ui.pieceMode ? [i] : drag.orig.map((_, k) => k), drag.orig, dx, dy);
  redrawEd(false);
});
const endDrag = () => {
  if (drag?.band) { // alles, was der Rahmen berührt, kommt in die Auswahl
    const [x1, x2] = [ui.band[0], ui.band[2]].sort((p, q) => p - q), [y1, y2] = [ui.band[1], ui.band[3]].sort((p, q) => p - q);
    ui.band = null;
    if (x2 - x1 > 3 || y2 - y1 > 3) {
      ui.multi ??= { z: new Set(), m: new Set() };
      if (ui.sel?.zone) ui.multi.z.add(ui.sel.zone); if (ui.sel?.marker) ui.multi.m.add(ui.sel.marker); ui.sel = null;
      ui.draft.forEach(z => { if (z.rects.some(([x, y, w, h]) => x < x2 && x + w > x1 && y < y2 && y + h > y1)) ui.multi.z.add(z.id); });
      ui.draftM.forEach(m => { if (m.x >= x1 && m.x <= x2 && m.y >= y1 && m.y <= y2) ui.multi.m.add(m.id); });
      if (!multiCount()) ui.multi = null; else multiSettle();
    }
  }
  if (drag) { drag = null; redrawEd(); }
};
$('#view').addEventListener('pointerup', endDrag);
$('#view').addEventListener('pointercancel', endDrag);

document.addEventListener('keydown', e => {
  if (ui.tab === 'layout' && multiCount() && !e.target.matches('input, select, textarea')) {
    if (e.key === 'Escape') { ui.multi = null; return redrawEd(); }
    if (!e.key.startsWith('Arrow')) return;
    e.preventDefault();
    const step = ui.snap ? ui.grid : 1, d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    groupMove(groupOrig(), ...d); return redrawEd();
  }
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
  if (a === 'clearSel') { ui.multi = null; return redrawEd(); }
  ui.multi = null; // jede andere Werkzeug-Aktion hebt die Mehrfachauswahl auf
  const z = edZone(), mk = edMarker();
  if (a === 'scale') { ui.scaleMode = !ui.scaleMode; ui.lib = false; ui.sel = null; return render(); } // render: Knopf zeigt „aktiv“
  if (a === 'rotate') { rotateAll(); return redrawEd(); }
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
  $('#adminBtn').textContent = ui.admin ? 'Admin beenden' : 'Admin-Login';
  // Wer ist angemeldet? Gerät abmelden nur im Admin-Modus, damit an der Theke niemand aus Versehen abmeldet
  $('#account').innerHTML = cloud.email ? `<span title="Angemeldet">${glyph('👋')}${esc(cloud.email)}</span>`
    + (ui.admin ? ' <button class="btn small ghost" id="topLogout">Gerät abmelden</button>' : '') : '';
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === ui.tab));
  $('#view').classList.toggle('full', ui.tab === 'layout');
  $('#view').classList.toggle('wide', ui.tab === 'dashboard' || ui.tab === 'putzplan'); // passt in den Bildschirm
  const f = document.activeElement, fk = $('#view').contains(f) && ['toggle', 'pick', 'zone', 'shift', 'edit'].map(k =>
    f.dataset?.[k] !== undefined && `[data-${k}="${CSS.escape(f.dataset[k])}"]`).find(Boolean);
  const keep = render.tab === ui.tab && ['.b-list', '.pp-detail'].map(s => [s, $(s)?.scrollTop]); // gleicher Tab: Scrollposition der Listen behalten
  $('#view').classList.remove('enter');
  $('#view').innerHTML = views[ui.tab]();
  if (keep) keep.forEach(([s, y]) => { if (y && $(s)) $(s).scrollTop = y; });
  if (render.tab !== ui.tab) { if (render.tab) replay($('#view'), 'enter'); render.tab = ui.tab; }
  if (fk) $('#view').querySelector(fk)?.focus({ preventScroll: true }); // Fokus zurück, ohne die Liste zur Aufgabe zu scrollen
  if (ui.tab === 'admin') applyRange();
}

// --- Events ---
$('#tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (b && b.dataset.tab !== ui.tab) { ui.tab = b.dataset.tab; render(); } };

$('#view').addEventListener('click', e => {
  if (e.target.closest('#edSvg')) return; // Editor-Karte läuft über Pointer-Events
  const el = e.target.closest('[data-toggle],[data-shift],[data-zone],[data-edit],[data-del],[data-ed],[data-tab],[data-colorby],[data-pick],[data-markers],[data-mittel],[data-holiday],[data-export],[data-import],#deviceLogout');
  if (!el) return;
  const d = el.dataset;
  if (d.ed) edAction(d.ed, d.val);
  else if (d.colorby) { db.colorBy = d.colorby; save(); render(); }
  else if (d.tab) { if (d.tab !== ui.tab) { ui.tab = d.tab; render(); } }
  else if (d.toggle) toggle(d.toggle);
  else if (d.mittel !== undefined) { if (mittelActive()) delete db.mittelDays[today()]; else db.mittelDays[today()] = new Date().toISOString(); ui.shift = currentShift(); save(); render(); }
  else if (d.holiday) {
    if (d.holiday === 'add') { const v = $('#holidayInput').value; if (!v) return; if (!db.holidays.includes(v)) db.holidays.push(v); }
    else db.holidays = db.holidays.filter(x => x !== d.holiday);
    save(); render();
  }
  else if (d.markers !== undefined) {
    const show = () => { ui.showMarkers = !ui.showMarkers; render(); if (ui.showMarkers) document.querySelectorAll('#view .map').forEach(m => replay(m, 'm-in')); };
    const maps = document.querySelectorAll('#view .map');
    if (ui.showMarkers && !reduceMotion()) { maps.forEach(m => m.classList.add('m-out')); setTimeout(show, 180); } else show();
  }
  else if (d.pick) { pickTask(d.pick); }
  else if (d.shift) {
    if (d.shift === ui.shift) return;
    const order = Object.keys(SHIFTS), dir = order.indexOf(d.shift) > order.indexOf(ui.shift) ? 'from-right' : 'from-left';
    ui.shift = d.shift; render(); replay($('#view .list'), dir);
  }
  else if (d.zone) {
    const prev = ui.zone; ui.zone = ui.tab === 'dashboard' && ui.zone === d.zone ? null : d.zone; render();
    if (ui.tab === 'putzplan' && ui.zone !== prev) replay($('.pp-detail'), 'enter'); // Aufgaben des Bereichs poppen auf
  } // Dashboard: nochmal tippen = schließen
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
  else if (d.zone) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); } // Bereich auf der Karte
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
// Hell/Dunkel: Standard dunkel, Wahl pro Gerät gemerkt (Startwert setzt index.html vor dem ersten Zeichnen)
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('cf-theme', t); } catch {}
  $('#themeBtn').title = $('#themeBtn').ariaLabel = t === 'dark' ? 'Hell schalten' : 'Dunkel schalten';
}
setTheme(document.documentElement.dataset.theme || 'dark');
// Seitenleiste ein-/ausklappen, pro Gerät gemerkt
const setSide = mini => { document.documentElement.classList.toggle('side-mini', mini); try { localStorage.setItem('cf-side', mini ? 'mini' : 'full'); } catch {} };
$('#sideToggle').onclick = () => setSide(true);
$('#brandBtn').onclick = () => setSide(!document.documentElement.classList.contains('side-mini')); // Logo klappt ein und aus
$('#themeBtn').onclick = () => {
  const root = document.documentElement;
  if (!reduceMotion()) { root.classList.add('theming'); setTimeout(() => root.classList.remove('theming'), 400); }
  setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
  replay([...document.querySelectorAll('#themeBtn > span')].find(s => s.offsetParent), 'spin'); // das jetzt sichtbare Symbol
};

const draftDirty = () => !!ui.draft && (JSON.stringify(ui.draft) !== JSON.stringify(db.zones) || JSON.stringify(ui.draftM) !== JSON.stringify(db.markers));
// keepDraft: beim automatischen Beenden bleibt der Editor-Entwurf, bis sich ein Admin wieder anmeldet
function endAdmin(keepDraft = false) {
  ui.admin = false; ui.sel = ui.multi = null;
  if (!keepDraft) ui.draft = ui.draftM = null;
  if (cloud.admin === sbAdmin) { sbAdmin.auth.signOut(); cloud.admin = null; }
  if (ui.tab === 'admin' || ui.tab === 'layout') ui.tab = 'dashboard';
  render();
}
let lastInput = Date.now();
['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { lastInput = Date.now(); }, true));
const ADMIN_IDLE_MIN = 15; // Theke: Admin-Rechte nicht offen stehen lassen
const adminIdleCheck = () => { if (ui.admin && cloud.admin === sbAdmin && Date.now() - lastInput > ADMIN_IDLE_MIN * 60e3 && !document.querySelector('dialog[open]')) endAdmin(true); };
$('#adminBtn').onclick = () => {
  if (ui.admin) {
    if (draftDirty() && !confirm('Das Layout im Editor ist noch nicht gespeichert. Trotzdem beenden und Änderungen verwerfen?')) return;
    return endAdmin();
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
    form.elements[f].value = ['time', 'from', 'to'].includes(f) && t[f] ? hm(t[f]) : t[f] ?? (f === 'zoneId' ? db.zones[0]?.id ?? '' : f === 'startDate' ? today() : f === 'everyDays' ? 14 : '');
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
  for (const k of ['time', 'from', 'to']) f[k] = bizTime(f[k]);
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
const sync = () => { syncing = syncing.then(pushChanges).catch(e => cloudBar('⚠ Noch nicht gespeichert – keine Verbindung zur Datenbank. Wird jede Minute automatisch erneut versucht. (' + (e.message || e) + ')')); };
async function pushChanges() {
  if (!cloud.ready) return;
  const now = doneRows();
  const add = Object.entries(now).filter(([k, v]) => cloud.done[k] !== v), del = Object.keys(cloud.done).filter(k => !(k in now));
  for (const part of chunks(add)) { const { error } = await sb.from('done').upsert(part.map(([key, done_at]) => ({ key, done_at }))); if (error) throw error; }
  for (const part of chunks(del)) { const { error } = await sb.from('done').delete().in('key', part); if (error) throw error; }
  cloud.done = now;
  const cfg = configJson();
  if (cfg !== cloud.config && cloud.admin) { // Nicht-Admins ändern keine Aufgaben; Ansichts-Einstellungen bleiben lokal
    // Ganzes Dokument wird ersetzt: hat ein anderes Gerät seit unserem Laden gespeichert, nicht überschreiben
    const cur = await cloud.admin.from('studio').select('updated_at').eq('id', STUDIO_ID).maybeSingle();
    if (cur.error) throw cur.error;
    if (cur.data && cloud.updatedAt && Date.parse(cur.data.updated_at) !== cloud.updatedAt) {
      await cloudLoad(); if (quiet()) render();
      return cloudBar('⚠ Deine letzte Änderung an Aufgaben/Layout wurde nicht gespeichert: ein anderes Gerät hat gleichzeitig geändert. Neuer Stand ist geladen – bitte nochmal machen.');
    }
    const at = new Date().toISOString();
    const { error } = await cloud.admin.from('studio').upsert({ id: STUDIO_ID, data: JSON.parse(cfg), updated_at: at });
    if (error) throw error;
    cloud.config = cfg; cloud.updatedAt = Date.parse(at);
  }
  cloudBar('');
}
// Lädt Aufgaben + Häkchen der letzten 2 Tage (+ Intervall-Häkchen). Ältere Häkchen bleiben in der Datenbank, werden aber nicht gebraucht.
async function cloudLoad() {
  const since = new Date(Date.now() - 2 * 864e5).toISOString();
  const [st, recent, intervals, backups] = await Promise.all([
    sb.from('studio').select('data,updated_at').eq('id', STUDIO_ID).maybeSingle(),
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
  cloud.updatedAt = st.data ? Date.parse(st.data.updated_at) : null;
  cloud.done = doneRows();
  localStorage.setItem(KEY, JSON.stringify(db));
}
// Änderungen anderer Geräte übernehmen (Live + jede Minute als Sicherheitsnetz)
const quiet = () => !document.querySelector('dialog[open]') && ui.tab !== 'admin' && ui.tab !== 'layout' && !drag;
let refreshTimer;
function refresh() {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(async () => {
    const pushed = syncing.then(pushChanges); syncing = pushed.catch(() => {});
    try {
      await pushed; // noch nicht Hochgeladenes zuerst – schlägt das fehl, nicht neu laden (würde es überschreiben)
      await cloudLoad(); if (quiet()) render();
    } catch (e) { cloudBar('⚠ Keine Verbindung zur Datenbank – Änderungen bleiben auf diesem Gerät und werden automatisch nachgeschickt.'); }
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
const tick = () => { const n = new Date(); $('#clock').textContent = n.toTimeString().slice(0, 5); $('#clockDate').textContent = n.toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit' }); };
setInterval(() => { tick(); adminIdleCheck(); if (cloud.ready) { refresh(); checkBackup(); } else if (quiet()) render(); }, 60000);
tick(); render(); start();
