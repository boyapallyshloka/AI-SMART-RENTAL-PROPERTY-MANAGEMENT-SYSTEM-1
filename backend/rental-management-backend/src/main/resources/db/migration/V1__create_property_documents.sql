-- ============================================================================
-- Migration: V1__create_property_documents.sql
-- Table: property_documents
-- Purpose: Store owner-uploaded property documents (Title Deed, Tax Receipts, etc.)
--          and administrative review status for property verification.
-- ============================================================================

CREATE TABLE IF NOT EXISTS property_documents (
    document_id BIGSERIAL PRIMARY KEY,
    property_id BIGINT NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_key VARCHAR(500) NOT NULL,
    file_size BIGINT,
    content_type VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    rejection_reason TEXT,
    reviewed_by BIGINT,
    reviewed_at TIMESTAMP,
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_property_documents_property
        FOREIGN KEY (property_id)
        REFERENCES properties (property_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_property_documents_reviewer
        FOREIGN KEY (reviewed_by)
        REFERENCES users (id)
        ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_property_documents_property_id
    ON property_documents (property_id);

CREATE INDEX IF NOT EXISTS idx_property_documents_status
    ON property_documents (status);

CREATE INDEX IF NOT EXISTS idx_property_documents_type
    ON property_documents (document_type);
