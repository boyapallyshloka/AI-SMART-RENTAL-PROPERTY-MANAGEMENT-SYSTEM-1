
package com.rental.rental_management_backend.tenant.serviceimpl;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.User.enums.UserStatus;
import com.rental.rental_management_backend.exception.ResourceNotFoundException;
import com.rental.rental_management_backend.tenant.dto.TenantProfileUpdateRequest;
import com.rental.rental_management_backend.tenant.dto.TenantResponse;
import com.rental.rental_management_backend.tenant.entity.Tenant;
import com.rental.rental_management_backend.tenant.repository.TenantRepository;
import com.rental.rental_management_backend.tenant.service.TenantService;

@Service
@Transactional
public class TenantServiceImpl implements TenantService {

    private final TenantRepository tenantRepository;

    private final UserRepository userRepository;

    public TenantServiceImpl(
            TenantRepository tenantRepository,
            UserRepository userRepository) {

        this.tenantRepository = tenantRepository;
        this.userRepository = userRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<TenantResponse> getAllTenants() {

        return tenantRepository.findAll()
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public TenantResponse getTenantById(Long tenantId) {

        if (tenantId == null) {

            throw new IllegalArgumentException(
                    "Tenant ID is required");
        }

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Tenant not found with ID: " + tenantId));

        return mapToResponse(tenant);
    }

    @Override
    @Transactional(readOnly = true)
    public TenantResponse getTenantByUserId(Long userId) {

        if (userId == null) {

            throw new IllegalArgumentException(
                    "User ID is required");
        }

        Tenant tenant = tenantRepository.findByUser_Id(userId)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Tenant not found for user ID: " + userId));

        return mapToResponse(tenant);
    }

    @Override
    @Transactional(readOnly = true)
    public TenantResponse getMyTenantProfile(String email) {

        User user = getAuthenticatedTenant(email);

        Tenant tenant = tenantRepository.findByUser(user)
                .orElse(null);

        if (tenant == null) {
            TenantResponse response = new TenantResponse();

            response.setUserId(user.getId());
            response.setFirstName(user.getFirstName());
            response.setLastName(user.getLastName());
            response.setEmail(user.getEmail());
            response.setPhone(user.getPhone());

            if (user.getGender() != null) {
                response.setGender(user.getGender().name());
            }

            if (user.getRole() != null) {
                response.setRole(user.getRole().name());
            }

            if (user.getStatus() != null) {
                response.setStatus(user.getStatus().name());
            }

            return response;
        }

        return mapToResponse(tenant);
    }

    @Override
    public TenantResponse updateMyTenantProfile(
            String email,
            TenantProfileUpdateRequest request) {

        if (request == null) {

            throw new IllegalArgumentException(
                    "Tenant profile request cannot be null");
        }

        User user = getAuthenticatedTenant(email);

        Tenant tenant = tenantRepository.findByUser(user)
                .orElseGet(() -> createEmptyTenantProfile(user));

        // =====================================================
        // PERSONAL DETAILS
        // =====================================================

        if (request.getDateOfBirth() != null) {

            tenant.setDateOfBirth(
                    request.getDateOfBirth());
        }

        if (request.getAlternatePhone() != null) {

            tenant.setAlternatePhone(
                    cleanValue(request.getAlternatePhone()));
        }

        // =====================================================
        // PROFESSIONAL DETAILS
        // =====================================================

        if (request.getOccupation() != null) {

            tenant.setOccupation(
                    cleanValue(request.getOccupation()));
        }

        if (request.getCompanyName() != null) {

            tenant.setCompanyName(
                    cleanValue(request.getCompanyName()));
        }

        if (request.getMonthlyIncome() != null) {

            tenant.setMonthlyIncome(
                    request.getMonthlyIncome());
        }

        // =====================================================
        // EMERGENCY CONTACT
        // =====================================================

        if (request.getEmergencyContactName() != null) {

            tenant.setEmergencyContactName(
                    cleanValue(request.getEmergencyContactName()));
        }

        if (request.getEmergencyContactPhone() != null) {

            tenant.setEmergencyContactPhone(
                    cleanValue(request.getEmergencyContactPhone()));
        }

        // =====================================================
        // CURRENT ADDRESS
        // =====================================================

        if (request.getCurrentAddress() != null) {

            tenant.setCurrentAddress(
                    cleanValue(request.getCurrentAddress()));
        }

        if (request.getArea() != null) {

            tenant.setArea(
                    cleanValue(request.getArea()));
        }

        if (request.getDistrict() != null) {

            tenant.setDistrict(
                    cleanValue(request.getDistrict()));
        }

        if (request.getCity() != null) {

            tenant.setCity(
                    cleanValue(request.getCity()));
        }

        if (request.getState() != null) {

            tenant.setState(
                    cleanValue(request.getState()));
        }

        if (request.getCountry() != null) {

            tenant.setCountry(
                    cleanValue(request.getCountry()));
        }

        if (request.getPincode() != null) {

            tenant.setPincode(
                    cleanValue(request.getPincode()));
        }

        Tenant updatedTenant = tenantRepository.save(tenant);

        return mapToResponse(updatedTenant);
    }

    @Override
    public TenantResponse updateTenantStatus(
            Long tenantId,
            UserStatus status) {

        if (tenantId == null) {

            throw new IllegalArgumentException(
                    "Tenant ID is required");
        }

        if (status == null) {

            throw new IllegalArgumentException(
                    "Status is required");
        }

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Tenant not found with ID: " + tenantId));

        User user = tenant.getUser();

        user.setStatus(status);
        user.setSelfDeactivated(false);

        userRepository.save(user);

        return mapToResponse(tenant);
    }

    @Override
    public void deleteTenant(Long tenantId) {

        if (tenantId == null) {

            throw new IllegalArgumentException(
                    "Tenant ID is required");
        }

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Tenant not found with ID: " + tenantId));

        tenantRepository.delete(tenant);
    }

    // =========================================================
    // AUTHENTICATED TENANT
    // =========================================================

    private User getAuthenticatedTenant(String email) {

        if (email == null || email.isBlank()) {

            throw new IllegalArgumentException(
                    "Authenticated user email is required");
        }

        User user = userRepository.findByEmail(
                email.toLowerCase().trim()
        ).orElseThrow(() ->
                new ResourceNotFoundException(
                        "Authenticated user not found"));

        if (user.getRole() != RoleType.TENANT) {

            throw new IllegalArgumentException(
                    "Only TENANT users can access this profile");
        }

        return user;
    }

    // =========================================================
    // CREATE EMPTY TENANT PROFILE
    // =========================================================

    private Tenant createEmptyTenantProfile(User user) {

        if (tenantRepository.existsByUser_Id(user.getId())) {

            return tenantRepository.findByUser_Id(user.getId())
                    .orElseThrow(() ->
                            new ResourceNotFoundException(
                                    "Tenant profile could not be loaded"));
        }

        Tenant tenant = new Tenant();

        tenant.setUser(user);

        return tenantRepository.save(tenant);
    }

    // =========================================================
    // CLEAN VALUE
    // =========================================================

    private String cleanValue(String value) {

        if (value == null) {

            return null;
        }

        String cleaned = value.trim();

        return cleaned.isEmpty() ? null : cleaned;
    }

    // =========================================================
    // MAP TO RESPONSE
    // =========================================================

    private TenantResponse mapToResponse(Tenant tenant) {

        User user = tenant.getUser();

        TenantResponse response = new TenantResponse();

        response.setTenantId(
                tenant.getTenantId());

        response.setUserId(
                user.getId());

        response.setFirstName(
                user.getFirstName());

        response.setLastName(
                user.getLastName());

        response.setEmail(
                user.getEmail());

        response.setPhone(
                user.getPhone());

        if (user.getGender() != null) {

            response.setGender(
                    user.getGender().name());
        }

        if (user.getRole() != null) {

            response.setRole(
                    user.getRole().name());
        }

        if (user.getStatus() != null) {

            response.setStatus(
                    user.getStatus().name());
        }

        response.setDateOfBirth(
                tenant.getDateOfBirth());

        response.setAlternatePhone(
                tenant.getAlternatePhone());

        response.setOccupation(
                tenant.getOccupation());

        response.setCompanyName(
                tenant.getCompanyName());

        response.setMonthlyIncome(
                tenant.getMonthlyIncome());

        response.setEmergencyContactName(
                tenant.getEmergencyContactName());

        response.setEmergencyContactPhone(
                tenant.getEmergencyContactPhone());

        // =====================================================
        // ADDRESS
        // =====================================================

        response.setCurrentAddress(
                tenant.getCurrentAddress());

        response.setArea(
                tenant.getArea());

        response.setDistrict(
                tenant.getDistrict());

        response.setCity(
                tenant.getCity());

        response.setState(
                tenant.getState());

        response.setCountry(
                tenant.getCountry());

        response.setPincode(
                tenant.getPincode());

        // =====================================================
        // AUDIT
        // =====================================================

        response.setCreatedAt(
                tenant.getCreatedAt());

        response.setUpdatedAt(
                tenant.getUpdatedAt());

        return response;
    }

    // =========================================================
    // SEARCH TENANTS
    // =========================================================

    @Override
    @Transactional(readOnly = true)
    public List<TenantResponse> searchTenants(String keyword) {

        if (keyword == null || keyword.isBlank()) {

            return getAllTenants();
        }

        String searchKeyword = keyword.trim();

        return tenantRepository
                .findByUser_FirstNameContainingIgnoreCaseOrUser_LastNameContainingIgnoreCaseOrUser_EmailContainingIgnoreCaseOrUser_PhoneContaining(
                        searchKeyword,
                        searchKeyword,
                        searchKeyword,
                        searchKeyword
                )
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // =========================================================
    // TENANTS BY STATUS
    // =========================================================

    @Override
    @Transactional(readOnly = true)
    public List<TenantResponse> getTenantsByStatus(
            UserStatus status) {

        if (status == null) {

            throw new IllegalArgumentException(
                    "Status is required");
        }

        return tenantRepository
                .findByUser_Status(status)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }
}
