package com.rental.rental_management_backend.tenant.service;

import com.rental.rental_management_backend.tenant.dto.AccessibleTenantsResponseDTO;

public interface AccessibleTenantService {

    AccessibleTenantsResponseDTO getOwnerTenants();

    AccessibleTenantsResponseDTO getManagerTenants();
}
