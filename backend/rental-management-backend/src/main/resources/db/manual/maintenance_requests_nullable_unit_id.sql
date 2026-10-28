ALTER TABLE maintenance_requests
    ALTER COLUMN property_id SET NOT NULL;

ALTER TABLE maintenance_requests
    ALTER COLUMN unit_id DROP NOT NULL;
