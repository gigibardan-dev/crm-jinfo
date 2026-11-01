/**
 * src/lib/voice/vapi.ts
 *
 * Client minimal pentru API-ul Vapi (https://api.vapi.ai) — DOAR pe server.
 *
 * Folosim un singur endpoint: POST /call (pornește un apel telefonic
 * outbound de pe numărul Twilio importat în Vapi). Cheia privată
 * (VAPI_API_KEY) nu ajunge niciodată în browser.
 *
 * Webhook-ul CRM-ului e setat per apel prin `assistantOverrides.server`, deci
 * nu trebuie configurat „Server URL" în fiecare asistent din dashboard —
 * orice asistent nou duplicat funcționează automat cu CRM-ul. Secretul
 * VAPI_WEBHOOK_SECRET e trimis înapoi de Vapi în headerul `x-vapi-secret`
 * și verificat în /api/voice/vapi-webhook.
 *
 * Variabile de mediu necesare:
 *   VAPI_API_KEY          — cheia PRIVATĂ din Vapi (Organization → API Keys)
 *   VAPI_PHONE_NUMBER_ID  — ID-ul numărului Twilio din Vapi (Phone Numbers)
 *   VAPI_WEBHOOK_SECRET   — un șir aleator lung, ales de noi
 *   VAPI_WEBHOOK_URL      — ex: https://crm-jinfo.vercel.app/api/voice/vapi-webhook
 */

const VAPI_BASE_URL = 'https://api.vapi.ai'

export type StartCallInput = {
  assistantId: string
  phoneNumber: string // E.164
  customerName?: string | null
  /** Ajunge înapoi în webhook (call.assistantOverrides.metadata) */
  metadata: { ai_call_id: string; lead_id: string; campaign_id: string | null }
}

export type StartCallResult =
  | { ok: true; vapiCallId: string }
  | { ok: false; error: string }

/** Verifică dacă variabilele de mediu Vapi sunt setate (afișat în UI ca eroare clară). */
export function getVapiConfigError(): string | null {
  const missing = ['VAPI_API_KEY', 'VAPI_PHONE_NUMBER_ID', 'VAPI_WEBHOOK_SECRET', 'VAPI_WEBHOOK_URL']
    .filter((k) => !process.env[k])
  return missing.length ? `Lipsesc variabilele de mediu: ${missing.join(', ')}` : null
}

export async function startVapiCall(input: StartCallInput): Promise<StartCallResult> {
  const configError = getVapiConfigError()
  if (configError) return { ok: false, error: configError }

  const body = {
    assistantId: input.assistantId,
    phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
    customer: {
      number: input.phoneNumber,
      ...(input.customerName ? { name: input.customerName.slice(0, 40) } : {}),
    },
    assistantOverrides: {
      server: {
        url: process.env.VAPI_WEBHOOK_URL,
        headers: { 'x-vapi-secret': process.env.VAPI_WEBHOOK_SECRET },
      },
      // Doar evenimentele de care avem nevoie — mai puține requesturi spre Vercel
      serverMessages: ['status-update', 'end-of-call-report'],
      metadata: input.metadata,
    },
  }

  try {
    const res = await fetch(`${VAPI_BASE_URL}/call`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })

    const text = await res.text()
    let json: Record<string, unknown> = {}
    try {
      json = JSON.parse(text)
    } catch {
      // răspuns non-JSON — îl raportăm ca text brut mai jos
    }

    if (!res.ok) {
      const msg = Array.isArray(json.message) ? json.message.join('; ') : (json.message as string) || text
      return { ok: false, error: `Vapi ${res.status}: ${String(msg).slice(0, 500)}` }
    }

    const id = json.id as string | undefined
    if (!id) return { ok: false, error: 'Vapi nu a returnat un ID de apel' }
    return { ok: true, vapiCallId: id }
  } catch (err) {
    return { ok: false, error: `Eroare de rețea către Vapi: ${(err as Error).message}` }
  }
}

/**
 * Verifică un asistent Vapi după ID (folosit la salvarea unei campanii în
 * Setări, ca să prindem din prima un ID greșit / copiat incomplet).
 */
export async function getVapiAssistant(
  assistantId: string
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  if (!process.env.VAPI_API_KEY) return { ok: false, error: 'Lipsește VAPI_API_KEY' }
  try {
    const res = await fetch(`${VAPI_BASE_URL}/assistant/${encodeURIComponent(assistantId)}`, {
      headers: { Authorization: `Bearer ${process.env.VAPI_API_KEY}` },
      cache: 'no-store',
    })
    if (res.status === 404 || res.status === 400) return { ok: false, error: 'Asistentul nu există în Vapi (verifică ID-ul)' }
    if (!res.ok) return { ok: false, error: `Vapi ${res.status}` }
    const json = (await res.json()) as { name?: string }
    return { ok: true, name: json.name || '(fără nume)' }
  } catch (err) {
    return { ok: false, error: `Eroare de rețea către Vapi: ${(err as Error).message}` }
  }
}
