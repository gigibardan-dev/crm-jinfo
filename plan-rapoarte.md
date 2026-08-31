# Secțiunea de Rapoarte — Viziune și Plan

_Document de proiectare pentru `/reports` din JinfoTours CRM. Scris odată cu prima felie funcțională (Faza 1, deja implementată — vezi secțiunea "Ce e gata acum"). Restul e roadmap: fiecare fază ulterioară e opțională și poate fi reprioritizată oricând._

## De ce o secțiune de rapoarte "masivă"

Restul CRM-ului răspunde la "ce trebuie să fac acum" (Pipeline, Inbox, remindere, alerte stagnante). Rapoartele răspund la o întrebare diferită și la fel de importantă: "cum merge afacerea, per canal, per agent, per perioadă — și unde pierdem bani/timp". Sunt cititorii tipici:

- **Admin** — vrea imaginea de ansamblu: venituri, conversie per sursă (unde merită bugetul de marketing), performanță per agent (cine are nevoie de coaching), viteza pipeline-ului.
- **Manager** — aceleași întrebări, de obicei la nivel de echipă sau de o anumită sursă/perioadă.
- **Agent** — nu are acces la /reports în forma actuală (gate admin/manager, ca și acum). Dacă apare cerere pe viitor, un "Rapoartele mele" restrâns la propriile leaduri e o extensie naturală, nu o schimbare de arhitectură.

## Ce e gata acum — Faza 1

Implementată în acest ciclu de lucru: `src/app/(app)/reports/page.tsx` + `src/components/reports/*` + `src/lib/utils/reports.ts`.

- **Filtre globale**: interval de date (manual sau shortcut "Lună + An", exact pattern-ul din Pipeline) + agent (restrânge tot raportul la un singur agent). Implicit: ultimele 30 de zile.
- **KPI-uri sumar** (6 cadre): leaduri noi în interval, rată de conversie (câștigate / (câștigate+pierdute)), valoare totală câștigată (EUR), timp mediu până la primul răspuns, leaduri nealocate acum (instantaneu curent, nu filtrat de interval — la fel ca pe Dashboard), leaduri stagnante acum (idem).
- **Evoluție leaduri în timp** — grafic de arie, o singură serie, granularitate automată (zi dacă intervalul ≤31 zile, săptămână ≤180, altfel lună), cu hover/tooltip.
- **Distribuție pe etape de pipeline** — bar chart orizontal, o bară per etapă (status curent al lead-urilor din interval), rampă ordinală (aceeași nuanță, trepte diferite de la etapă la etapă, nu culori distincte pe fiecare).
- **Performanță pe agent** — bar chart (valoare câștigată per agent) + tabel cu alocate/câștigate/rată conversie/timp răspuns, sortat descrescător după valoare.
- **Performanță pe sursă** — bar chart (volum) + tabel cu alocate/câștigate/rată conversie.
- **Motive de pierdere** — bar chart cu frecvența fiecărui motiv (`lost_reason`), pt. leadurile pierdute din interval.
- **Export CSV** — descarcă exact setul de leaduri din selecția curentă (nume, contact, sursă, status, agent, valoare, motiv pierdere), cu BOM UTF-8 pt. Excel.

### Notă tehnică — de ce fără librărie de grafice

Toate graficele sunt SVG/HTML simplu, construite manual (fără recharts/d3/etc.), urmând skill-ul intern de data-viz: un singur hue (albastru) pentru orice comparație de magnitudine (bare, arie) — niciodată o culoare per categorie, ceea ce elimină din start orice problemă de daltonism sau paletă supraîncărcată. Excepție: distribuția pe pipeline folosește o rampă *ordinală* (aceeași familie de albastru, trepte diferite) pentru că etapele au o ordine intrinsecă. Avantaj practic: zero dependențe noi, bundle mic, control total pe dark mode (token-uri CSS `--rpt-*` în `globals.css`, comutate prin clasa `.dark` existentă).

### Notă tehnică — de ce agregare client-side

Query-ul curent aduce lead-urile din interval (+ agent opțional) cu un singur `select`, iar toate agregările (KPI, trend, per-agent, per-sursă, motive pierdere) rulează în browser, ca funcții pure în `src/lib/utils/reports.ts`. E simplu și suficient de rapid la volumul actual. Dacă baza de leaduri crește mult (mii pe lună) și paginile de rapoarte devin lente, următorul pas natural e un RPC/view Postgres care face agregarea în DB (vezi Faza 4 mai jos) — nu o rescriere, doar o mutare a logicii de calcul din `reports.ts` într-o funcție SQL, păstrând aceleași forme de output.

## Roadmap — fazele viitoare

Ordinea de mai jos e o recomandare, nu o obligație — orice fază se poate implementa separat, la cerere.

### Faza 2 — Financiar aprofundat

- Valoare câștigată defalcată EUR **și** RON (`total_amount_ron`), plus comisioane (`commission_eur`/`commission_ron`) — utile pt. raportare internă către contabilitate.
- Valoare medie per tranzacție câștigată (deal size mediu), per agent și per sursă.
- Grafic "Venit pe lună" (ultimele 12 luni) — util pt. sezonalitate an-la-an.
- Comparație perioadă-vs-perioadă (ex. luna asta vs. luna trecută, sau vs. aceeași lună anul trecut) — un `delta` pe fiecare KPI tile, cu semn și culoare (verde/roșu) conform contractului de "stat tile" din skill-ul de data-viz.

