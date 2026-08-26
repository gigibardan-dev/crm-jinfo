# CRM Jinfotours — Status proiect

> Document de referință/predare, actualizat **26 august 2026**. Scris ca punct de pornire pentru continuarea lucrului într-o sesiune nouă de chat — conține descrierea proiectului, ce e construit și funcțional acum, deciziile tehnice luate și de ce, și ce a rămas de făcut.
>
> Vezi și `JINFOTOURS_CRM_PLAN.md` din același folder — planul inițial, complet (viziune, schema DB, roluri, roadmap pe faze, wireframe-uri). Documentul de față **nu îl înlocuiește**, ci reflectă starea reală curentă a implementării, care a evoluat față de plan (mai ales la capitolul import/integrare Facebook).

---

## 1. Ce este CRM Jinfotours

Aplicație internă de gestiune a leadurilor pentru agenția de turism Jinfotours (și marca soră JinfoCruise), înlocuind fluxul actual bazat pe grupuri de WhatsApp/Excel. Colectează leaduri din toate canalele agenției într-un singur loc, le alocă agenților, urmărește pipeline-ul de vânzare (de la lead nou până la rezervare confirmată/pierdut) și oferă vizibilitate managerilor/adminului asupra performanței.

**Stack:** Next.js 16 (App Router) + React 19 + TypeScript, Supabase (Postgres + Auth + RLS), Tailwind CSS 4 + shadcn/ui. Deployat pe Vercel, producție la **https://crm-jinfo.vercel.app**. Repo: `crm-jinfo` (Gigi, cont GitHub `gigibardan-dev`).

**Roluri:** Admin, Manager, Agent (vezi `JINFOTOURS_CRM_PLAN.md` pentru matricea completă de permisiuni).

---

## 2. Status pe scurt

| Zonă | Status |
|---|---|
| Autentificare, roluri, RLS | ✅ Funcțional |
| Formular manual „Lead Nou” | ✅ Funcțional |
| Pipeline / Kanban leaduri | ✅ Funcțional |
| Inbox (leaduri nealocate) | ✅ Funcțional |
| Import în masă (Excel model + Facebook .csv/.xls) | ✅ Funcțional, livrat 25-26 aug |
| Integrare canal website jinfotours.ro | ✅ Funcțional (confirmat 25 aug) |
| Integrare canal chatbot „Carmen AI” | ✅ Funcțional (confirmat 25 aug) |
| Integrare canal Facebook Lead Ads (sync automat) | ✅ Cod gata, testat live cu date reale; configurare finală pinger extern **în curs** |
| Integrare canal JinfoCruise.ro | ✅ Funcțional (confirmat 25 aug), cu un fix critic ce trebuie deployat |
| Mapare status CRM ↔ statusuri oficiale Meta (pentru API Conversii) | 📝 Pe TODO, neînceput, nu urgent |

Detalii pentru fiecare, mai jos.

---

## 3. Fluxul de leaduri — arhitectura generală

Toate canalele externe converg către **un singur endpoint**: `POST /api/leads/inbound`, autentificat per-canal cu o cheie proprie (`lead_sources.webhook_key` din DB, trimisă ca header `x-api-key`). Leadurile intră **nealocate**, cu status `new`, și apar în Inbox — de acolo sunt alocate agenților prin fluxul existent din UI.

Canale active în acest moment:

1. **jinfotours.ro** (site principal, Aqua CMS) — formular de contact, `source: website_form`.
2. **Jino chatbot „Carmen AI”** (Cloudflare Worker) — `source: chat_ai`, în două variante (detectare automată telefon/email în conversație + `save_lead` din formularul complet al widgetului).
3. **Facebook Lead Ads** — via Google Sheets, vezi secțiunea 5, `source: facebook`.
4. **JinfoCruise.ro** — 3 sub-tipuri de eveniment (`jinfocruise_request`, `jinfocruise_contact`, `jinfocruise_reservation`), toate `source_raw_data`-etichetate distinct, deduplicare **dezactivată** (fiecare eveniment de business e separat, la cererea explicită a lui Gigi).
5. **Import manual în masă** (Excel/CSV/XLS) — `POST /api/leads/import`, cale separată de `/inbound`, dar cu **exact același model de validare** (vezi secțiunea 4).

