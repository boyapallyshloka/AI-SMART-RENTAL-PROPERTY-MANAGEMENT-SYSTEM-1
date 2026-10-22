package com.rental.rental_management_backend.property.dto;

import java.util.List;

import com.rental.rental_management_backend.property.enums.PropertyDocumentType;

public class PropertyPublishEligibilityResponse {

    private boolean eligible;
    private Long propertyId;
    private String currentStatus;
    private List<PropertyDocumentType> requiredDocumentTypes;
    private List<PropertyDocumentType> approvedDocumentTypes;
    private List<PropertyDocumentType> missingDocumentTypes;
    private long approvedDocumentCount;
    private long pendingDocumentCount;
    private long rejectedDocumentCount;
    private List<String> reasons;

    public PropertyPublishEligibilityResponse() {
    }

    public boolean isEligible() {
        return eligible;
    }

    public void setEligible(boolean eligible) {
        this.eligible = eligible;
    }

    public Long getPropertyId() {
        return propertyId;
    }

    public void setPropertyId(Long propertyId) {
        this.propertyId = propertyId;
    }

    public String getCurrentStatus() {
        return currentStatus;
    }

    public void setCurrentStatus(String currentStatus) {
        this.currentStatus = currentStatus;
    }

    public List<PropertyDocumentType> getRequiredDocumentTypes() {
        return requiredDocumentTypes;
    }

    public void setRequiredDocumentTypes(List<PropertyDocumentType> requiredDocumentTypes) {
        this.requiredDocumentTypes = requiredDocumentTypes;
    }

    public List<PropertyDocumentType> getApprovedDocumentTypes() {
        return approvedDocumentTypes;
    }

    public void setApprovedDocumentTypes(List<PropertyDocumentType> approvedDocumentTypes) {
        this.approvedDocumentTypes = approvedDocumentTypes;
    }

    public List<PropertyDocumentType> getMissingDocumentTypes() {
        return missingDocumentTypes;
    }

    public void setMissingDocumentTypes(List<PropertyDocumentType> missingDocumentTypes) {
        this.missingDocumentTypes = missingDocumentTypes;
    }

    public long getApprovedDocumentCount() {
        return approvedDocumentCount;
    }

    public void setApprovedDocumentCount(long approvedDocumentCount) {
        this.approvedDocumentCount = approvedDocumentCount;
    }

    public long getPendingDocumentCount() {
        return pendingDocumentCount;
    }

    public void setPendingDocumentCount(long pendingDocumentCount) {
        this.pendingDocumentCount = pendingDocumentCount;
    }

    public long getRejectedDocumentCount() {
        return rejectedDocumentCount;
    }

    public void setRejectedDocumentCount(long rejectedDocumentCount) {
        this.rejectedDocumentCount = rejectedDocumentCount;
    }

    public List<String> getReasons() {
        return reasons;
    }

    public void setReasons(List<String> reasons) {
        this.reasons = reasons;
    }
}