### Faza 3 — Destinații și sezonalitate

- Top destinații cerute (din `leads.destination`, grupare fuzzy pe text — necesită curățare/normalizare, ex. "Antalya" vs "antalya" vs "Antalya, Turcia").
- Tip de călătorie (`trip_type`) — distribuție (sejur/circuit/croazieră/etc.) și conversie per tip.
- Calendar sezonalitate: câte leaduri cer călătorii în fiecare lună a anului (din `travel_date_from`), util pt. planificare ofertă/staffing.
- Dimensiune grup mediu (`nr_adults` + `nr_children`) per sursă/destinație.

### Faza 4 — Viteză și eficiență operațională

- **Timp mediu în fiecare etapă a pipeline-ului** — cât stă un lead "Contactat" înainte să treacă la "Ofertă Trimisă" etc. Necesită o sursă de adevăr pt. tranzițiile de status (azi `lead_activities` de tip `status_change` conține asta în `content`/`metadata`, dar ar merita o coloană structurată dedicată — ex. `metadata: { from_status, to_status }` — dacă nu există deja consecvent).
- **Timp mediu până la câștigare** (`created_at` → momentul marcării "won") — indicator de ciclu de vânzare.
- Rată de reactivare — leaduri stagnante care redevin active după o alertă (măsoară eficiența alertelor din `alerte-lead-stagnant.md`).
- Impact al alocării automate round-robin — comparație rată conversie/timp răspuns pe leaduri alocate automat vs. manual (`eligible_for_auto_assign` + prezența unei activități de tip `assignment` cu `user_id IS NULL`, semnătura alocării automate — vezi migrarea 005).
- Dacă volumul crește: mutare agregări grele (per-etapă, per-lună pe ani întregi) într-un RPC Postgres (`get_pipeline_velocity(from, to)` etc.) în loc de calcul client-side pe tot setul de leaduri.

### Faza 5 — Rapoarte programate & livrare

- Export CSV programat (ex. "trimite-mi rezumatul lunii pe email în prima zi a lunii următoare") — necesită un job/cron server-side (Vercel Cron sau Supabase Edge Function), nu doar UI.
- Rezumat săptămânal automat trimis ca notificare in-app (reutilizează tabelul `notifications` existent) — "Săptămâna asta: X leaduri noi, Y câștigate, valoare Z EUR".
- Rapoarte salvate/fixate — un admin salvează o combinație de filtre ("Q1 2026, doar Facebook Ads") ca un preset revizitabil dintr-un dropdown, fără să retasteze filtrele.

### Faza 6 — Comparații și segmentare avansată

- Comparație side-by-side a doi agenți sau două surse (mic multiples — vezi skill-ul de data-viz, "small multiples" e pattern-ul recomandat pentru >2 serii comparate, nu un grafic cu multe culori suprapuse).
- Filtru combinat sursă+agent+status simultan (azi doar agent e disponibil ca filtru global pe /reports; Pipeline are deja sursă/status/prioritate — s-ar putea reutiliza `PipelineFilterBar` sau un super-set al lui).
- Cohortă: leaduri create într-o lună, urmărite în timp (câte din cohorta lui ianuarie sunt încă active/câștigate/pierdute 30/60/90 zile mai târziu).

## Note pe modelul de date (ce e deja disponibil vs. ce ar trebui adăugat)

Deja disponibil și folosit din Faza 1: `leads.status/source/priority/assigned_to/created_at/first_response_at/won_value/lost_reason`, `pipeline_stages` (ordine + culoare), `lead_sources`, `profiles`.

Disponibil dar nefolosit încă (Faza 2+): `leads.total_amount_ron/commission_eur/commission_ron/order_number/contract_number/invoice_number` (migrarea 003), `leads.destination/trip_type/travel_date_from/nr_adults/nr_children` (Faza 3), `lead_activities` pt. tranziții de status (Faza 4), `leads.eligible_for_auto_assign` (Faza 4, impact round-robin).

Ar merita adăugat pe viitor, dacă Faza 4/6 devin prioritare: o coloană structurată pt. tranziții de status în `lead_activities.metadata` (dacă nu e deja populată consecvent — de verificat), și eventual un câmp `cost` pe `lead_sources` (cost per lead sau buget lunar per canal) ca să se poată calcula ROI real per sursă, nu doar volum/conversie.

## Cum se extinde codul existent

Structura din Faza 1 e gândită să fie extinsă, nu rescrisă:

- `src/lib/utils/reports.ts` — orice KPI/agregare nouă e o funcție pură nouă aici, testabilă independent de UI (ia `ReportLead[]` + eventual lookup-uri, întoarce date gata de randat).
- `src/components/reports/` — `HBarChart` (magnitudine, single-hue) și `TrendAreaChart` (serie unică în timp) acoperă majoritatea nevoilor din fazele 2-4. Un chart nou real ar fi doar pt. cohortă (Faza 6) sau heatmap sezonalitate (Faza 3) — ambele au loc de precedent în skill-ul de data-viz (`references/marks-and-anatomy.md`, secțiunea heatmap).
- Paginare/agregare server-side (dacă devine necesară): un RPC Postgres nou per raport greu, apelat din pagină exact ca un `select` obișnuit — nu schimbă forma componentelor de UI, doar sursa datelor din `reports.ts`.