Detalii tehnice complete pe fiecare canal: `claude/integrari-canale-status.md` (doc din baza de cunoștințe a proiectului Claude).

---

## 4. Import în masă (Excel + Facebook nativ) — livrat 25-26 aug

**Unde:** `/leads/import` în UI (Admin + Manager, link în sidebar). Endpoint: `POST /api/leads/import`, model descărcabil: `GET /api/leads/import/template`.

**Ce acceptă — două formate, detectate automat după extensie:**

1. Modelul propriu `.xlsx` (descărcat din CRM, completat manual sau prin copy-paste).
2. Exportul **brut, nemodificat** din Facebook Lead Ads (Meta Ads Manager → Leads Center → Download) — `.csv` sau `.xls`, exact cum îl descarcă administratorul de reclame, fără nicio prelucrare manuală.

**De ce a fost nevoie de tratament special pentru fișierele Facebook:** exportul Meta nu e un Excel/CSV standard.
- `.csv` e livrat în encoding **UTF-16LE**, separat prin **TAB** (nu virgulă), cu BOM, iar telefonul vine prefixat `p:` (ex: `p:+40728870869`).
- `.xls` **nu e un binar Excel real** — e XML „SpreadsheetML” (formatul Excel 2003), doar redenumit `.xls` de Meta.

Ambele au fost analizate direct pe fișiere reale trimise de Gigi (`scripts/fixtures/facebook-sample.csv`/`.xls`, o campanie „Regii Franței”, 3 leaduri) și s-a scris un parser dedicat pentru fiecare (`src/lib/leads/import-facebook.ts`), fără librărie externă nouă — nu există o soluție standard bună pentru XML SpreadsheetML redenumit `.xls`, iar encoding-ul UTF-16LE + delimitator TAB nu e tratat de librăriile uzuale de CSV.

**Recunoașterea coloanelor** Facebook (`FULL_NAME`, `EMAIL`, `PHONE`, `campaign_name`, `ad_name`, `form_name`, `created_time`, `platform`, `is_organic`, `lead_status`, id-uri) se face **după alias, case-insensitive, nu după poziție** — rezistă la schimbări viitoare de ordine/denumire din Meta.

**Mapare câmpuri Facebook → CRM:**
- `FULL_NAME` → despărțit în Prenume/Nume (primul cuvânt = prenume).
- `PHONE` → curățat de prefixul `p:`.
- Sursă → forțată „Facebook Ads” (slug `facebook`).
- Detalii sursă → `„Campanie: X · Reclamă: Y”`.
- Destinație → numele formularului Meta (`form_name`).
- Mesaj/Note → **toate coloanele nerecunoscute concatenate** — întrebările custom diferă de la formular la formular, deci orice răspuns liber al clientului ajunge garantat în CRM, indiferent ce întrebări are formularul respectiv.
- **Nimic nu se pierde:** rândul original complet (inclusiv id-uri campanie/reclamă/formular, `platform`, `is_organic`, `lead_status`) e păstrat integral în `leads.source_raw_data.facebook`, ca arhivă auditabilă, chiar și pentru câmpuri fără echivalent direct în CRM.

**O singură logică de validare pentru toate formatele:** `import-facebook.ts` normalizează exportul Facebook la exact aceeași formă „antet + rânduri” pe care o produce citirea `.xlsx`-ului propriu. De acolo încolo, `matchHeaders()`/`parseImportRow()` din `src/lib/leads/import-parse.ts` e **singura** sursă de adevăr pentru validare, indiferent de unde vine fișierul — inclusiv pentru sincronizarea automată din Google Sheets (secțiunea 5), care refolosește direct nucleul de mapare (`mapFacebookRows()`).

