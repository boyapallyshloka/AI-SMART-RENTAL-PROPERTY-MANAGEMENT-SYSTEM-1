-- Apply to the Neon database after adding notification types to the backend enum.
-- Keep this list aligned with notification.enums.NotificationType.

ALTER TABLE notifications
    DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
    ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
        'RENT_DUE',
        'RENT_OVERDUE',
        'PAYMENT_SUCCESS',
        'PAYMENT_FAILED',
        'NEW_APPLICATION',
        'APPLICATION_APPROVED',
        'APPLICATION_REJECTED',
        'MAINTENANCE_CREATED',
        'MAINTENANCE_ASSIGNED',
        'MAINTENANCE_STATUS_UPDATED',
        'MAINTENANCE_COMPLETED',
        'AGREEMENT_EXPIRING',
        'AGREEMENT_ACTIVE',
        'AGREEMENT_EXPIRED',
        'AGREEMENT_TERMINATED',
        'AI_ALERT',
        'PROPERTY_SUBMITTED',
        'PROPERTY_APPROVED'
    ));
