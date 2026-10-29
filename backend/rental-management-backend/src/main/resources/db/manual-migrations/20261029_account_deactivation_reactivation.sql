ALTER TABLE users
    ADD COLUMN self_deactivated BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE email_verification_otps
    ADD COLUMN pending_first_name VARCHAR(50),
    ADD COLUMN pending_last_name VARCHAR(50),
    ADD COLUMN pending_password_hash VARCHAR(255),
    ADD COLUMN pending_phone VARCHAR(15),
    ADD COLUMN pending_gender VARCHAR(30);