**Model de erori — două niveluri**, identic cu formularul manual „Lead Nou”:
- **Eroare (blocantă):** rândul e ignorat doar dacă niciun câmp de identitate/contact (Prenume, Nume, Telefon, Email) nu e completat.
- **Avertisment (neblocant):** email invalid, dată neparsabilă, nr. adulți/copii ne-întreg, tip călătorie/prioritate/sursă necunoscute, telefon fără nicio cifră, **și posibil duplicat** (telefon/email deja existent).
- **Duplicatele NU sunt sărite** — la cerere explicită, un lead cu telefon/email deja existent e creat oricum ca lead nou, cu un avertisment informativ atașat (niciodată blocat/unit automat).

**Verificare făcută:** `npx tsc --noEmit` curat, `npx eslint src scripts` — aceleași 24 probleme pre-existente, niciuna nouă, `npm run test:import` — toate assertion-urile trec (inclusiv paritate exactă CSV ↔ .xls pe fixturile reale), build de producție reușit.

---

## 5. Sincronizare automată Facebook Lead Ads via Google Sheets — livrat 26 aug

### De ce așa, și nu integrare directă Facebook

S-a analizat conectarea directă la Facebook Graph API/webhook pentru leaduri — necesită App Review la Meta (proces lung, aprobare incertă) și întreținere suplimentară. În schimb, Meta oferă nativ, **fără nicio dezvoltare**, livrarea fiecărui lead nou într-un Google Sheets conectat direct din Instant Forms — Gigi a configurat asta pe partea lui (Meta Ads Manager → formular „Regii Frantei” → Sheet „Leaduri-Facebook-Jinfo”, cu opțiunea **„creează filă nouă la fiecare campanie/formular nou”** bifată). CRM-ul citește periodic acel Sheet și importă automat, refolosind exact motorul de validare de la secțiunea 4.

### Cum funcționează

`GET`/`POST /api/leads/sync/facebook-sheets` — endpoint făcut să fie apelat **periodic de un pinger extern**, fără sesiune de utilizator logat:

1. **Descoperă filele automat** — `listSheetTitles()` (`src/lib/leads/google-sheets.ts`) listează TOATE filele din spreadsheet la **fiecare** rulare, nu un nume fix. Când Meta creează o filă nouă pentru o campanie nouă, e citită automat, **fără nicio schimbare de cod**.
2. Citește toate rândurile din toate filele într-un singur apel (`getAllSheetsValues`, `batchGet`) — mai eficient decât un request per filă.
3. Fiecare filă e mapată cu `mapFacebookRows()` (nucleul de mapare extras din `import-facebook.ts`) apoi validată cu **același** `matchHeaders()`/`parseImportRow()` ca restul importului.
4. **Deduplicare pe id-ul stabil al leadului Facebook** (ex: `l:1037064422454556`), stocat la orice import (fișier SAU sync) în `leads.source_raw_data->facebook->id`. Verificare: `SELECT` pe acel id înainte de `INSERT` (`.in('source_raw_data->facebook->>id', fbIds)`). Fără asta, fiecare rulare ar reimporta la nesfârșit tot ce e deja în Sheet.
5. Leadurile chiar noi sunt inserate (nealocate, status `new`, sursă `facebook`) + activitate de sistem pe fiecare lead + notificare admin/manager — identic cu restul canalelor.

**Client Google Sheets API** (`src/lib/leads/google-sheets.ts`): autentificare cu **cont de service Google Cloud** (JWT, `google-auth-library`), scop doar-citire (`spreadsheets.readonly`). Deliberat **fără** pachetul `googleapis` (mare, multe dependențe pentru doar două apeluri de citire) — doar `google-auth-library` (autentificare oficială Google) + REST direct către Sheets API v4. Contul de service trebuie adăugat ca „Viewer” pe Sheet (Share → emailul contului de service) — altfel API-ul dă 403, mesaj clar întors în acest caz.

### Autentificare endpoint — `CRON_SECRET` dedicat

**Decizie explicită a lui Gigi**, diferită de restul canalelor: *„Te rog să adaugi o verificare cu un API_SECRET_TOKEN în ruta de Next.js, astfel încât sincronizarea să pornească doar dacă pinger-ul trimite parola corectă.”*

