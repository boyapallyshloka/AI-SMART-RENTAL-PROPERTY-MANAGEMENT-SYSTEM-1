CREATE TABLE IF NOT EXISTS property_documents (
    property_document_id BIGSERIAL PRIMARY KEY,
    property_id BIGINT NOT NULL
        REFERENCES properties(property_id),
    document_type VARCHAR(50) NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(600) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    verification_status VARCHAR(30) NOT NULL,
    uploaded_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITHOUT TIME ZONE,
    verified_by BIGINT
        REFERENCES users(id),
    rejection_reason VARCHAR(500)
);

CREATE INDEX IF NOT EXISTS idx_property_documents_property_id
    ON property_documents(property_id);

CREATE INDEX IF NOT EXISTS idx_property_documents_verification_status
    ON property_documents(verification_status);
