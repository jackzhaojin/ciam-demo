"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/format";
import type { ClaimNote } from "@/types/claim";

export function NotesThread({
  claimId,
  initialNotes,
  canAddNote,
}: {
  claimId: string;
  initialNotes: ClaimNote[];
  canAddNote: boolean;
}) {
  const [notes, setNotes] = useState<ClaimNote[]>(initialNotes);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/claims/${claimId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      if (response.ok) {
        const note = await response.json();
        setNotes((prev) => [...prev, note]);
        setContent("");
        toast.success("Note added");
      } else {
        toast.error("Failed to add note");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          Notes ({notes.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {notes.length === 0 && (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        )}
        {notes.map((note) => (
          <div key={note.id} className="border-l-2 border-muted pl-3 py-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{note.authorDisplayName}</span>
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(note.createdAt)}
              </span>
            </div>
            <p className="text-sm mt-1">{note.content}</p>
          </div>
        ))}

        {canAddNote && (
          <div className="space-y-2 pt-2 border-t">
            <Textarea
              placeholder="Add a note..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
            />
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={loading || !content.trim()}
            >
              {loading ? "Adding..." : "Add Note"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