Spre deosebire de celelalte canale (care folosesc `lead_sources.webhook_key` din DB), acest endpoint **nu reprezintă un canal de leaduri** — e un trigger de sincronizare, deci are propriul secret, izolat de baza de date: variabila de mediu **`CRON_SECRET`**.

- Numele nu e întâmplător — e convenția oficială **Vercel Cron**: dacă se trece pe Vercel Cron mai târziu (când planul permite), Vercel trimite automat headerul cu variabila numită exact așa, fără nicio schimbare de cod.
- Verificat din oricare din: header `Authorization: Bearer <CRON_SECRET>`, header `x-cron-secret`, sau query `?key=` (pentru pingere externe care nu pot seta headere custom, ca cron-job.org).
- **Fail closed:** fără `CRON_SECRET` setat în mediu, endpoint-ul refuză orice cerere (500) — nu există un mod „deschis” din greșeală.

### Fix `middleware.ts`

Ruta era inițial blocată de protecția globală de autentificare a aplicației (redirect 307 către `/login` pentru orice request fără sesiune de browser — inclusiv pinger-ul extern, care evident nu are cookie-uri). Gigi a auto-diagnosticat problema corect din log-urile cron-job.org și a cerut explicit fix-ul. Rezolvat adăugând ruta la lista deja existentă de excepții de auth (`isWebhookRoute`), alături de `/api/leads/inbound` și `/api/leads/facebook` — protecția reală a rutei rămâne `CRON_SECRET`-ul din interiorul ei, nu middleware-ul.

### Rulare periodică

**Decizie:** pinger extern gratuit — **cron-job.org**, la fiecare ~10 minute. NU Vercel Cron (echipa e pe plan Hobby, limitare probabilă la ~1 rulare/zi — insuficient pentru sincronizare aproape în timp real).

### Testare

- `npm run test:import` — inclusiv un test dedicat `mapFacebookRows()` apelat direct (fără fișier), simulând rânduri primite de la Google Sheets API cu antete reordonate și o întrebare custom cu etichetă reală — verifică inclusiv că id-ul Facebook e păstrat corect pentru deduplicare.
- **Testat live, de Gigi, pe producție** (apelat direct, înainte de fix-ul de middleware): a găsit 4 rânduri în Sheet, a importat **1 lead nou** și a recunoscut corect **3 ca deja importate** (din testele manuale anterioare de upload .csv/.xls) — deduplicarea pe id-ul Facebook a funcționat corect din prima.
- După fix-ul de middleware și deploy: cron-job.org confirmă **200 OK** (nu mai dă 307).

### Comportament pe cazuri speciale (discutat cu Gigi)

- **Rând adăugat manual în Sheet** → e citit la următoarea rulare a sync-ului ca orice alt rând nou (dacă are un `id` — de obicei nu are, dacă e adăugat de mână — sau alte câmpuri de identitate, e importat normal; fără id Facebook, deduplicarea viitoare se bazează pe telefon/email, nu pe id).
- **Rând/lead șters** → sync-ul e **doar aditiv** (never delete) — ștergerea unui rând din Sheet sau a unui lead din CRM nu are niciun efect invers; nu există sincronizare bidirecțională sau ștergere în cascadă.

### Rămâne de făcut

- ✅ ~~Cont de service Google Cloud + Sheets API activat + cheie JSON~~ — gata.
- ✅ ~~Sheet partajat cu contul de service~~ — gata, confirmat prin citire reală.
- ✅ ~~Variabile Google + `CRON_SECRET` setate pe Vercel~~ — gata.
- ✅ ~~Testat manual endpoint-ul~~ — gata (1 nou, 3 deduplicate).
- ✅ ~~Deploy fix middleware~~ — gata, confirmat 200 OK.
- ⏳ **Configurare finală pinger cron-job.org** la interval ~10 min, cu `CRON_SECRET` — era în curs la Gigi, de confirmat/finalizat.

### Limitare cunoscută, neblocantă

