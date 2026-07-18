// Order attachments live in private blob storage. Render them through the
// authorized /api/files gateway rather than linking the blob URL directly.
export function fileProxy(url: string | null | undefined): string {
  if (!url) return ''
  return `/api/files?u=${encodeURIComponent(url)}`
}
