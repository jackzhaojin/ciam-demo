"use client";

import { useState } from "react";
import {
  FileText,
  Send,
  Search,
  CheckCircle,
  XCircle,
  Archive,
  Edit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/format";
import type { ClaimEvent } from "@/types/claim";

const eventConfig: Record<string, { icon: typeof FileText; color: string }> = {
  CREATED: { icon: FileText, color: "text-gray-500" },
  UPDATED: { icon: Edit, color: "text-blue-500" },
  SUBMITTED: { icon: Send, color: "text-blue-500" },
  REVIEWED: { icon: Search, color: "text-yellow-600" },
  APPROVED: { icon: CheckCircle, color: "text-green-500" },
  DENIED: { icon: XCircle, color: "text-red-500" },
  CLOSED: { icon: Archive, color: "text-gray-500" },
};

const COLLAPSED_COUNT = 5;

export function ClaimTimeline({ events }: { events: ClaimEvent[] }) {
  const [expanded, setExpanded] = useState(false);

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No events recorded yet.</p>;
  }

  const displayEvents = expanded ? events : events.slice(-COLLAPSED_COUNT);
  const hiddenCount = events.length - COLLAPSED_COUNT;

  return (
    <div className="space-y-4">
      {!expanded && hiddenCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => setExpanded(true)}
        >
          Show all {events.length} events
        </Button>
      )}

      {displayEvents.map((event, index) => {
        const config = eventConfig[event.eventType?.toUpperCase()] ?? eventConfig.CREATED;
        const Icon = config.icon;
        const displayName = event.actorDisplayName ?? "System";

        return (
          <div key={event.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`mt-0.5 ${config.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              {index < displayEvents.length - 1 && (
                <div className="w-px flex-1 bg-border" />
              )}
            </div>
            <div className="pb-4">
              <p className="text-sm font-medium">
                {event.eventType.replace(/_/g, " ")}
              </p>
              {event.note && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {event.note}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {displayName} &middot; {formatRelativeTime(event.timestamp)}
              </p>
            </div>
          </div>
        );
      })}

      {expanded && events.length > COLLAPSED_COUNT && (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => setExpanded(false)}
        >
          Show less
        </Button>
      )}
    </div>
  );
}
