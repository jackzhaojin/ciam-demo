-- V3: Add claim_notes, claim_attachments, and actor_display_name for v1.2

-- claim_notes table
CREATE TABLE claim_notes (
    id                   UUID PRIMARY KEY,
    claim_id             UUID NOT NULL,
    author_user_id       UUID NOT NULL,
    author_display_name  VARCHAR(255) NOT NULL,
    content              TEXT NOT NULL,
    created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_claim_notes_claim FOREIGN KEY (claim_id) REFERENCES claims(id)
);
CREATE INDEX idx_claim_notes_claim_id ON claim_notes(claim_id);

-- claim_attachments metadata table
CREATE TABLE claim_attachments (
    id                       UUID PRIMARY KEY,
    claim_id                 UUID NOT NULL,
    filename                 VARCHAR(500) NOT NULL,
    file_size_bytes          BIGINT NOT NULL,
    mime_type                VARCHAR(100) NOT NULL,
    uploaded_by_user_id      UUID NOT NULL,
    uploaded_by_display_name VARCHAR(255) NOT NULL,
    created_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_claim_attachments_claim FOREIGN KEY (claim_id) REFERENCES claims(id)
);
CREATE INDEX idx_claim_attachments_claim_id ON claim_attachments(claim_id);

-- Add actor_display_name to claim_events for rich timeline
ALTER TABLE claim_events ADD COLUMN actor_display_name VARCHAR(255);
