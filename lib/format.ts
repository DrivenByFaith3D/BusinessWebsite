// Server components render in the deployment's timezone (UTC on Vercel), which
// made timestamps show 4 hours ahead of local. The shop operates in New Jersey,
// so we format server-rendered dates in Eastern time for a consistent, correct
// display. (Client components already use the viewer's local timezone.)
const TZ = 'America/New_York'

export function formatDateTime(d: Date | string): string {
  return new Date(d).toLocaleString('en-US', {
    timeZone: TZ,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-US', {
    timeZone: TZ,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
