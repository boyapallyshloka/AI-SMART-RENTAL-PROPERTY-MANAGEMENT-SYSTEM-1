-- Apply once before starting a backend build with the four-state PropertyStatus enum.
-- This preserves pending reviews separately from the property's rentable status.

ALTER TABLE properties
    ADD COLUMN IF NOT EXISTS submitted_for_approval BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE properties
SET submitted_for_approval = TRUE,
    status = 'DRAFT'
WHERE status = 'PENDING_APPROVAL';

UPDATE properties
SET status = 'AVAILABLE'
WHERE status IN ('APPROVED', 'PUBLISHED');

UPDATE properties
SET status = 'NOT_AVAILABLE'
WHERE status IN ('INACTIVE', 'UNDER_MAINTENANCE');
