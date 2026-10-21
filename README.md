# GSD Coach

Webapp per la programmazione degli allenamenti della Scuola Calcio (GSD Rosignano Solvay 1922 — annata 2017 Pulcini).

## Funzioni

| Modulo | Cosa fa |
|---|---|
| **Libreria esercizi** | Esercizi categorizzati per area (tecnica, coordinativa, situazioni, tattica, finalizzazione, partita, portiere), fase della seduta e obiettivi. Filtri e ricerca. |
| **Campetto interattivo** | Editor SVG: giocatori (2 squadre, jolly, portiere, mister), pallone, coni, cinesini, paletti, sagome, cerchi, tavolette, ostacoli, porte. Frecce passaggio / movimento / conduzione / tiro, curve regolabili. Esercizio diviso in **step animati**: con “Freccia = movimento” disegnare una freccia sposta automaticamente giocatore o pallone allo step successivo. Funziona con mouse e touch. |
| **Builder seduta** | Attivazione → parte centrale → partita. Drag & drop dalla libreria (o pulsante “+” su tablet), minuti per esercizio, note, barra tempo per area, contesto del mesociclo. Salvataggio automatico. |
| **Stampa / PDF** | Scheda seduta A4 con scaletta oraria, campetti grandi, perché / come / coaching / rotazione. |
| **Planner** | Mesocicli con target % per area, microcicli settimanali (focus + obiettivi), calendario settimana, generazione automatica delle sedute pianificate. |
| **Report** | Sedute svolte, minuti, presenze, minuti per area e per obiettivo, andamento mensile, scostamento dal target del mesociclo, obiettivi mai allenati, sintesi automatica. Stampabile. |
| **Multi-mister** | Con Supabase: login, staff con approvazione dell’admin, libreria condivisa, aggiornamento in tempo reale. Senza Supabase funziona in locale nel browser. |

Libreria iniziale: FIN-01, FIN-02 (libreria Instagram), esercizi dagli Appunti del Direttore Tecnico, esercizi riadattati dalle 50 esercitazioni.

## Avvio locale

```bash
npm install
npm run dev
```

## Attivare il cloud (Supabase, gratuito)

1. Crea un progetto su [supabase.com](https://supabase.com) (region: Central EU).
2. **SQL Editor → New query**: incolla `supabase/schema.sql` → **Run**.
3. **Project Settings → API**: copia `Project URL` e `anon public key`.
4. Su GitHub: **Settings → Secrets and variables → Actions → New repository secret**
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. **Actions → Deploy → Run workflow** (o un nuovo push).
6. Il **primo account registrato diventa admin**; gli altri mister si registrano e l’admin li approva da *Account*.
7. Al primo accesso a database vuoto, la libreria iniziale viene caricata automaticamente.

In locale: copia `.env.example` in `.env.local` e compila.

## Deploy

GitHub Pages tramite `.github/workflows/deploy.yml` (Settings → Pages → Source: **GitHub Actions**).

## Stack

React + TypeScript + Vite · Zustand · Supabase · Recharts · SVG.
