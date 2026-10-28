-- Run once against an existing PostgreSQL database when enabling direct
-- rental applications for houses and villas. These records have no unit.
ALTER TABLE rental_applications ALTER COLUMN unit_id DROP NOT NULL;
ALTER TABLE rental_agreements ALTER COLUMN unit_id DROP NOT NULL;
ALTER TABLE rent_invoices ALTER COLUMN unit_id DROP NOT NULL;
