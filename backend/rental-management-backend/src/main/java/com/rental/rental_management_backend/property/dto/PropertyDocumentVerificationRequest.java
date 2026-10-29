package com.rental.rental_management_backend.property.dto;

import com.rental.rental_management_backend.tenant.enums.DocumentVerificationStatus;

public class PropertyDocumentVerificationRequest {

    private DocumentVerificationStatus status;
    private String rejectionReason;

    public DocumentVerificationStatus getStatus() {
        return status;
    }

    public void setStatus(DocumentVerificationStatus status) {
        this.status = status;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public void setRejectionReason(String rejectionReason) {
        this.rejectionReason = rejectionReason;
    }
}
