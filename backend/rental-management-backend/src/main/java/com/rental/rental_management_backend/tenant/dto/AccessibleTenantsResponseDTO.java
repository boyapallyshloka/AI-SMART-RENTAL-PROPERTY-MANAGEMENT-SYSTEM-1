package com.rental.rental_management_backend.tenant.dto;

import java.util.List;

public class AccessibleTenantsResponseDTO {

    private final boolean success;
    private final List<AccessibleTenantResponseDTO> tenants;

    public AccessibleTenantsResponseDTO(
            boolean success,
            List<AccessibleTenantResponseDTO> tenants) {
        this.success = success;
        this.tenants = tenants;
    }

    public boolean isSuccess() {
        return success;
    }

    public List<AccessibleTenantResponseDTO> getTenants() {
        return tenants;
    }
}
