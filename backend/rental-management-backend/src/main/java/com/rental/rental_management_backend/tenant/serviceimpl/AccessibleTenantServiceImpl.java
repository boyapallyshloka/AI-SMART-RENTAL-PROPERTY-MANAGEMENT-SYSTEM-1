package com.rental.rental_management_backend.tenant.serviceimpl;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.rental.enums.AgreementStatus;
import com.rental.rental_management_backend.rental.repository.RentalAgreementRepository;
import com.rental.rental_management_backend.tenant.dto.AccessibleTenantResponseDTO;
import com.rental.rental_management_backend.tenant.dto.AccessibleTenantsResponseDTO;
import com.rental.rental_management_backend.tenant.service.AccessibleTenantService;

@Service
public class AccessibleTenantServiceImpl implements AccessibleTenantService {

    private final UserRepository userRepository;
    private final RentalAgreementRepository rentalAgreementRepository;

    public AccessibleTenantServiceImpl(
            UserRepository userRepository,
            RentalAgreementRepository rentalAgreementRepository) {
        this.userRepository = userRepository;
        this.rentalAgreementRepository = rentalAgreementRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public AccessibleTenantsResponseDTO getOwnerTenants() {
        User user = getAuthenticatedUser();
        if (user.getRole() != RoleType.PROPERTY_OWNER) {
            throw new AccessDeniedException(
                    "Only PROPERTY_OWNER can access this resource");
        }

        List<RentalAgreementRepository.AccessibleTenantProperty> relationships =
                rentalAgreementRepository.findQualifyingTenantPropertiesForOwner(
                        user.getId(),
                        AgreementStatus.DRAFT,
                        LocalDate.now());
        return toResponse(relationships);
    }

    @Override
    @Transactional(readOnly = true)
    public AccessibleTenantsResponseDTO getManagerTenants() {
        User user = getAuthenticatedUser();
        if (user.getRole() != RoleType.PROPERTY_MANAGER) {
            throw new AccessDeniedException(
                    "Only PROPERTY_MANAGER can access this resource");
        }

        List<RentalAgreementRepository.AccessibleTenantProperty> relationships =
                rentalAgreementRepository.findQualifyingTenantPropertiesForManager(
                        user.getId(),
                        AgreementStatus.DRAFT,
                        LocalDate.now());
        return toResponse(relationships);
    }

    private User getAuthenticatedUser() {
        Authentication authentication =
                SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication.getName() == null
                || authentication.getName().isBlank()) {
            throw new AccessDeniedException("Authenticated user is required");
        }

        return userRepository.findByEmail(authentication.getName().trim())
                .orElseThrow(() -> new AccessDeniedException(
                        "Authenticated user is not available"));
    }

    private AccessibleTenantsResponseDTO toResponse(
            List<RentalAgreementRepository.AccessibleTenantProperty>
                    relationships) {
        Map<TenantPropertyKey, AccessibleTenantResponseDTO> distinctRelationships =
                new LinkedHashMap<>();

        for (RentalAgreementRepository.AccessibleTenantProperty relationship
                : relationships) {
            TenantPropertyKey key = new TenantPropertyKey(
                    relationship.getTenantId(),
                    relationship.getPropertyId());
            distinctRelationships.putIfAbsent(
                    key,
                    new AccessibleTenantResponseDTO(
                            relationship.getTenantId(),
                            relationship.getTenantName(),
                            relationship.getPropertyName()));
        }

        return new AccessibleTenantsResponseDTO(
                true,
                List.copyOf(distinctRelationships.values()));
    }

    private record TenantPropertyKey(Long tenantId, Long propertyId) {
    }
}
