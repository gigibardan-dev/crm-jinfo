/**
 * src/lib/leads/priority.ts
 *
 * Mapare scor de interes → prioritate CRM, folosită la ingest-ul de
 * leaduri din chat AI (Carmen). "urgent" rămâne mereu setat manual de agent,
 * nu e produs automat de acest scor.
 * Extras din src/app/api/leads/inbound/route.ts.
 */

export function scoreToPriority(score: number): 'low' | 'medium' | 'high' {
  if (score >= 60) return 'high'
  if (score >= 30) return 'medium'
  return 'low'
}
