CREATE TABLE IF NOT EXISTS user_device_tokens (
    device_token_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    endpoint VARCHAR(2048) NOT NULL,
    p256dh_key VARCHAR(256) NOT NULL,
    auth_key VARCHAR(128) NOT NULL,
    device_type VARCHAR(20) NOT NULL DEFAULT 'WEB',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_device_tokens_user
        FOREIGN KEY (user_id)
        REFERENCES users (id)
        ON DELETE CASCADE,
    CONSTRAINT uk_user_device_tokens_endpoint
        UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS idx_user_device_tokens_user_active
    ON user_device_tokens (user_id, active);
