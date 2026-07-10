CREATE TABLE IF NOT EXISTS scanner_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    pairing_token VARCHAR(120) NOT NULL UNIQUE,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_scanner_sessions_status
        CHECK (status IN ('ACTIVE', 'EXPIRED'))
);

CREATE TABLE IF NOT EXISTS scanner_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scanner_session_id UUID NOT NULL REFERENCES scanner_sessions(id) ON UPDATE CASCADE ON DELETE CASCADE,
    code VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_scanner_scans_code_not_empty
        CHECK (LENGTH(TRIM(code)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_scanner_sessions_seller_id
ON scanner_sessions(seller_id);

CREATE INDEX IF NOT EXISTS idx_scanner_sessions_pairing_token
ON scanner_sessions(pairing_token);

CREATE INDEX IF NOT EXISTS idx_scanner_sessions_status
ON scanner_sessions(status);

CREATE INDEX IF NOT EXISTS idx_scanner_sessions_expires_at
ON scanner_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_scanner_scans_session_id
ON scanner_scans(scanner_session_id);

CREATE INDEX IF NOT EXISTS idx_scanner_scans_created_at
ON scanner_scans(created_at);

DROP TRIGGER IF EXISTS trg_scanner_sessions_updated_at
ON scanner_sessions;

CREATE TRIGGER trg_scanner_sessions_updated_at
BEFORE UPDATE ON scanner_sessions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

ALTER TABLE scanner_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scanner_scans ENABLE ROW LEVEL SECURITY;
