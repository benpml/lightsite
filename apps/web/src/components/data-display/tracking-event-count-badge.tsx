import { Badge } from "@/components/ui/badge"

export function TrackingEventCountBadge({ count }: { count: number }) {
  return (
    <Badge variant="outline" className="border-border text-foreground">
      <span className="size-1.5 rounded-full bg-success" />
      {count.toLocaleString()} {count === 1 ? "Event" : "Events"}
    </Badge>
  )
}
