ALTER TABLE payment_sessions
ADD COLUMN IF NOT EXISTS receipt_email VARCHAR(254);

