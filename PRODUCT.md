# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Mitarbeiter an der Theke** (primär): schauen zwischendurch kurz drauf und haken Aufgaben ab, oft nebenbei mit Kunden beschäftigt. Arbeiten in Schichten (Früh / Mittel / Spät).
- **Chef / Studioleitung** (Admin): kontrolliert, was erledigt ist, pflegt Aufgaben, Putzplan und Layout.

## Product Purpose
„Studio Check“ ist die Schicht-Checkliste von Clever Fit Europaplatz: tägliche To-dos je Schicht (Werktag und Wochenende/Feiertag), Intervall-Aufgaben, Putzplan mit Studio-Karte und Layout-Editor. Erfolg: Jede Schicht weiß auf einen Blick, was jetzt zu tun ist, und nichts wird vergessen.

## Positioning
Kein generisches To-do-Tool: Aufgaben hängen an der echten Studio-Karte (Bereiche und Punkte wie Mülltonnen, Getränkebar) und an der aktuellen Schicht und Uhrzeit.

## Operating Context
- Läuft dauerhaft am Theken-PC (Chrome/Edge, oft als installierte App), fest angemeldet mit dem Theke-Konto.
- Geplant: zusätzlich ein Tablet (Größe noch unbekannt, Annahme 10–11"), genutzt an der Theke **und** beim Rundgang durchs Studio. Muss per Touch in Hoch- und Querformat funktionieren.
- Hell- und Dunkelmodus, pro Gerät wählbar; Dunkel ist Standard.
- Die App könnte der Clever-Fit-Führung über dem Chef präsentiert werden.

## Capabilities and Constraints
- Reine HTML/CSS/JS-Dateien ohne Build (`index.html`, `styles.css`, `app.js`), gehostet auf GitHub Pages, Daten in Supabase.
- Rollen: Theke darf nur abhaken; Admins ändern Aufgaben und Layout.
- Funktionsumfang ist vorerst fertig; Design-Änderungen dürfen keine Funktion verlieren.
- Schicht-Farbstreifen bleiben bewusst unverändert.

## Brand Commitments
- Soll klar nach Clever Fit aussehen: Schwarz / Weiß / Rot, Clever-Fit-Wortmarke („clever**fit**“). Professionell, polished, clean, präsentationsreif.
- Eigene Schwarz-Weiß-Symbole statt bunter Emojis.

## Evidence on Hand
- Echte Aufgabenlisten, Schichten und Studio-Layout in der App bzw. in `studio-check-*.json`.
- Layout-Skizze: `Self made Layout + Farbe.png`.
- Kein offizielles Clever-Fit-CI-Handbuch vorhanden; keine offiziellen Markenschriften.

## Product Principles
1. Auf einen Blick: Was ist jetzt, in dieser Schicht, zu tun?
2. Abhaken muss in einer Berührung gehen, auch nebenbei.
3. Die Karte ist das Herzstück und zeigt, *wo* etwas zu tun ist.
4. Präsentationsreif: wirkt wie ein offizielles Werkzeug der Marke.

## Accessibility & Inclusion
Touch-taugliche Flächen (Tablet), gut lesbar aus Thekenabstand, Kontrast in beiden Modi, Tastaturbedienung am PC.
