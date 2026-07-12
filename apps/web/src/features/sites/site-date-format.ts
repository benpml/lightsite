const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  month: "short",
  year: "numeric",
})

export function formatRelativeTime(value: string | null | undefined) {
  if (!value) {
    return "now"
  }

  const timestamp = Date.parse(value)

  if (!Number.isFinite(timestamp)) {
    return value
  }

  const elapsedMs = Math.max(0, Date.now() - timestamp)
  const elapsedMinutes = Math.floor(elapsedMs / 60_000)

  if (elapsedMinutes < 1) {
    return "now"
  }

  const units = [
    { label: "y", minutes: 60 * 24 * 365 },
    { label: "mo", minutes: 60 * 24 * 30 },
    { label: "w", minutes: 60 * 24 * 7 },
    { label: "d", minutes: 60 * 24 },
    { label: "h", minutes: 60 },
    { label: "m", minutes: 1 },
  ] as const
  const unit = units.find((item) => elapsedMinutes >= item.minutes) ?? units[units.length - 1]

  return `${Math.floor(elapsedMinutes / unit.minutes)}${unit.label} ago`
}

export function formatFullDateTime(value: string | null | undefined) {
  if (!value) {
    return "Not yet"
  }

  const timestamp = Date.parse(value)

  if (!Number.isFinite(timestamp)) {
    return value
  }

  return fullDateFormatter.format(timestamp)
}
