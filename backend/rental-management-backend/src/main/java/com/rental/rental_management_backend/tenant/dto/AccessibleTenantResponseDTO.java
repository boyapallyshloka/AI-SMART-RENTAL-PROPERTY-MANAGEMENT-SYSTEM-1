package com.rental.rental_management_backend.tenant.dto;

public class AccessibleTenantResponseDTO {

    private Long tenantId;
    private String tenantName;
    private String propertyName;

    public AccessibleTenantResponseDTO() {
    }

    public AccessibleTenantResponseDTO(
            Long tenantId,
            String tenantName,
            String propertyName) {
        this.tenantId = tenantId;
        this.tenantName = tenantName;
        this.propertyName = propertyName;
    }

    public Long getTenantId() {
        return tenantId;
    }

    public String getTenantName() {
        return tenantName;
    }

    public String getPropertyName() {
        return propertyName;
    }
}
