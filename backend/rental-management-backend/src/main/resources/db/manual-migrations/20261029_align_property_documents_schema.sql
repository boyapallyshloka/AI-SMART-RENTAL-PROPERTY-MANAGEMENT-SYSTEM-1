-- Align the legacy property_documents table with PropertyDocument.
-- The guarded transaction preserves the existing document_id values as the
-- canonical entity IDs and snapshots stored references/history for validation.
BEGIN;

LOCK TABLE public.property_documents IN ACCESS EXCLUSIVE MODE;

DO $preflight$
DECLARE
    table_rows BIGINT;
BEGIN
    IF to_regclass('public.property_documents') IS NULL THEN
        RAISE EXCEPTION 'public.property_documents does not exist';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.property_documents'::regclass
          AND contype = 'p'
          AND conname = 'property_documents_pkey'
          AND pg_get_constraintdef(oid) = 'PRIMARY KEY (document_id)'
    ) THEN
        RAISE EXCEPTION 'Expected primary key on document_id was not found';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE confrelid = 'public.property_documents'::regclass
          AND contype = 'f'
    ) THEN
        RAISE EXCEPTION
            'Incoming foreign keys reference property_documents; migration stopped';
    END IF;

    SELECT count(*) INTO table_rows
    FROM public.property_documents;

    IF table_rows <> 17 THEN
        RAISE EXCEPTION
            'Expected 17 rows before migration, found %; migration stopped',
            table_rows;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.property_documents
        WHERE document_id IS NULL
           OR property_document_id IS NULL
        GROUP BY document_id, property_document_id
    ) THEN
        RAISE EXCEPTION 'Null document IDs found; migration stopped';
    END IF;

    IF (SELECT count(DISTINCT document_id)
        FROM public.property_documents) <> table_rows THEN
        RAISE EXCEPTION 'document_id is not unique; migration stopped';
    END IF;

    IF (SELECT count(DISTINCT property_document_id)
        FROM public.property_documents) <> table_rows THEN
        RAISE EXCEPTION
            'property_document_id is not unique; migration stopped';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'property_documents'
          AND column_name = 'document_id'
          AND is_identity = 'YES'
    ) OR NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'property_documents'
          AND column_name = 'property_document_id'
          AND is_identity = 'YES'
    ) THEN
        RAISE EXCEPTION
            'Expected identity columns were not found; migration stopped';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.property_documents
        WHERE document_type NOT IN (
            'TITLE_DEED',
            'PROPERTY_TAX_RECEIPT',
            'BUILDING_PERMIT',
            'INSURANCE_POLICY',
            'OTHER',
            'PROPERTY_OWNERSHIP_PROOF',
            'PROPERTY_REGISTRATION',
            'PROPERTY_TAX_DOCUMENT',
            'NOC',
            'INSURANCE'
        )
    ) THEN
        RAISE EXCEPTION
            'Unexpected document_type value found; migration stopped';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.property_documents
        WHERE status NOT IN ('APPROVED', 'PENDING', 'REJECTED')
    ) THEN
        RAISE EXCEPTION
            'Unexpected document status found; migration stopped';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.property_documents
        WHERE file_name IS NULL
           OR length(file_name) > 255
           OR file_key IS NULL
           OR btrim(file_key) = ''
           OR content_type IS NULL
           OR file_size IS NULL
           OR property_id IS NULL
           OR uploaded_at IS NULL
    ) THEN
        RAISE EXCEPTION
            'Required document data is invalid or null; migration stopped';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.property_documents d
        LEFT JOIN public.properties p
          ON p.property_id = d.property_id
        WHERE p.property_id IS NULL
    ) OR EXISTS (
        SELECT 1
        FROM public.property_documents d
        LEFT JOIN public.users u
          ON u.id = d.verified_by
        WHERE d.verified_by IS NOT NULL
          AND u.id IS NULL
    ) OR EXISTS (
        SELECT 1
        FROM public.property_documents d
        LEFT JOIN public.users u
          ON u.id = d.reviewed_by
        WHERE d.reviewed_by IS NOT NULL
          AND u.id IS NULL
    ) THEN
        RAISE EXCEPTION
            'Broken property or user reference found; migration stopped';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.property_documents'::regclass
          AND conname = 'property_documents_document_type_check'
          AND contype = 'c'
    ) OR NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.property_documents'::regclass
          AND conname = 'property_documents_status_check'
          AND contype = 'c'
    ) THEN
        RAISE EXCEPTION
            'Expected legacy enum constraints were not found; migration stopped';
    END IF;
