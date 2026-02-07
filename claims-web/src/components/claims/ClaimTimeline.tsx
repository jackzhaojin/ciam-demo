import type { ClaimEvent } from "@/types/claim";

export function ClaimTimeline({ events }: { events: ClaimEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No events recorded yet.</p>;
  }

  return (
    <div className="space-y-4">
      {events.map((event, index) => (
        <div key={event.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="h-3 w-3 rounded-full bg-primary mt-1.5" />
            {index < events.length - 1 && (
              <div className="w-px flex-1 bg-border" />
            )}
          </div>
          <div className="pb-4">
            <p className="text-sm font-medium">{event.eventType.replace(/_/g, " ")}</p>
            {event.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{event.description}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {event.performedByName ?? event.performedBy} &middot;{" "}
              {new Date(event.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
