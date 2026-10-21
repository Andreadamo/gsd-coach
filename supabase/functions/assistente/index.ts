// GSD Coach — Edge Function "assistente"
// Trasforma un comando scritto/dettato dall'allenatore in azioni strutturate (JSON)
// usando Gemini. NON salva nulla: l'app mostra l'anteprima e l'allenatore conferma.
//
// Secrets richiesti (Supabase → Edge Functions → Secrets):
//   GEMINI_API_KEY   chiave gratuita da https://aistudio.google.com
//   GEMINI_MODEL     (opzionale) default "gemini-3.8-flash"
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const AREE = ['tecnica', 'coordinativa', 'situazioni', 'tattica', 'possesso', 'finalizzazione', 'partita', 'portiere']
const FASI = ['attivazione', 'centrale', 'finale']
const PORTE = ['nessuna', 'porticine_2', 'porticine_4', 'porta_1', 'porte_2', 'mete']

const SCHEMA = {
  type: 'object',
  properties: {
    riepilogo: { type: 'string', description: 'Cosa farai, in 1-2 frasi in italiano' },
    dubbi: { type: 'array', items: { type: 'string' }, description: 'Punti ambigui o informazioni mancanti; vuoto se tutto chiaro' },
    azioni: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['aggiungi_esercizio', 'crea_seduta', 'imposta_microciclo'] },
          data: { type: 'string', description: 'YYYY-MM-DD della seduta o del lunedì della settimana; "" se non indicata' },
          fase: { type: 'string', enum: FASI },
          minuti: { type: 'integer' },
          nota: { type: 'string' },
          esercizio_codice: { type: 'string', description: 'Codice di un esercizio ESISTENTE in libreria (es. POS-03), oppure "" se va creato' },
          nuovo: {
            type: 'object',
            description: 'Solo se esercizio_codice è "": esercizio nuovo da creare',
            properties: {
              titolo: { type: 'string' },
              area: { type: 'string', enum: AREE },
              obiettivi: { type: 'array', items: { type: 'string' } },
              attaccanti: { type: 'integer' },
              difensori: { type: 'integer' },
              jolly: { type: 'integer' },
              portieri: { type: 'integer' },
              lunghezza_m: { type: 'integer' },
              larghezza_m: { type: 'integer' },
              porte: { type: 'string', enum: PORTE },
              perche: { type: 'string' },
              descrizione: { type: 'string' },
              regole: { type: 'string' },
              varianti: { type: 'string' },
              coaching: { type: 'string' },
            },
            required: ['titolo', 'area', 'obiettivi', 'attaccanti', 'difensori', 'jolly', 'portieri', 'lunghezza_m', 'larghezza_m', 'porte', 'perche', 'descrizione'],
          },
          seduta_titolo: { type: 'string' },
          seduta_obiettivo: { type: 'string' },
          seduta_durata: { type: 'integer' },
          micro_focus: { type: 'string' },
          micro_obiettivi: { type: 'array', items: { type: 'string' } },
        },
        required: ['tipo', 'data'],
      },
    },
  },
  required: ['riepilogo', 'dubbi', 'azioni'],
}

const ISTRUZIONI = `Sei l'assistente tecnico di un allenatore di Scuola Calcio italiana (gruppo predefinito: annata 2017, categoria Pulcini U10).
Ricevi un comando, spesso dettato a voce e quindi informale o sgrammaticato, e lo trasformi in AZIONI per l'app GSD Coach.
Rispondi SOLO con JSON valido conforme allo schema. Non inventare mai: se un dato manca e non è deducibile, mettilo in "dubbi".

COME INTERPRETARE IL PARLATO
- "5 contro 4", "5 vs 4", "5c4" = attaccanti 5, difensori 4. "+1", "più un jolly" = jolly 1. "con portiere" = portieri 1 (o 2 se due porte).
- "10 per 15", "10x15" = campo 10x15 metri: lunghezza_m = il numero maggiore, larghezza_m = il minore.
- "porticine", "porte piccole" = porticine_2 (porticine_4 se dice 4 porticine); "porta"/"in porta" = porta_1; "due porte" = porte_2; "meta" = mete; possesso senza porte = nessuna.
- Fase: "riscaldamento"/"attivazione"/"inizio" = attivazione; "parte centrale"/"centrale" = centrale; "partita"/"fine"/"defaticamento" = finale.
- Giorni ("giovedì", "domani", "martedì prossimo") vanno convertiti in data YYYY-MM-DD a partire da OGGI (indicato nel contesto). Un giorno della settimana senza altro = la prossima occorrenza da oggi (oggi incluso).
- Se non dice il giorno: usa la data della PROSSIMA seduta pianificata nel contesto; se non ce ne sono, data "" e aggiungi un dubbio.
- Minuti non detti: per esercizi esistenti usa la loro durata; per i nuovi 12-15 (attivazione 10).

ESERCIZI
- Se il comando corrisponde CHIARAMENTE a un esercizio della libreria (stesso tipo di gioco e numeri compatibili), usa esercizio_codice e lascia "nuovo" assente.
- Altrimenti crea "nuovo": titolo breve e chiaro (es. "Possesso 5 contro 4 in 10x15"), area corretta, obiettivi SOLO dalla lista fornita (2-4),
  perche (1 frase, perché si fa), descrizione (come si svolge, 2-4 frasi concrete con regole e punteggio), regole/varianti/coaching brevi.
- Adatta i contenuti all'età (Pulcini): regole semplici, niente concetti da prima squadra.
- Numeri plausibili: giocatori per squadra 0-12, campo 5-70 m. Non cambiare i numeri detti dall'allenatore.

PLANNER
- "crea una seduta ..." senza esercizi = azione crea_seduta (data, seduta_titolo, seduta_obiettivo, seduta_durata default 90).
- "la settimana X il focus è ..." = imposta_microciclo con data = lunedì di quella settimana, micro_focus, micro_obiettivi dalla lista.
- Più richieste nello stesso testo = più azioni, nell'ordine detto.`

