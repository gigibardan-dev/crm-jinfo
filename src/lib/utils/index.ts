import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format } from 'date-fns'
import { ro } from 'date-fns/locale'

// Tailwind class merge helper
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format relative time in Romanian ("acum 2 ore")
export function timeAgo(date: string | Date): string {
  return formatDistanceToNow(new Date(date), {
    addSuffix: true,
    locale: ro,
  })
}

// Format date in Romanian
export function formatDate(date: string | Date, fmt: string = 'dd MMM yyyy'): string {
  return format(new Date(date), fmt, { locale: ro })
}

// Format datetime
export function formatDateTime(date: string | Date): string {
  return format(new Date(date), 'dd MMM yyyy, HH:mm', { locale: ro })
}

// Format phone number for display
export function formatPhone(phone: string | null): string {
  if (!phone) return '—'
  // Romanian phone: 07xx.xxx.xxx
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    return `${cleaned.slice(0, 4)}.${cleaned.slice(4, 7)}.${cleaned.slice(7)}`
  }
  return phone
}

// Get initials from full name
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// Build full name from first + last
export function fullName(firstName: string | null, lastName: string | null): string {
  return [firstName, lastName].filter(Boolean).join(' ') || 'Fără nume'
}

// Truncate text
export function truncate(text: string, length: number = 100): string {
  if (text.length <= length) return text
  return text.slice(0, length) + '...'
}

// Format travel dates range
export function formatTravelDates(from: string | null, to: string | null): string {
  if (!from) return '—'
  const fromStr = formatDate(from, 'dd MMM')
  if (!to) return fromStr
  const toStr = formatDate(to, 'dd MMM yyyy')
  return `${fromStr} – ${toStr}`
}

// Format travelers count "2 adulți + 1 copil"
export function formatTravelers(adults: number, children: number): string {
  const parts: string[] = []
  if (adults > 0) {
    parts.push(`${adults} ${adults === 1 ? 'adult' : 'adulți'}`)
  }
  if (children > 0) {
    parts.push(`${children} ${children === 1 ? 'copil' : 'copii'}`)
  }
  return parts.join(' + ') || '—'
}
