/**
 * src/lib/voice/phone.ts
 *
 * Normalizare telefon → format E.164 (+40...), cerut de Vapi/Twilio.
 *
 * Telefoanele din CRM vin în forme foarte diferite, în funcție de canal:
 *   - Facebook:        "+40728870869" (prefixul "p:" e deja curățat la import)
 *   - formular site:   "0728 870 869", "0728-870-869"
 *   - import manual:   "728870869", "0040728870869", "40728870869"
 * Pentru numerele românești rezultatul e mereu "+40" + 9 cifre. Numerele
 * străine sunt acceptate doar dacă vin deja cu "+" sau "00" (altfel nu putem
 * ști prefixul țării).
 */

/** Rezultatul normalizării — `null` dacă numărul nu poate fi sunat. */
export function normalizePhoneE164(raw: string | null | undefined): string | null {
  if (!raw) return null

  // Scoatem prefixul Facebook "p:" (dacă a scăpat), spații, cratime, puncte, paranteze
  let s = raw.trim().replace(/^p:/i, '').replace(/[\s\-.()/]/g, '')
  if (!s) return null

  // "00" internațional → "+"
  if (s.startsWith('00')) s = '+' + s.slice(2)

  if (s.startsWith('+')) {
    const digits = s.slice(1)
    if (!/^\d+$/.test(digits)) return null
    // România: +40 urmat exact de 9 cifre
    if (digits.startsWith('40')) {
      return /^40\d{9}$/.test(digits) ? '+' + digits : null
    }
    // Alte țări: E.164 permite 8–15 cifre
    return digits.length >= 8 && digits.length <= 15 ? '+' + digits : null
  }

  if (!/^\d+$/.test(s)) return null

  // "40728870869" (11 cifre, fără +)
  if (/^40\d{9}$/.test(s)) return '+' + s
  // "0728870869" (10 cifre, format național)
  if (/^0\d{9}$/.test(s)) return '+40' + s.slice(1)
  // "728870869" (9 cifre, fără 0 în față)
  if (/^[2-9]\d{8}$/.test(s)) return '+40' + s

  return null
}
