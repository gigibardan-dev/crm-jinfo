# Alocare automată round-robin a lead-urilor

Status: implementat (migrare `005_round_robin_auto_assign.sql`, commit `d60ed6b` pe branch `feat/dashboard-reminder-filters-agent-name`). **Necesită rularea manuală a migrării în Supabase SQL Editor** înainte să aibă efect (nu se rulează automat la deploy).

## Ce face

La orice lead nou inserat printr-un canal "organic" (webhook, formular, forward email, sincronizare Facebook Sheets), dacă switch-ul global e pornit, sistemul alocă automat lead-ul agentului/managerului disponibil care a primit cel mai demult un lead (least-recently-assigned) — fără cursor sau index stocat, se auto-corectează la orice schimbare a echipei.

Dacă switch-ul e oprit, sau nu există niciun agent disponibil, lead-ul rămâne nealocat — exact comportamentul de dinainte (intră în Inbox, alocare manuală).

## Componente DB (migrare 005)

- **`app_settings`** (key/value, JSONB) — switch global, cheia `auto_assign_enabled`. Pornește `false`. RLS: citire pentru orice user autentificat, scriere doar admin/manager.
- **`profiles.available_for_autoassign`** (bool, default `true`) — fiecare agent/manager participă din prima la rotație; oricine își poate opri propria disponibilitate (RLS `profiles_update` deja permitea `id = auth.uid()`).
- **`leads.eligible_for_auto_assign`** (bool, default `false`) — **opt-in explicit per canal**, nu opt-out. Vezi mai jos care rute îl setează.
- **Trigger `assign_lead_round_robin()`** — `AFTER INSERT ON leads`, `SECURITY DEFINER`. Rulează doar dacă `assigned_to IS NULL AND eligible_for_auto_assign = true` și switch-ul e pornit. Alege agentul cu `MAX(assigned_at)` cel mai vechi (NULL — niciodată alocat — vine primul), face UPDATE pe lead (`assigned_to`, `assigned_at`, `status = 'assigned'`), inserează activitate (`type: 'assignment'`, text „Lead alocat automat către X prin Round-Robin") și notificare (`type: 'lead_assigned'`) — exact ca la alocarea manuală.

## Decizie cheie: care canale sunt eligibile

Cerința inițială a numit explicit trei canale: *"prin formular, webhook sau sincronizare"*. Import-ul manual (CSV/Excel) a fost exclus explicit de user (întrebare directă). Lead-ul creat manual de admin/manager rămâne mereu nealocat (comportament stabilit deja, separat de acest feature).

Asta lasă o ambiguitate reală: atât importul manual, cât și crearea manuală de admin, inserează cu `assigned_to: null` — la fel ca un webhook. Nu există niciun semnal deja existent (sursă, status) care să le distingă fiabil unele de altele. Soluția: coloană nouă `eligible_for_auto_assign`, **default false**, setată explicit `true` doar la insert, în exact 3 fișiere:

- `src/app/api/leads/inbound/route.ts` (webhook/formular)
- `src/app/api/leads/inbound-email/route.ts` (forward email)
- `src/app/api/leads/sync/facebook-sheets/route.ts` (sincronizare cron)

Rămân la default (`false`, deci excluse): `src/app/api/leads/import/route.ts` (import manual) și `src/app/(app)/leads/new/page.tsx` — pentru admin/manager (agentul se auto-alocă oricum la insert, `assigned_to` deja setat, trigger-ul nu are ce face).

Default `false` (opt-in, nu opt-out) e intenționat mai conservator: orice cale nouă de creare lead adăugată în viitor NU intră automat în round-robin decât dacă cineva marchează explicit `eligible_for_auto_assign: true`.

## UI

- **Dashboard → `AutoAssignPanel`** (doar admin/manager): switch global (buton pill, la fel ca restul toggle-urilor din aplicație — nu switch iOS) + listă cu toți agenții/managerii și statusul lor de disponibilitate. Adminul poate suprascrie disponibilitatea oricui (prin `/api/users/[id]`, extins cu câmpul `available_for_autoassign`, la fel cum era deja extins cu `is_active`); managerul vede lista dar editează doar propriul rând — consistent cu restul aplicației, unde editarea altor conturi e admin-only.
- **Sidebar** (footer, sub numele userului): toggle „Disponibil pt. auto-alocare" — doar pentru rolurile `agent`/`manager` (adminul nu e în pool). Scrie direct în `profiles` via client (RLS permite), fără API route.

## De ce nu în `/settings`

Pagina `/settings` e ecranată strict `admin`-only (`if (!isAdmin) return ...`), dar cerința spune explicit „accesibil admin/manager". Relaxarea gate-ului paginii de settings ar fi o decizie de securitate mai amplă (ar da managerilor acces și la gestiune utilizatori/pipeline/surse). Cerința însăși oferea alternativa: *"situated în zona de setări **sau direct pe dashboard**"* — s-a ales Dashboard, care e deja adaptat pe rol (are precedent: cardurile KPI gated `isAdminOrManager`).

## Neretroactivitate

Trigger-ul rulează doar `AFTER INSERT` — nu atinge niciodată rânduri existente. Lead-urile deja nealocate în momentul pornirii switch-ului rămân nealocate, fără nicio logică suplimentară necesară (comportamentul cerut a rezultat automat din design, nu a fost nevoie de un job separat de excludere).

## Idei neimplementate / posibile extensii viitoare

- Panou de „echitate" (câte lead-uri a primit fiecare agent în ultimele N zile) — util pt. verificarea vizuală că round-robin chiar distribuie egal.
- Reguli de rotație mai complexe (weighting per agent, cotă zilnică maximă) — nu a fost cerut, algoritmul actual e simplu și determinist.