function extractText(r: unknown): string | null {
  if (!r || typeof r !== 'object') return null
  const o = r as Record<string, unknown>
  if (typeof o.output_text === 'string') return o.output_text
  // generateContent (formato classico)
  const cand = (o.candidates as { content?: { parts?: { text?: string }[] } }[] | undefined)?.[0]?.content?.parts
  if (cand) return cand.map((p) => p.text ?? '').join('')
  // Interactions API: ultimo testo tra outputs/steps
  const texts: string[] = []
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') {
      const x = v as Record<string, unknown>
      if (typeof x.text === 'string' && (x.type === undefined || x.type === 'text')) texts.push(x.text)
      for (const k of ['outputs', 'output', 'steps', 'content', 'parts']) if (k in x) walk(x[k])
    }
  }
  walk(o)
  return texts.length ? texts[texts.length - 1] : null
}

function parseJson(t: string) {
  const s = t.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '')
  const a = s.indexOf('{')
  const b = s.lastIndexOf('}')
  return JSON.parse(a >= 0 && b > a ? s.slice(a, b + 1) : s)
}

async function callGemini(key: string, model: string, prompt: string) {
  // 1) Interactions API (attuale)
  let res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      system_instruction: ISTRUZIONI,
      input: prompt,
      generation_config: { temperature: 0.2 },
      response_format: { type: 'text', mime_type: 'application/json', schema: SCHEMA },
    }),
  })
  if (res.ok) return extractText(await res.json())
  const err1 = await res.text()
  // 2) generateContent (compatibilità)
  res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: ISTRUZIONI }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseJsonSchema: SCHEMA },
    }),
  })
  if (res.ok) return extractText(await res.json())
  throw new Error(`Gemini: ${res.status} ${(await res.text()).slice(0, 300)} | ${err1.slice(0, 300)}`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Metodo non consentito' }, 405)

  // solo mister approvati
  const auth = req.headers.get('Authorization') ?? ''
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  })
  const { data: ok, error: authErr } = await sb.rpc('is_member')
  if (authErr || ok !== true) return json({ error: 'Accesso riservato ai mister approvati.' }, 403)

  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return json({ error: 'Chiave Gemini non configurata (secret GEMINI_API_KEY).' }, 500)
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-3.8-flash'

  let body: { testo?: string; contesto?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Richiesta non valida' }, 400)
  }
  const testo = (body.testo ?? '').toString().slice(0, 6000).trim()
  const contesto = (body.contesto ?? '').toString().slice(0, 30000)
  if (!testo) return json({ error: 'Testo vuoto' }, 400)

  const prompt = `CONTESTO DELL'APP\n${contesto}\n\nCOMANDO DELL'ALLENATORE\n"""${testo}"""`
  try {
    let out = await callGemini(key, model, prompt)
    let parsed
    try {
      parsed = parseJson(out ?? '')
    } catch {
      // secondo tentativo, più rigido
      out = await callGemini(key, model, prompt + '\n\nRISPONDI SOLO CON IL JSON, SENZA ALTRO TESTO.')
      parsed = parseJson(out ?? '')
    }
    return json({ risultato: parsed, modello: model })
  } catch (e) {
    return json({ error: (e as Error).message }, 502)
  }
})