Calea de upload manual `.xlsx` din `/api/leads/import` recunoaște în continuare doar modelul propriu (antete în română). Un fișier `.xlsx` descărcat direct din Google Sheets (antete engleze Facebook) **nu** ar fi recunoscut dacă e urcat manual pe acea cale — ar da eroare „coloanele așteptate nu au fost găsite”. Nu blochează nimic în practică, fiindcă sync-ul automat (secțiunea 5) citește Sheet-ul live prin API, nu prin upload de fișier — dar dacă apare vreodată nevoia unui upload manual `.xlsx` exportat din Sheets, ar trebui extinsă recunoașterea de format și pe acea cale (același tip de aliasuri ca la `.csv`/`.xls`).

---

## 6. TODO — mapare status CRM ↔ statusuri Meta (neînceput, nu urgent)

Idee ridicată de Gigi (sfătuit și de Gemini): Meta are 5 statusuri oficiale pentru leaduri, folosite de API-ul de Conversii pentru optimizarea automată a bugetului de reclame (Meta învață ce leaduri sunt „bune” și arată reclama la profiluri similare):

| Status Meta | Semnificație |
|---|---|
| **Intake** | Lead primit, necontactat încă |
| **Qualified** | Contactat, pare interesat/valid |
| **Converted** | A devenit client (vânzare/rezervare) |
| **Lost** | Nu a răspuns / nu mai e interesat |
| **Not qualified** | Date invalide, spam, fals |

**Ideea:** când un agent mută un lead prin pipeline-ul CRM (contactat → calificat → vânzare/pierdut), CRM-ul ar putea scrie automat statusul corespunzător înapoi în coloana `lead_status` din Google Sheet (sau prin API-ul de Conversii direct) — asta ar ajuta Meta să optimizeze reclamele pe leaduri asemănătoare celor care chiar au cumpărat, nu doar pe cele care au completat formularul.

**Nu blochează** primirea leadurilor — doar optimizarea bugetului de reclame pe termen mediu. Rămâne pe TODO explicit, de discutat/proiectat când e prioritate.

---

## 7. Alte canale — status pe scurt

### jinfotours.ro (Aqua CMS) — ✅ gata
Cod adăugat direct în scriptul custom al lui Gigi (widget overlay, NU în tema Aqua — fără risc la update-uri de temă), `fetch()` paralel cu `keepalive:true` către `/api/leads/inbound`, după validarea existentă (inclusiv GDPR). Necesită CORS pe rută (aplicat).

### Jino chatbot „Carmen AI” (Cloudflare Worker) — ✅ gata
Server-to-server, fără CORS. Trimite în două situații: detectare automată telefon/email în conversație, și `save_lead` din formularul complet. Are logică specială în `route.ts`: mapare `interest_score` → prioritate, **actualizare** lead existent la duplicat (nu doar notă, ca la alte canale — trimiterile succesive din aceeași sesiune au date tot mai bune), transcript conversație salvat/reînnoit ca activitate „vie” pe lead.

### JinfoCruise.ro — ✅ gata, cu un fix de deployat
3 tipuri de eveniment (cerere, contact, rezervare), fiecare cu mapare proprie de câmpuri (buget, date călătorie, adulți/copii — doar pentru rezervare, unde datele sunt sigure). Panel UI dedicat „Detalii croazieră” pe pagina de lead. **Bug critic fixat în cod, dar nedeployat încă**: lookup-ul după `webhook_key` suprascria greșit `source`-ul (toate leadurile JinfoCruise ieșeau clasificate ca `website_form`, fiindcă folosesc aceeași cheie). Fix-ul dă prioritate lui `body.source` explicit — **trebuie deployat pe producție** (primul lead real de test a intrat greșit clasificat, corectat manual cu SQL doar pentru acel rând).

Detalii tehnice complete pentru toate 4 canalele: `claude/integrari-canale-status.md`.

---

## 8. Decizii tehnice cheie și raționamentul lor

