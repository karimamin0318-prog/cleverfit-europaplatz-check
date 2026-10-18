# Studio Check – Clever Fit Europaplatz

Checkliste für die Schichten am Theken-PC: tägliche To-dos (Früh / Mittel / Spät, Werktag und Wochenende/Feiertag),
Intervall-Aufgaben, Putzplan mit Studio-Karte und Layout-Editor.

**App öffnen:** https://karimamin0318-prog.github.io/cleverfit-europaplatz-check/

## Daten und Anmeldung
Aufgaben, Häkchen, Layout und Punkte liegen in **Supabase** (Projekt `cleverfit-europaplatz-check`) und sind auf allen Geräten gleich.

- **Theken-PC:** einmal mit dem Theke-Konto anmelden, bleibt angemeldet. Darf nur abhaken.
- **Admins** (Tabelle `admins`): dürfen Aufgaben und Layout ändern – zu Hause direkt, an der Theke über „Admin“.
- Konten und Passwörter: Supabase-Dashboard → Authentication → Users. Registrieren ist gesperrt.
- Datenbank-Setup: `supabase/setup.sql` (einmal im SQL Editor ausführen).
- Backup: Admin → Verwaltung → Daten & Backup → „Datei herunterladen“ (Supabase gratis macht keine automatischen Backups).

## Theken-PC einrichten
1. Chrome oder Edge mit der App-Adresse öffnen, mit dem Theke-Konto anmelden.
2. Optional als App installieren (Adressleiste → „App installieren“) und in den Windows-Autostart legen.
3. Windows: Energieoptionen → Bildschirm/Standby auf „Nie“.

## Mitarbeiten
Reine HTML/CSS/JS-Dateien ohne Build: `index.html`, `styles.css`, `app.js`.
Änderungen auf `main` sind nach ca. 1 Minute live. Vor größeren Änderungen ein Backup ziehen.
