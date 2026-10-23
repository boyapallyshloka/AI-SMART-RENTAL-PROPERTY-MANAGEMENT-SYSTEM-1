
package com.rental.rental_management_backend.property.serviceimpl;

import java.util.List;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.User.enums.UserStatus;
import com.rental.rental_management_backend.exception.ResourceNotFoundException;
import com.rental.rental_management_backend.property.dto.PropertyDetailsResponse;
import com.rental.rental_management_backend.property.dto.PropertyManagerResponse;
import com.rental.rental_management_backend.property.dto.PropertyRequest;
import com.rental.rental_management_backend.property.dto.PropertyResponse;
import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.entity.PropertyManager;
import com.rental.rental_management_backend.property.repository.PropertyManagerRepository;
import com.rental.rental_management_backend.property.repository.PropertyRepository;
import com.rental.rental_management_backend.property.service.PropertyDetailsService;
import com.rental.rental_management_backend.property.service.PropertyManagerService;

@Service
@Transactional
public class PropertyManagerServiceImpl implements PropertyManagerService {

    private final PropertyManagerRepository propertyManagerRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final PropertyDetailsService propertyDetailsService;

    public PropertyManagerServiceImpl(
            PropertyManagerRepository propertyManagerRepository,
            PropertyRepository propertyRepository,
            UserRepository userRepository,
            PropertyDetailsService propertyDetailsService) {

        this.propertyManagerRepository = propertyManagerRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.propertyDetailsService = propertyDetailsService;
    }

    @Override
    @Transactional(readOnly = true)
    public PropertyManagerResponse getMyProfile() {

        User user = getLoggedInUser();

        validatePropertyManager(user);

        PropertyManager propertyManager =
                propertyManagerRepository.findByUser(user)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Property manager profile not found"));

        return convertToResponse(propertyManager);
    }

