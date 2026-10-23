package com.rental.rental_management_backend.maintenance.service;

import java.util.List;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.exception.ResourceNotFoundException;
import com.rental.rental_management_backend.maintenance.dto.InspectionCreateRequest;
import com.rental.rental_management_backend.maintenance.dto.InspectionResponse;
import com.rental.rental_management_backend.maintenance.entity.Inspection;
import com.rental.rental_management_backend.maintenance.repository.InspectionRepository;
import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.repository.PropertyManagerRepository;
import com.rental.rental_management_backend.property.repository.PropertyRepository;

@Service
@Transactional
public class InspectionServiceImpl implements InspectionService {

    private final InspectionRepository inspectionRepository;
    private final PropertyRepository propertyRepository;
    private final PropertyManagerRepository propertyManagerRepository;
    private final UserRepository userRepository;

    public InspectionServiceImpl(
            InspectionRepository inspectionRepository,
            PropertyRepository propertyRepository,
            PropertyManagerRepository propertyManagerRepository,
            UserRepository userRepository) {
        this.inspectionRepository = inspectionRepository;
        this.propertyRepository = propertyRepository;
        this.propertyManagerRepository = propertyManagerRepository;
        this.userRepository = userRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<InspectionResponse> getManagerInspections() {
        User manager = getLoggedInManager();
        Long managerId = propertyManagerRepository.findByUser_Id(manager.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Manager profile not found"))
                .getPropertyManagerId();

        return inspectionRepository.findByProperty_PropertyManager_PropertyManagerIdOrderByInspectionDateDesc(managerId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    public InspectionResponse createManagerInspection(InspectionCreateRequest request) {
        User manager = getLoggedInManager();
        Property property = propertyRepository.findDetailsById(request.getPropertyId())
                .orElseThrow(() -> new ResourceNotFoundException("Property not found"));

        if (property.getPropertyManager() == null
                || property.getPropertyManager().getUser() == null
                || !manager.getId().equals(property.getPropertyManager().getUser().getId())) {
            throw new AccessDeniedException("You can only record inspections for your assigned properties");
        }

        Inspection inspection = Inspection.builder()
                .property(property)
                .inspectionDate(request.getInspectionDate())
                .inspectorName(request.getInspectorName().trim())
                .passed(request.getPassed())
                .hasIssuesRequiringAttention(request.getHasIssuesRequiringAttention())
                .notes(request.getNotes() == null || request.getNotes().isBlank() ? null : request.getNotes().trim())
                .build();

        return toResponse(inspectionRepository.save(inspection));
    }

    private User getLoggedInManager() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof UserDetails userDetails)) {
            throw new AccessDeniedException("Authenticated manager is required");
        }

        User user = userRepository.findByEmail(userDetails.getUsername().toLowerCase().trim())
                .orElseThrow(() -> new AccessDeniedException("Logged-in manager was not found"));
        if (user.getRole() == null || !"PROPERTY_MANAGER".equals(user.getRole().name())) {
            throw new AccessDeniedException("Only property managers can access inspections");
        }
        return user;
    }

    private InspectionResponse toResponse(Inspection inspection) {
        Property property = inspection.getProperty();
        return InspectionResponse.builder()
                .id(inspection.getId())
                .propertyId(property == null ? null : property.getPropertyId())
                .propertyName(property == null ? null : property.getPropertyName())
                .inspectionDate(inspection.getInspectionDate())
                .inspectorName(inspection.getInspectorName())
                .passed(inspection.getPassed())
                .hasIssuesRequiringAttention(inspection.getHasIssuesRequiringAttention())
                .notes(inspection.getNotes())
                .build();
    }
}
