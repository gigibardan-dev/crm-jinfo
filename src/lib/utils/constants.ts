// Lost reasons dropdown options
export const LOST_REASONS = [
  'Preț prea mare',
  'A ales altă agenție',
  'A renunțat la călătorie',
  'Nu răspunde / Ghost',
  'Date indisponibile',
  'Destinație indisponibilă',
  'Cerințe imposibil de îndeplinit',
  'Altul',
] as const

// Trip types
export const TRIP_TYPES = [
  { value: 'sejur', label: 'Sejur' },
  { value: 'circuit', label: 'Circuit' },
  { value: 'croaziera', label: 'Croazieră' },
  { value: 'city_break', label: 'City Break' },
  { value: 'all_inclusive', label: 'All Inclusive' },
  { value: 'excursie', label: 'Excursie' },
  { value: 'honeymoon', label: 'Lună de Miere' },
  { value: 'ski', label: 'Ski' },
  { value: 'other', label: 'Altul' },
] as const

// Priority config
export const PRIORITY_CONFIG = {
  low: { label: 'Scăzut', color: '#94a3b8', bgColor: '#f1f5f9' },
  medium: { label: 'Mediu', color: '#f59e0b', bgColor: '#fffbeb' },
  high: { label: 'Ridicat', color: '#ef4444', bgColor: '#fef2f2' },
  urgent: { label: 'Urgent', color: '#dc2626', bgColor: '#fee2e2' },
} as const

// Source icons
export const SOURCE_ICONS: Record<string, string> = {
  facebook: '📘',
  tiktok: '🎵',
  google: '🔍',
  website_form: '🌐',
  jinfocruise: '🚢',
  chat_ai: '🤖',
  email: '✉️',
  walk_in: '🏢',
  phone: '📞',
  referral: '🤝',
  other: '📌',
}

// Sidebar navigation
export const NAV_ITEMS = {
  main: [
    { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
    { href: '/leads/inbox', label: 'Inbox', icon: 'Inbox', roles: ['admin', 'manager'], badge: true },
    { href: '/leads', label: 'Pipeline', icon: 'Kanban' },
    { href: '/leads/new', label: 'Lead Nou', icon: 'PlusCircle' },
  ],
  management: [
    { href: '/agents', label: 'Agenți', icon: 'Users', roles: ['admin', 'manager'] },
    { href: '/reports', label: 'Rapoarte', icon: 'BarChart3', roles: ['admin', 'manager'] },
  ],
  admin: [
    { href: '/settings', label: 'Setări', icon: 'Settings', roles: ['admin'] },
  ],
} as const

// Date format constants
export const DATE_FORMAT = 'dd MMM yyyy'
export const DATETIME_FORMAT = 'dd MMM yyyy, HH:mm'
export const TIME_FORMAT = 'HH:mm'
