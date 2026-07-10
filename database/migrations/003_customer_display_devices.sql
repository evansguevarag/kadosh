CREATE TABLE IF NOT EXISTS customer_display_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_name VARCHAR(120) NOT NULL,
    device_token_hash TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_seen_at TIMESTAMPTZ NULL,
    paired_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_display_pairing_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_hash TEXT NOT NULL,
    device_name VARCHAR(120) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NULL,
    created_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    paired_device_id UUID NULL REFERENCES customer_display_devices(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_display_devices_is_active
ON customer_display_devices(is_active);

CREATE INDEX IF NOT EXISTS idx_customer_display_devices_last_seen_at
ON customer_display_devices(last_seen_at);

CREATE INDEX IF NOT EXISTS idx_customer_display_pairing_codes_expires_at
ON customer_display_pairing_codes(expires_at);

CREATE INDEX IF NOT EXISTS idx_customer_display_pairing_codes_used_at
ON customer_display_pairing_codes(used_at);

DROP TRIGGER IF EXISTS trg_customer_display_devices_updated_at
ON customer_display_devices;

CREATE TRIGGER trg_customer_display_devices_updated_at
BEFORE UPDATE ON customer_display_devices
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

ALTER TABLE customer_display_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_display_pairing_codes ENABLE ROW LEVEL SECURITY;
