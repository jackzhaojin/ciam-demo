CREATE TABLE claim_events (
    id              UUID PRIMARY KEY,
    claim_id        UUID NOT NULL,
    actor_user_id   UUID NOT NULL,
    event_type      VARCHAR(20) NOT NULL,
    note            TEXT,
    timestamp       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_claim_events_claim FOREIGN KEY (claim_id) REFERENCES claims (id)
);

CREATE INDEX idx_claim_events_claim_id ON claim_events (claim_id);
CREATE INDEX idx_claim_events_actor_user_id ON claim_events (actor_user_id);