    @Override
    @Transactional(readOnly = true)
    public PropertyManagerResponse getPropertyManagerById(Long propertyManagerId) {

        PropertyManager propertyManager =
                propertyManagerRepository.findById(propertyManagerId)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Property manager not found with id: "
                                                + propertyManagerId));

        return convertToResponse(propertyManager);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PropertyResponse> getMyAssignedProperties() {

        User user = getLoggedInUser();

        validatePropertyManager(user);

        PropertyManager propertyManager =
                propertyManagerRepository.findByUser(user)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Property manager profile not found"));

        return propertyRepository
                .findByPropertyManager(propertyManager)
                .stream()
                .map(this::convertPropertyToResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public PropertyResponse getMyAssignedPropertyById(Long propertyId) {

        User user = getLoggedInUser();

        validatePropertyManager(user);

        PropertyManager propertyManager =
                propertyManagerRepository.findByUser(user)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Property manager profile not found"));

        Property property =
                propertyRepository.findById(propertyId)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Property not found with id: "
                                                + propertyId));

        if (property.getPropertyManager() == null ||
                !property.getPropertyManager()
                        .getPropertyManagerId()
                        .equals(propertyManager.getPropertyManagerId())) {

            throw new ResourceNotFoundException(
                    "Property not found or not assigned to you");
        }

        return convertPropertyToResponse(property);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PropertyManagerResponse> getEligibleManagers() {
        return propertyManagerRepository
                .findEligibleManagers(UserStatus.ACTIVE, RoleType.PROPERTY_MANAGER)
                .stream()
                .map(this::convertToResponse)
                .toList();
    }

    private User getLoggedInUser() {

        Authentication authentication =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        if (authentication == null ||
                !authentication.isAuthenticated()) {

            throw new RuntimeException(
                    "User is not authenticated");
        }

        String email = authentication.getName();

        return userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new RuntimeException(
                                "Logged-in user not found"));
    }

    private void validatePropertyManager(User user) {

        if (user.getRole() != RoleType.PROPERTY_MANAGER) {

            throw new RuntimeException(
                    "Only PROPERTY_MANAGER can access this resource");
        }
    }

    private PropertyManagerResponse convertToResponse(
            PropertyManager propertyManager) {

        PropertyManagerResponse response =
                new PropertyManagerResponse();

        response.setPropertyManagerId(
                propertyManager.getPropertyManagerId());

        if (propertyManager.getUser() != null) {

            User user = propertyManager.getUser();

            response.setUserId(user.getId());
            response.setFirstName(user.getFirstName());
            response.setLastName(user.getLastName());
            response.setEmail(user.getEmail());
            response.setPhone(user.getPhone());
        }

        response.setCreatedAt(
                propertyManager.getCreatedAt());

        response.setUpdatedAt(
                propertyManager.getUpdatedAt());

        return response;
    }

    private PropertyResponse convertPropertyToResponse(
            Property property) {

        PropertyResponse response =
                new PropertyResponse();

        response.setPropertyId(
                property.getPropertyId());

        response.setPropertyName(
                property.getPropertyName());

        response.setPropertyType(
                property.getPropertyType());

        response.setDescription(
                property.getDescription());

        response.setTotalArea(
                property.getTotalArea());

        response.setBedrooms(property.getBedrooms());

        response.setBathrooms(property.getBathrooms());

        response.setFloorNumber(property.getFloorNumber());

        response.setTotalFloors(property.getTotalFloors());

        response.setFurnishingStatus(
                property.getFurnishingStatus());

        response.setParkingAvailable(
                property.getParkingAvailable());

        response.setYearBuilt(
                property.getYearBuilt());

        response.setMonthlyRent(property.getMonthlyRent());
        response.setSecurityDeposit(property.getSecurityDeposit());

        response.setStatus(
                property.getStatus());

        if (property.getOwner() != null) {

            response.setOwnerId(
                    property.getOwner().getId());

            response.setOwnerName(
                    property.getOwner().getFirstName()
                            + " "
                            + property.getOwner().getLastName());
        }

        if (property.getPropertyManager() != null) {
            PropertyManager pm = property.getPropertyManager();
            response.setPropertyManagerId(pm.getPropertyManagerId());
            if (pm.getUser() != null) {
                User u = pm.getUser();
                String firstName = u.getFirstName() != null ? u.getFirstName().trim() : "";
                String lastName = u.getLastName() != null ? u.getLastName().trim() : "";
                String fullName = (firstName + " " + lastName).trim();
                response.setManagerName(fullName.isEmpty() ? null : fullName);
                response.setManagerEmail(u.getEmail());
                response.setManagerPhone(u.getPhone());
            }
        }

        response.setCreatedAt(
                property.getCreatedAt());

        response.setUpdatedAt(
                property.getUpdatedAt());

        return response;
    }
    @Override
    @Transactional(readOnly = true)
    public PropertyDetailsResponse getMyAssignedPropertyDetails(Long propertyId) {

        PropertyResponse property =
                getMyAssignedPropertyById(propertyId);

        return propertyDetailsService.getPropertyDetailsForManager(
                propertyId,
                property);
    }

    @Override
    public PropertyResponse updateAssignedProperty(
            Long propertyId,
            PropertyRequest request) {

        User user = getLoggedInUser();

        validatePropertyManager(user);

        PropertyManager propertyManager =
                propertyManagerRepository.findByUser(user)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Property manager profile not found"));

        Property property =
                propertyRepository.findById(propertyId)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Property not found with id: "
                                                + propertyId));

        if (property.getPropertyManager() == null ||
                !property.getPropertyManager()
                        .getPropertyManagerId()
                        .equals(propertyManager.getPropertyManagerId())) {

            throw new AccessDeniedException(
                    "You do not have permission to edit this property as it is not assigned to you");
        }

        property.setPropertyName(request.getPropertyName());
        property.setPropertyType(request.getPropertyType());
        property.setDescription(request.getDescription());
        property.setTotalArea(request.getTotalArea());
        property.setBedrooms(request.getBedrooms());
        property.setBathrooms(request.getBathrooms());
        property.setFloorNumber(request.getFloorNumber());
        property.setTotalFloors(request.getTotalFloors());
        property.setFurnishingStatus(request.getFurnishingStatus());
        property.setParkingAvailable(request.getParkingAvailable());
        property.setYearBuilt(request.getYearBuilt());

        Property updatedProperty =
                propertyRepository.save(property);

        return convertPropertyToResponse(updatedProperty);
    }
}
