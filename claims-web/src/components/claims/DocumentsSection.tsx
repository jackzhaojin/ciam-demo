"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatFileSize, formatRelativeTime } from "@/lib/format";
import { FileText, Image, File as FileIcon } from "lucide-react";
import type { ClaimAttachment } from "@/types/claim";

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <Image className="h-4 w-4" />;
  if (mimeType.includes("pdf") || mimeType.includes("text")) return <FileText className="h-4 w-4" />;
  return <FileIcon className="h-4 w-4" />;
}

export function DocumentsSection({
  claimId,
  initialAttachments,
  canAdd,
}: {
  claimId: string;
  initialAttachments: ClaimAttachment[];
  canAdd: boolean;
}) {
  const [attachments, setAttachments] = useState<ClaimAttachment[]>(initialAttachments);
  const [showForm, setShowForm] = useState(false);
  const [filename, setFilename] = useState("");
  const [mimeType, setMimeType] = useState("application/pdf");
  const [fileSize, setFileSize] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!filename.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/claims/${claimId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: filename.trim(),
          mimeType,
          fileSizeBytes: parseInt(fileSize || "0", 10),
        }),
      });
      if (response.ok) {
        const attachment = await response.json();
        setAttachments((prev) => [attachment, ...prev]);
        setFilename("");
        setFileSize("");
        setShowForm(false);
        toast.success("Document added");
      } else {
        toast.error("Failed to add document");
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
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Documents ({attachments.length})
          </CardTitle>
          {canAdd && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(!showForm)}
            >
              {showForm ? "Cancel" : "Add Document"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showForm && (
          <div className="space-y-2 pb-3 border-b">
            <Input
              placeholder="Filename (e.g., policy-document.pdf)"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="MIME type"
                value={mimeType}
                onChange={(e) => setMimeType(e.target.value)}
              />
              <Input
                placeholder="File size (bytes)"
                type="number"
                value={fileSize}
                onChange={(e) => setFileSize(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={loading || !filename.trim()}
            >
              {loading ? "Adding..." : "Add"}
            </Button>
          </div>
        )}

        {attachments.length === 0 && (
          <p className="text-sm text-muted-foreground">No documents attached.</p>
        )}

        {attachments.map((att) => (
          <div key={att.id} className="flex items-center gap-3 py-1">
            {getFileIcon(att.mimeType)}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{att.filename}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(att.fileSizeBytes)} &middot; {att.uploadedByDisplayName} &middot;{" "}
                {formatRelativeTime(att.createdAt)}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