- **`read-excel-file`/`write-excel-file` în loc de `xlsx` (SheetJS)** — pachetul popular are 2 vulnerabilități HIGH nepatch-uite (prototype pollution + ReDoS), inacceptabil pentru fișiere încărcate de utilizatori.
- **`google-auth-library` în loc de `googleapis`** — pachetul complet e mult mai greu pentru doar două apeluri de citire; `google-auth-library` + REST direct e suficient și oficial Google.
- **Parser propriu pentru exportul Facebook** — nu există librărie standard bună pentru XML SpreadsheetML redenumit `.xls`, iar encoding-ul UTF-16LE + delimitator TAB al `.csv`-ului nu e tratat de librăriile uzuale.
- **`CRON_SECRET` dedicat, nu `webhook_key`** — endpoint-ul de sync nu e un canal de leaduri, e un trigger; decizie explicită a lui Gigi pentru izolare de baza de date. Numele ales să coincidă cu convenția Vercel Cron pentru migrare fără fricțiune ulterioară.
- **Descoperire automată de file/campanii** (`listSheetTitles()` la fiecare rulare) — cerință explicită („atunci când apare o campanie nouă să tragă de acolo”), zero schimbări de cod la fiecare campanie nouă.
- **Deduplicare pe id-ul stabil Facebook**, nu pe telefon/email, pentru sync — id-ul e unic per lead Facebook și nu se schimbă niciodată; telefon/email rămân doar pentru avertismentul informativ de „posibil duplicat” (niciodată blocant).
- **Duplicatele nu sunt niciodată sărite automat** (nici la import fișier, nici la sync) — decizie explicită, consecventă pe tot fluxul de import: fiecare rând valid devine un lead, cu avertisment atașat dacă seamănă cu unul existent.
- **O singură logică de validare/mapare** (`import-fields.ts` → `import-parse.ts`) pentru: formular manual „Lead Nou”, import `.xlsx` propriu, import `.csv`/`.xls` Facebook, și sync live din Google Sheets — orice modificare a câmpurilor se face într-un singur loc.
- **Sync doar aditiv, niciodată nu șterge** — nicio acțiune din Sheet sau din CRM nu se propagă invers ca ștergere; simplu și predictibil.

---

## 9. Fișiere principale relevante (pentru orientare rapidă într-o sesiune nouă)

```
src/lib/leads/
  import-fields.ts         — sursa unică de adevăr a coloanelor de import
  import-parse.ts          — motor validare/mapare (matchHeaders, parseImportRow)
  import-facebook.ts        — recunoaștere + normalizare export Facebook (.csv/.xls) + mapFacebookRows()
  google-sheets.ts          — client minimal Google Sheets API v4 (JWT, doar-citire)

src/app/api/leads/
  inbound/route.ts          — endpoint comun pentru canalele online (website, chat, JinfoCruise)
  import/route.ts           — POST import fișier (.xlsx model sau Facebook .csv/.xls)
  import/template/route.ts  — GET model .xlsx descărcabil
  sync/facebook-sheets/route.ts — GET/POST sincronizare automată din Google Sheets (CRON_SECRET)

src/middleware.ts           — protecție auth globală + excepții pentru rute webhook/sync

scripts/
  test-import-parse.ts, test-import-roundtrip.ts, test-import-facebook.ts — teste manuale (npm run test:import)
  fixtures/facebook-sample.csv, facebook-sample.xls — fixturi reale (campania „Regii Franței”)

.env.example                — toate variabilele necesare, documentate
```

---

## 10. Cum se continuă lucrul

1. Confirmă/finalizează pinger-ul cron-job.org (interval ~10 min, `CRON_SECRET` în header sau `?key=`).
2. Deployează fix-ul de `source` de la JinfoCruise (secțiunea 7) — e în cod, doar nu urcat încă pe producție.
3. Când e prioritate: proiectează maparea status CRM → statusuri Meta (secțiunea 6).
4. Opțional, dacă apare nevoia: extinde recunoașterea de format și pe calea de upload manual `.xlsx` pentru fișiere descărcate direct din Google Sheets (limitare cunoscută, secțiunea 5).

Pentru istoricul complet al deciziilor și discuțiilor (inclusiv sfaturile de la Gemini despre API Conversii, verificate) — vezi documentele din proiectul Claude: `claude/integrari-canale-status.md` și `claude/import-leaduri.md`.
