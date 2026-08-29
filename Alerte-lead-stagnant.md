# Alerte pentru lead-uri stagnante (follow-up reminders)

Implementat: 2026-08-29 · branch `feat/dashboard-reminder-filters-agent-name` · commit `ac7cd5d`

## Ce face

Un lead „stagnează" când n-a avut nicio **interacțiune reală** de peste
**48h** (`STAGNANT_THRESHOLD_HOURS`, în `src/lib/utils/constants.ts`) și
statusul lui nu e final (`won`/`lost`/`unqualified`). Peste **96h**
(`STAGNANT_CRITICAL_HOURS`) badge-ul devine roșu în loc de galben.

„Interacțiune reală" = ultimul **comentariu** SAU ultima **schimbare de
status** — sau data creării, dacă niciuna nu există încă. Strict așa,
conform cerinței inițiale — nu orice tip de activitate (o realocare sau
o editare de câmp NU resetează alerta).

## De ce o coloană nouă, nu `last_activity_at`

`leads.last_activity_at` există deja din schema inițială și se
actualizează la **orice** insert în `lead_activities` (alocare, editare,
setare reminder, notă de sistem etc.) — dacă îl foloseam pt. alertă, un
admin care doar realocă un lead l-ar fi făcut să pară „proaspăt" fără ca
agentul să fi mișcat ceva cu clientul. Așa că am adăugat
**`leads.last_interaction_at`**, o coloană separată, întreținută de un
trigger nou (`handle_lead_interaction`, în
`supabase/migrations/004_stagnant_lead_alerts.sql`) care reacționează
STRICT la `lead_activities.type IN ('comment', 'status_change')`.

Cele două coloane coexistă și au scopuri diferite:
- `last_activity_at` → afișare generală „ultima activitate" (Kanban, tabel)
- `last_interaction_at` → strict pt. calculul alertei de stagnare

## Migrare necesară (pas manual!)

**`supabase/migrations/004_stagnant_lead_alerts.sql` trebuie rulată manual
în Supabase SQL Editor** înainte de deploy — adaugă coloana, face
backfill din activitățile existente (sau `created_at` dacă nu există
niciuna) și creează trigger-ul + un index. Fără ea, codul nou nu are de
unde citi `last_interaction_at` și query-urile eșuează.

## Unde apare în UI

- **Badge pe card/rând** — `StagnantBadge` (`src/components/leads/StagnantBadge.tsx`),
  folosit din `KanbanBoard` și `LeadsTable` (deci și pe Pipoeline, și pe
  lista de leaduri a unui agent din pagina lui de profil). Randează
  `null` dacă lead-ul nu e stagnant — sigur de folosit neconditionat.
- **Widget Dashboard** — `StagnantLeadsWidget`
  (`src/components/dashboard/StagnantLeadsWidget.tsx`), montat în
  `dashboard/page.tsx`. RLS face scoping-ul automat: agentul vede doar
  leadurile lui; admin/manager văd toate (devine practic un „tabel cu
  alertele la grămadă" — lead + agent + timp — cu toggle de sortare
  Timp/Agent). Fiecare rând → link direct la `/leads/[id]`. Are
  subscripție realtime pe `leads`, deci alerta dispare instant când
  agentul rezolvă lead-ul, fără refresh.

## Logică centralizată

`src/lib/utils/stagnantLeads.ts` — `getStagnantInfo(status, lastInteractionAt)`
întoarce `null` dacă nu e stagnant (status final sau sub prag), altfel
`{ hours, isCritical, label }` (`label` = durată în română, via
`date-fns` + locale `ro`, ex. "3 zile"). Un singur loc de adevăr, folosit
din badge și din widget.

## Idei neimplementate / posibile extinderi viitoare

# Alerte pentru lead-uri stagnante (follow-up reminders)

Implementat: 2026-08-29 · branch `feat/dashboard-reminder-filters-agent-name` · commits `ac7cd5d`, `d943350`

## Ce face

Un lead „stagnează" când n-a avut nicio **interacțiune reală** de peste
**48h** (`STAGNANT_THRESHOLD_HOURS`, în `src/lib/utils/constants.ts`) și
statusul lui nu e final (`won`/`lost`/`unqualified`). Peste **96h**
(`STAGNANT_CRITICAL_HOURS`) badge-ul devine roșu în loc de galben.

„Interacțiune reală" = ultimul **comentariu** SAU ultima **schimbare de
status** — sau data creării, dacă niciuna nu există încă. Strict așa,
conform cerinței inițiale — nu orice tip de activitate (o realocare sau
o editare de câmp NU resetează alerta).