END
$preflight$;

-- Retain pre-migration values so this transaction can verify data preservation.
CREATE TEMPORARY TABLE property_documents_migration_snapshot
ON COMMIT DROP AS
SELECT document_id AS old_document_id,
       property_id,
       document_type AS old_document_type,
       status AS old_status,
       file_key AS old_file_key,
       file_name,
       content_type,
       file_size,
       uploaded_at,
       verified_at,
       verified_by,
       reviewed_at,
       reviewed_by,
       rejection_reason
FROM public.property_documents;

-- Remove legacy checks before mapping stored enum strings.
ALTER TABLE public.property_documents
    DROP CONSTRAINT property_documents_document_type_check;
ALTER TABLE public.property_documents
    DROP CONSTRAINT property_documents_status_check;

-- Preserve reviewed history without overwriting existing verification data.
UPDATE public.property_documents
SET verified_at = COALESCE(verified_at, reviewed_at),
    verified_by = COALESCE(verified_by, reviewed_by);

-- Backfill required entity name from the existing meaningful filename.
ALTER TABLE public.property_documents
    ADD COLUMN document_name VARCHAR(255);
UPDATE public.property_documents
SET document_name = CASE
    WHEN file_name IS NOT NULL AND btrim(file_name) <> '' THEN file_name
    ELSE 'document-' || document_id::text
END;
ALTER TABLE public.property_documents
    ALTER COLUMN document_name SET NOT NULL;

-- Apply only the approved, semantically equivalent legacy enum mappings.
UPDATE public.property_documents
SET document_type = CASE document_type
    WHEN 'TITLE_DEED' THEN 'PROPERTY_OWNERSHIP_PROOF'
    WHEN 'PROPERTY_TAX_RECEIPT' THEN 'PROPERTY_TAX_DOCUMENT'
    WHEN 'INSURANCE_POLICY' THEN 'INSURANCE'
    ELSE document_type
END
WHERE document_type IN (
    'TITLE_DEED',
    'PROPERTY_TAX_RECEIPT',
    'INSURANCE_POLICY'
);

UPDATE public.property_documents
SET status = CASE status
    WHEN 'APPROVED' THEN 'VERIFIED'
    ELSE status
END
WHERE status = 'APPROVED';

-- The old primary-key IDs are authoritative; replace the conflicting
-- property_document_id values before removing document_id and its sequence.
UPDATE public.property_documents
SET property_document_id = document_id;

ALTER TABLE public.property_documents
    DROP CONSTRAINT property_documents_pkey;
ALTER TABLE public.property_documents
    DROP COLUMN document_id;
ALTER TABLE public.property_documents
    ADD CONSTRAINT property_documents_pkey
    PRIMARY KEY (property_document_id);

-- Rename legacy columns only after preserving their stored values.
ALTER TABLE public.property_documents
    RENAME COLUMN file_key TO file_path;
ALTER TABLE public.property_documents
    ALTER COLUMN file_path TYPE VARCHAR(600);
ALTER TABLE public.property_documents
    RENAME COLUMN status TO verification_status;

-- Preserve review columns in verified fields, then remove only legacy fields
-- confirmed unused by current Java code.
ALTER TABLE public.property_documents
    DROP COLUMN reviewed_at;
ALTER TABLE public.property_documents
    DROP COLUMN reviewed_by;

-- Match entity nullability after preflight confirmed existing values are set.
ALTER TABLE public.property_documents
    ALTER COLUMN content_type SET NOT NULL;
ALTER TABLE public.property_documents
    ALTER COLUMN file_size SET NOT NULL;

ALTER TABLE public.property_documents
    ADD CONSTRAINT property_documents_document_type_check
    CHECK (document_type IN (
        'PROPERTY_OWNERSHIP_PROOF',
        'PROPERTY_REGISTRATION',
        'PROPERTY_TAX_DOCUMENT',
        'NOC',
        'BUILDING_PERMIT',
        'INSURANCE',
        'OTHER'
    ));
ALTER TABLE public.property_documents
    ADD CONSTRAINT property_documents_verification_status_check
    CHECK (verification_status IN (
        'PENDING',
        'VERIFIED',
        'REJECTED'
    ));

