# Integrări canale lead → CRM — status

Progres pe cele 4 canale discutate (jinfotours.ro, Jino chatbot, Facebook, JinfoCruise.ro).
Endpoint-ul țintă pentru toate: `POST /api/leads/inbound`. CRM deployat la `https://crm-jinfo.vercel.app`.

## 1. jinfotours.ro (Aqua CMS) — GATA (confirmat 25 aug 2026)

Soluție finală: editare directă în scriptul custom al lui Gigi (widget overlay `jctSubmit`/`jctOpen`, injectat prin slot „body-bottom" — NU cod din tema Aqua, deci fără risc la update-uri de temă). Varianta inițială cu wrapper extern prin GTM a fost abandonată (ID-uri de câmp greșite + risc de ordine de încărcare).

Cod adăugat în funcția `window.jctSubmit`, imediat după `xhr.send(params)` (deci după ce `jctValidate()` a trecut — date validate, GDPR bifat): `fetch()` paralel cu `keepalive:true` către CRM, cu `first_name/last_name/email/phone/message/source/source_detail`.

Config folosit: `CRM_URL = 'https://crm-jinfo.vercel.app/api/leads/inbound'`, `CRM_API_KEY = 'lmlmxSUgwaRSGmTadE6vj-AzbNXU1gJe'` (setat și în Supabase pe `lead_sources.website_form`).

`route.ts` (`/api/leads/inbound`) are nevoie de CORS pentru acest canal (fetch din browser, cross-origin) — aplicat, vezi versiunea finală mai jos la secțiunea comună.

## 2. Jino chatbot „Carmen AI" (Cloudflare Worker `jinfo-ai-agent` v5.0) — GATA (confirmat 25 aug 2026)

Server-to-server (Worker → Vercel), fără nevoie de CORS. Trimite spre CRM în **două situații**, ambele cu `source: 'chat_ai'`, cheie `x-api-key: 5Uu08BhvKHNMdCdwK-tAYZDB5FVYTG1Y` (setată în Supabase pe `lead_sources.chat_ai`):

- **Detectare automată** (telefon/email apărut într-un mesaj din chat): payload subțire — `phone, email, destination, interest_score, conversation[], message, source_detail: "Chat AI Carmen - detectare automată"`. Se poate trimite de mai multe ori în aceeași sesiune, pe măsură ce scorul/destinația se clarifică.
- **`save_lead`** (formular complet din widget): payload bogat — `first_name, last_name, phone, email, destination, budget_range, trip_type, interest_score, conversation[], message, source_detail: "Chat AI Jino"`. Cod adăugat în worker: `ctx.waitUntil(fetch(CRM_URL, {...}))` imediat după `const savedLead = await sb.request(...)`, înainte de `whatsappMsg`. Config (`CRM_URL`, `CRM_API_KEY`) declarat ca `const` **în afara** obiectului `CONFIG` (nu în interiorul lui — greșeală inițială, corectată).

**Logică nouă adăugată în `route.ts` special pentru `chat_ai`** (nu se aplică altor surse):
- `interest_score` (0-100) → `priority`: <30 low, 30-59 medium, 60+ high (`urgent` rămâne mereu manual).
- La duplicat pe email/telefon (fereastra de 7 zile): **actualizează lead-ul existent** (destinație, buget, tip călătorie, mesaj, prioritate din scor nou) în loc să lase doar o notă — pentru că trimiterile succesive din aceeași sesiune de chat au date tot mai bune. Pentru toate celelalte surse, comportamentul de „doar notă duplicat" a rămas neschimbat.
- `conversation[]` (`{role, content}[]`) → formatată text simplu (`👤 Client: ...` / `🤖 Carmen: ...`) și salvată ca o singură intrare „vie" în `lead_activities` (type `system`, `metadata.kind: 'chat_transcript'`) — la fiecare push se șterge varianta veche și se reinserează cea nouă, ca să apară mereu sus, la zi, în timeline-ul lead-ului. Nu se trimite notificare admin/manager la actualizări (doar la creare), ca să nu spamăm.
- Notă tehnică: coloana `source_raw_data` există pe `Insert` dar NU pe tipul `Update` generat de Supabase — nu se poate actualiza la duplicat (nu e o pierdere reală, restul câmpurilor relevante sunt actualizate explicit).

## 3. Facebook Lead Ads — cod GATA, în validare live cu Gigi

**Ce s-a decis:** în loc de integrare directă Facebook Graph API/webhook (necesită App Review la Meta, mai greu de întreținut), s-a ales varianta cu Google Sheets ca intermediar — Meta livrează nativ, fără cod, fiecare lead nou într-un Google Sheet conectat din Instant Forms (Gigi a configurat asta: formular „Regii Frantei" → Sheet „Leaduri-Facebook-Jinfo", cu opțiunea „creează filă nouă la fiecare campanie nouă" bifată). CRM-ul citește periodic acel Sheet prin Google Sheets API și importă automat.

**Faza 1 (gata, 25 aug 2026):** import manual din fișier — `POST /api/leads/import` acceptă acum, pe lângă modelul propriu .xlsx, și exportul BRUT Facebook (.csv/.xls, nemodificat) — vezi `claude/import-leaduri.md`.

**Faza 2 (gata, 26 aug 2026):** sincronizare automată, fără fișier intermediar.

- `src/lib/leads/import-facebook.ts` a fost refactorizat: logica de mapare a rândurilor (`mapFacebookRows()`) e acum separată de decodarea .csv/.xls, ca să poată fi refolosită direct pe rândurile `string[][]` întoarse de Google Sheets API — o singură logică de mapare/validare pentru toate cele trei căi (fișier .csv, fișier .xls, Sheets API live).
- `src/lib/leads/google-sheets.ts` — client minimal Sheets API v4 (autentificare cont de service, `google-auth-library`, fără pachetul greu `googleapis`), scop doar-citire.
- `GET/POST /api/leads/sync/facebook-sheets` — endpoint nou, făcut să fie apelat periodic de un scheduler/pinger extern (fără sesiune de utilizator). Listează TOATE filele din spreadsheet la fiecare rulare (deci o filă nouă apărută la o campanie nouă e citită automat, fără nicio schimbare de cod), le citește într-un singur `batchGet`, le mapează/validează cu ACELAȘI motor ca restul importului, deduplică pe `id`-ul stabil al leadului Facebook (`leads.source_raw_data->facebook->>id`) ca să nu reimporte la fiecare rulare, inserează doar leadurile chiar noi + activitate + notificare admin/manager (identic cu restul canalelor).
- **Autentificare endpoint — `CRON_SECRET` dedicat** (decizie explicită a lui Gigi, 26 aug): NU reutilizează `lead_sources.webhook_key` ca la celelalte canale — endpoint-ul ăsta nu e un canal de leaduri, e un trigger de sincronizare, deci are propriul secret, izolat de baza de date. Verificat din `Authorization: Bearer <CRON_SECRET>` (convenția oficială Vercel Cron — dacă se trece pe Vercel Cron mai târziu cu variabila numită exact `CRON_SECRET`, headerul e trimis automat, fără nicio schimbare de cod), `x-cron-secret`, sau `?key=` (pentru pingere care nu pot seta headere custom). Fără `CRON_SECRET` setat, endpoint-ul refuză orice cerere (fail closed).
- **Fix `middleware.ts` (26 aug):** ruta era blocată de protecția globală de autentificare (redirect 307 către `/login` pentru orice request fără sesiune de browser — inclusiv pinger-ul extern). Adăugată la lista de rute excluse din auth (`isWebhookRoute`), alături de `/api/leads/inbound` și `/api/leads/facebook` — are oricum propria autentificare internă prin `CRON_SECRET`.
- Testat cu date reale (fixtura `scripts/fixtures/facebook-sample.csv`/`.xls` + un test suplimentar `mapFacebookRows()` direct, cu antete reordonate ca la Sheets API) — `npm run test:import`, toate assertion-urile trec. Testat și LIVE de Gigi pe producție (înainte de fix-ul de middleware, apelat direct fără pinger): a găsit 4 rânduri în Sheet, a importat 1 lead nou și a recunoscut corect 3 ca deja importate (din testele manuale anterioare de upload .csv/.xls) — deduplicarea pe `id`-ul Facebook funcționează corect.

**Rulare periodică — decis (26 aug):** pinger extern gratuit (cron-job.org), la fiecare ~10 minute — NU Vercel Cron (plan Hobby, limitare de frecvență). Pinger-ul apelează endpoint-ul cu `CRON_SECRET`-ul din header sau query.

**Rămâne de făcut, în afara codului (Gigi):**
1. ~~Creat cont de service Google Cloud + activat Google Sheets API + descărcat cheia JSON.~~ GATA.
2. ~~Partajat Sheet-ul cu emailul contului de service.~~ GATA — sync-ul a citit deja date reale din Sheet.
3. ~~Setat variabilele Google + `CRON_SECRET` pe Vercel.~~ GATA.
4. ~~Testat manual endpoint-ul.~~ GATA — a funcționat corect (1 nou, 3 deduplicate).
5. Deploy pe producție al fix-ului de `middleware.ts` (26 aug) — necesar ca pinger-ul extern să poată apela endpoint-ul fără să dea peste redirect la `/login`.
6. Configurat pinger-ul (cron-job.org) la ~10 minute, cu `CRON_SECRET` — în curs.

**Pus pe TODO, nu urgent:** mapare status CRM → statusurile oficiale Meta (Intake / Qualified / Converted / Lost / Not qualified), pentru scriere înapoi în Sheet și optimizare reclame prin API Conversii. Nu blochează primirea leadurilor — doar optimizarea bugetului de reclame. Vezi discuția cu Gigi din 26 aug pentru raționament complet (de ce ajută, cum s-ar automatiza).

## 4. JinfoCruise.ro (jinfocruise_request, jinfocruise_contact, jinfocruise_reservation) — GATA (confirmat 25 aug 2026)

Server-to-server (Vercel jinfocruise → Vercel CRM), fără nevoie de CORS. Toate 3 sursele trimit către `route.ts`, momentan cu **aceeași cheie** `x-api-key` ca `website_form` (`lmlmxSUgwaRSGmTadE6vj-AzbNXU1gJe`) — decizie asumată: nu blochează nimic, vezi fix-ul de precedență mai jos. Nu există rânduri separate în `lead_sources` pentru cele 3 (Gigi nu le-a vrut separate) — identificarea se face strict prin `body.source`.

**Bug critic identificat și fixat în `route.ts`**: lookup-ul după `webhook_key` suprascria necondiționat `source` cu slug-ul găsit în `lead_sources` — cum JinfoCruise folosește cheia lui `website_form`, toate leadurile ieșeau clasificate greșit ca `website_form`. Fix: `body.source` are acum întotdeauna prioritate față de sursa derivată din cheie (cheia rămâne fallback doar când `body.source` lipsește). **Important:** acest fix există în codul dat lui Gigi, dar trebuie deployat pe producție (git push) ca leadurile reale viitoare să iasă corect — primul lead real de test (Silvana Cernaianu) a intrat înainte de deploy și a rămas în DB cu `source: website_form` (corectat manual cu un UPDATE SQL, doar pentru acel rând).

**Deduplicare: dezactivată complet** pentru cele 3 surse (`JINFOCRUISE_SOURCES` în `route.ts`) — la cererea explicită a lui Gigi, fiecare cerere/contact/rezervare e un eveniment de business separat chiar dacă vine de la același client (ex. 2-3 cereri de croazieră diferite). Unificarea manuală de către agent/admin e un tool de viitor, nu acum.

**Mapare câmpuri** (din payload-urile reale, cu `metadata` specific per sursă):
- `trip_type: 'croaziera'` fix pentru toate 3.
- `budget_range`: `jinfocruise_request` → `"{price} EUR/persoană"` sau `"... total"` (din `metadata.price` + `price_type`, poate lipsi — atunci `—`); `jinfocruise_reservation` → `"{gross_amount} EUR total"` (din `metadata.gross_amount`); `jinfocruise_contact` → nimic (n-are date de preț).
- `priority`: `jinfocruise_reservation` → `high` (rezervare confirmată); `jinfocruise_request` și `jinfocruise_contact` → `medium`.
- `travel_date_from`/`travel_date_to`: din `metadata.sailing_date` + `metadata.nights` (calculat cu `addDays`), pentru request și reservation. Contact n-are date.
- `nr_adults`/`nr_children`: mapate **doar** la `jinfocruise_reservation`, direct din `metadata.no_adults`/`no_children` (date sigure, din sistemul de rezervări). La `jinfocruise_request` NU se presupune nimic din `metadata.occupancy` (string ambiguu, ex. `"2A"` — poate fi total pe cabină, poate include copii) — rămâne doar vizibil în UI, agentul completează manual pe lead dacă e nevoie.

**UI nou — panel „Detalii croazieră"** în `src/app/(app)/leads/[id]/page.tsx`, vizibil doar pentru `jinfocruise_request`/`jinfocruise_reservation` (nu și `contact`, care n-are date de croazieră), citește direct din `lead.source_raw_data.metadata` (fără coloane noi în `leads`): navă, cod croazieră/nr. rezervare, link către pagina croazierei, dată plecare + nopți, port îmbarcare, preț, categorie/cabină, tarif, taxe port/serviciu, avertisment galben pentru ocupanța neconfirmată (`request`), listă pasageri (`reservation`, din `metadata.passengers`). Funcționează retroactiv pe orice lead deja existent (citește date deja salvate în `source_raw_data`) — spre deosebire de mapările de coloane din `route.ts`, care se aplică doar leadurilor inserate după deploy.

## De construit, nu urgent

`/settings/sources` din CRM afișează sursele doar read-only — nu există UI pentru generare/rotire webhook keys din admin (s-a folosit SQL manual de câteva ori până acum).