## De ce o coloană nouă, nu `last_activity_at`

`leads.last_activity_at` există deja din schema inițială și se
actualizează la **orice** insert în `lead_activities` (alocare, editare,
setare reminder, notă de sistem etc.) — dacă îl foloseam pt. alertă, un
admin care doar realocă un lead l-ar fi făcut să pară „proaspăt" fără ca
agentul să fi mișcat ceva cu clientul. Așa că am adăugat
**`leads.last_interaction_at`**, o coloană separată, întreținută de un
trigger nou (`handle_lead_interaction`, în
`supabase/migrations/004_stagnant_lead_alerts.sql`) care reacționează
STRICT la `lead_activities.type IN ('comment', 'status_change')`.

Cele două coloane coexistă și au scopuri diferite:
- `last_activity_at` → afișare generală „ultima activitate" (Kanban, tabel)
- `last_interaction_at` → strict pt. calculul alertei de stagnare

## Migrare necesară (pas manual!)

**`supabase/migrations/004_stagnant_lead_alerts.sql` trebuie rulată manual
în Supabase SQL Editor** înainte de deploy — adaugă coloana, face
backfill din activitățile existente (sau `created_at` dacă nu există
niciuna) și creează trigger-ul + un index. Fără ea, codul nou nu are de
unde citi `last_interaction_at` și query-urile eșuează.

## Unde apare în UI

- **Badge pe card/rând** — `StagnantBadge` (`src/components/leads/StagnantBadge.tsx`),
  folosit din `KanbanBoard` și `LeadsTable` (deci și pe Pipeline, și pe
  lista de leaduri a unui agent din pagina lui de profil). Randează
  `null` dacă lead-ul nu e stagnant — sigur de folosit neconditionat.
- **Widget Dashboard** — `StagnantLeadsWidget`
  (`src/components/dashboard/StagnantLeadsWidget.tsx`), montat în
  `dashboard/page.tsx`. RLS face scoping-ul automat: agentul vede doar
  leadurile lui; admin/manager văd toate (devine practic un „tabel cu
  alertele la grămadă" — lead + agent + timp — cu toggle de sortare
  Timp/Agent). Fiecare rând → link direct la `/leads/[id]`. Are
  subscripție realtime pe `leads`, deci alerta dispare instant când
  agentul rezolvă lead-ul, fără refresh. Footer „Vezi toate în Pipeline"
  → `/leads?stagnant=true`.
- **Filtru „Doar stagnante" pe Pipeline** — toggle în `PipelineFilterBar`,
  lângă „Remindere scadente" existent, aceeași logică (`getStagnantInfo`)
  ca badge-ul și widget-ul. Combinabil cu celelalte filtre (agent, status,
  sursă). Suportă `?stagnant=true` din URL, ca `?status=won`/`?reminders=due`.

## Logică centralizată

`src/lib/utils/stagnantLeads.ts` — `getStagnantInfo(status, lastInteractionAt)`
întoarce `null` dacă nu e stagnant (status final sau sub prag), altfel
`{ hours, isCritical, label }` (`label` = durată în română, via
`date-fns` + locale `ro`, ex. "3 zile"). Un singur loc de adevăr, folosit
din badge, widget și filtrul de Pipeline.

## Idei neimplementate / posibile extinderi viitoare

- Prag configurabil doar din cod (constantă), nu dintr-un ecran de
  setări — dacă se dorește ajustabil din UI (per rol, per sursă etc.),
  e nevoie de un tabel de settings + admin UI.
- Leadurile nealocate (status `new`, fără agent) sunt incluse în calcul
  dacă trec de prag — se afișează cu agent „Nealocat", ceea ce
  surprinde corect și cazul „nimeni nu lucrează lead-ul", nu doar
  „agentul alocat a uitat de el".

- Prag configurabil doar din cod (constantă), nu dintr-un ecran de
  setări — dacă se dorește ajustabil din UI (per rol, per sursă etc.),
  e nevoie de un tabel de settings + admin UI.
- Un filtru dedicat „Doar stagnante" pe pagina Pipeline (similar cu
  „Remindere scadente" deja existent) — n-a fost implementat, widget-ul
  de pe Dashboard acoperă deja nevoia de „tabel cu alertele la grămadă"
  pt. admin/manager.
- Leadurile nealocate (status `new`, fără agent) sunt incluse în calcul
  dacă trec de prag — se afișează cu agent „Nealocat", ceea ce
  surprinde corect și cazul „nimeni nu lucrează lead-ul", nu doar
  „agentul alocat a uitat de el".