-- Keep the existing identity mechanism and advance it past every preserved ID.
DO $sequence_sync$
DECLARE
    maximum_id BIGINT;
    sequence_name TEXT;
BEGIN
    SELECT max(property_document_id)
    INTO maximum_id
    FROM public.property_documents;

    sequence_name := pg_get_serial_sequence(
        'public.property_documents',
        'property_document_id'
    );

    IF sequence_name IS NULL THEN
        RAISE EXCEPTION
            'property_document_id identity sequence is missing';
    END IF;

    PERFORM setval(
        sequence_name,
        COALESCE(maximum_id, 1),
        maximum_id IS NOT NULL
    );
END
$sequence_sync$;

-- Fail and roll back if any row, ID, file reference, name, or review history
-- differs from the pre-migration snapshot.
DO $postflight$
DECLARE
    rows_after BIGINT;
    invalid_rows BIGINT;
BEGIN
    SELECT count(*) INTO rows_after
    FROM public.property_documents;

    IF rows_after <> (SELECT count(*) FROM property_documents_migration_snapshot) THEN
        RAISE EXCEPTION
            'Row count changed during migration: expected %, found %',
            (SELECT count(*) FROM property_documents_migration_snapshot),
            rows_after;
    END IF;

    SELECT count(*) INTO invalid_rows
    FROM property_documents_migration_snapshot s
    LEFT JOIN public.property_documents d
      ON d.property_document_id = s.old_document_id
    WHERE d.property_document_id IS NULL
       OR d.property_id IS DISTINCT FROM s.property_id
       OR d.file_path IS DISTINCT FROM s.old_file_key
       OR d.file_name IS DISTINCT FROM s.file_name
       OR d.document_name IS DISTINCT FROM CASE
            WHEN s.file_name IS NOT NULL
                 AND btrim(s.file_name) <> '' THEN s.file_name
            ELSE 'document-' || s.old_document_id::text
          END
       OR d.content_type IS DISTINCT FROM s.content_type
       OR d.file_size IS DISTINCT FROM s.file_size
       OR d.uploaded_at IS DISTINCT FROM s.uploaded_at
       OR d.verified_at IS DISTINCT FROM COALESCE(s.verified_at, s.reviewed_at)
       OR d.verified_by IS DISTINCT FROM COALESCE(s.verified_by, s.reviewed_by)
       OR d.rejection_reason IS DISTINCT FROM s.rejection_reason
       OR d.document_type IS DISTINCT FROM CASE s.old_document_type
            WHEN 'TITLE_DEED' THEN 'PROPERTY_OWNERSHIP_PROOF'
            WHEN 'PROPERTY_TAX_RECEIPT' THEN 'PROPERTY_TAX_DOCUMENT'
            WHEN 'INSURANCE_POLICY' THEN 'INSURANCE'
            ELSE s.old_document_type
          END
       OR d.verification_status IS DISTINCT FROM CASE s.old_status
            WHEN 'APPROVED' THEN 'VERIFIED'
            ELSE s.old_status
          END;

    IF invalid_rows <> 0 THEN
        RAISE EXCEPTION
            'Post-migration preservation validation failed for % rows',
            invalid_rows;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.property_documents
        WHERE property_document_id IS NULL
           OR document_name IS NULL
           OR btrim(document_name) = ''
           OR file_path IS NULL
           OR verification_status IS NULL
           OR document_type NOT IN (
                'PROPERTY_OWNERSHIP_PROOF',
                'PROPERTY_REGISTRATION',
                'PROPERTY_TAX_DOCUMENT',
                'NOC',
                'BUILDING_PERMIT',
                'INSURANCE',
                'OTHER'
           )
           OR verification_status NOT IN (
                'PENDING',
                'VERIFIED',
                'REJECTED'
           )
    ) THEN
        RAISE EXCEPTION
            'Post-migration entity or enum validation failed';
    END IF;

    IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'public.property_documents'::regclass
              AND contype = 'f'
              AND pg_get_constraintdef(oid)
                  LIKE 'FOREIGN KEY (property_id) REFERENCES properties(property_id)%'
    ) OR NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'public.property_documents'::regclass
              AND contype = 'f'
              AND pg_get_constraintdef(oid)
                  LIKE 'FOREIGN KEY (verified_by) REFERENCES users(id)%'
    ) THEN
            RAISE EXCEPTION
                'Post-migration property or verifier foreign key is missing';
    END IF;
END
$postflight$;

COMMIT;
