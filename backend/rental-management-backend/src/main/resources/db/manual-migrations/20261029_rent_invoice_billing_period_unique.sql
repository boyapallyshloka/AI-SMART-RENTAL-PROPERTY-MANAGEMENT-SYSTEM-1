-- Check for existing duplicate (agreement_id, billing_month, billing_year)
-- rows before applying. This constraint creation will fail if duplicates exist.
ALTER TABLE rent_invoices
    ADD CONSTRAINT uq_rent_invoices_agreement_billing_period
    UNIQUE (agreement_id, billing_month, billing_year);
