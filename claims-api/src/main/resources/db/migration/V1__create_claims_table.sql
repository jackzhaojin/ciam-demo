CREATE TABLE claims (
    id              UUID PRIMARY KEY,
    claim_number    VARCHAR(20) NOT NULL UNIQUE,
    user_id         UUID NOT NULL,
    organization_id UUID NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    type            VARCHAR(20) NOT NULL,
    description     TEXT,
    incident_date   DATE,
    filed_date      TIMESTAMP,
    amount          DECIMAL(15, 2),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_claims_organization_id ON claims (organization_id);
CREATE INDEX idx_claims_user_id ON claims (user_id);
CREATE INDEX idx_claims_status ON claims (status);
CREATE INDEX idx_claims_claim_number ON claims (claim_number);
