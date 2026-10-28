package com.rental.rental_management_backend.maintenance.service;

import java.util.List;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.exception.ResourceNotFoundException;
import com.rental.rental_management_backend.maintenance.dto.InspectionRequest;
import com.rental.rental_management_backend.maintenance.dto.InspectionResponse;
import com.rental.rental_management_backend.maintenance.entity.Inspection;
import com.rental.rental_management_backend.maintenance.repository.InspectionRepository;
import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.repository.PropertyRepository;

@Service
@Transactional
public class InspectionServiceImpl implements InspectionService {

    private final InspectionRepository inspectionRepository;
    private final PropertyRepository propertyRepository;
    private final MaintenancePropertyAccessService propertyAccessService;

    public InspectionServiceImpl(
            InspectionRepository inspectionRepository,
            PropertyRepository propertyRepository,
            MaintenancePropertyAccessService propertyAccessService) {
        this.inspectionRepository = inspectionRepository;
        this.propertyRepository = propertyRepository;
        this.propertyAccessService = propertyAccessService;
    }

    @Override
    public InspectionResponse createInspection(InspectionRequest request) {
        User user = propertyAccessService.getAuthenticatedUser();
        Property property = getAuthorizedProperty(user, request.getPropertyId());

        Inspection inspection = new Inspection();
        applyRequest(inspection, request, property);

        return mapToResponse(inspectionRepository.save(inspection));
    }

    @Override
    @Transactional(readOnly = true)
    public InspectionResponse getInspectionById(Long inspectionId) {
        User user = propertyAccessService.getAuthenticatedUser();
        Inspection inspection = findInspection(inspectionId);
        authorizeInspectionProperty(user, inspection);

        return mapToResponse(inspection);
    }

    @Override
    @Transactional(readOnly = true)
    public List<InspectionResponse> getInspectionsByProperty(Long propertyId) {
        User user = propertyAccessService.getAuthenticatedUser();
        Property property = getAuthorizedProperty(user, propertyId);

        return inspectionRepository
                .findByProperty_PropertyId(property.getPropertyId())
                .stream()
                .map(this::mapToResponse)
                .toList();
    }

    @Override
    public InspectionResponse updateInspection(
            Long inspectionId,
            InspectionRequest request) {
        User user = propertyAccessService.getAuthenticatedUser();
        Inspection inspection = findInspection(inspectionId);
        authorizeInspectionProperty(user, inspection);

        Property property = getAuthorizedProperty(user, request.getPropertyId());
        applyRequest(inspection, request, property);

        return mapToResponse(inspectionRepository.save(inspection));
    }

    @Override
    public void deleteInspection(Long inspectionId) {
        User user = propertyAccessService.getAuthenticatedUser();
        Inspection inspection = findInspection(inspectionId);
        authorizeInspectionProperty(user, inspection);

        inspectionRepository.delete(inspection);
    }

    private Inspection findInspection(Long inspectionId) {
        return inspectionRepository.findById(inspectionId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Inspection not found with ID: " + inspectionId));
    }

    private Property getAuthorizedProperty(User user, Long propertyId) {
        propertyRepository.findById(propertyId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Property not found with ID: " + propertyId));

        return propertyAccessService.getAuthorizedProperty(user, propertyId);
    }

    private void authorizeInspectionProperty(User user, Inspection inspection) {
        if (inspection.getProperty() == null
                || inspection.getProperty().getPropertyId() == null) {
            throw new AccessDeniedException(
                    "Inspection is not associated with a property");
        }

        propertyAccessService.getAuthorizedProperty(
                user,
                inspection.getProperty().getPropertyId());
    }

    private void applyRequest(
            Inspection inspection,
            InspectionRequest request,
            Property property) {
        inspection.setProperty(property);
        inspection.setInspectionDate(request.getInspectionDate());
        inspection.setInspectorName(request.getInspectorName().trim());
        inspection.setPassed(request.getPassed());
        inspection.setHasIssuesRequiringAttention(
                request.getHasIssuesRequiringAttention());
        inspection.setNotes(request.getNotes());
    }

    private InspectionResponse mapToResponse(Inspection inspection) {
        InspectionResponse response = new InspectionResponse();
        response.setId(inspection.getId());
        response.setPropertyId(
                inspection.getProperty().getPropertyId());
        response.setInspectionDate(inspection.getInspectionDate());
        response.setInspectorName(inspection.getInspectorName());
        response.setPassed(inspection.getPassed());
        response.setHasIssuesRequiringAttention(
                inspection.getHasIssuesRequiringAttention());
        response.setNotes(inspection.getNotes());
        return response;
    }
}
