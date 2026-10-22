
package com.rental.rental_management_backend.property.serviceimpl;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.exception.ResourceNotFoundException;
import com.rental.rental_management_backend.property.dto.PropertyCardResponse;
import com.rental.rental_management_backend.property.dto.PropertyRequest;
import com.rental.rental_management_backend.property.dto.PropertyResponse;
import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.entity.PropertyManager;
import com.rental.rental_management_backend.property.enums.FurnishingStatus;
import com.rental.rental_management_backend.property.enums.PropertyStatus;
import com.rental.rental_management_backend.property.enums.PropertyType;
import com.rental.rental_management_backend.property.repository.PropertyManagerRepository;
import com.rental.rental_management_backend.property.repository.PropertyRepository;
import com.rental.rental_management_backend.property.service.PropertyService;
import com.rental.rental_management_backend.s3.service.S3Service;

@Service
@Transactional
public class PropertyServiceImpl implements PropertyService {

	private final PropertyRepository propertyRepository;
	private final UserRepository userRepository;
	private final PropertyManagerRepository propertyManagerRepository;
	private final PropertyNotificationDispatcher notificationDispatcher;
	private final S3Service s3Service;
	private final com.rental.rental_management_backend.property.service.PropertyDocumentService propertyDocumentService;

	public PropertyServiceImpl(
	        PropertyRepository propertyRepository,
	        UserRepository userRepository,
	        PropertyManagerRepository propertyManagerRepository,
	        PropertyNotificationDispatcher notificationDispatcher,
	        S3Service s3Service,
	        com.rental.rental_management_backend.property.service.PropertyDocumentService propertyDocumentService) {

	    this.propertyRepository = propertyRepository;
	    this.userRepository = userRepository;
	    this.propertyManagerRepository = propertyManagerRepository;
	    this.notificationDispatcher = notificationDispatcher;
	    this.s3Service = s3Service;
	    this.propertyDocumentService = propertyDocumentService;
	}
	@Override
	public PropertyResponse createProperty(PropertyRequest request) {

	    User owner = getLoggedInUser();

	    validateOwner(owner);

	    Property property = new Property();

	    property.setPropertyName(request.getPropertyName());
	    property.setPropertyType(request.getPropertyType());
            applyPropertyRentalDetails(property, request, false);
	    property.setDescription(request.getDescription());
	    property.setTotalArea(request.getTotalArea());
	    property.setFurnishingStatus(request.getFurnishingStatus());
	    property.setParkingAvailable(request.getParkingAvailable());
	    property.setYearBuilt(request.getYearBuilt());

	    // Owner comes from the authenticated JWT user.
	    property.setOwner(owner);

	    // Newly created properties start as DRAFT.
	    property.setStatus(PropertyStatus.DRAFT);

	    Property savedProperty = propertyRepository.save(property);

	    String ownerEmail = owner.getEmail();
	    String propertyName = savedProperty.getPropertyName();
	    Runnable notification = () ->
	            notificationDispatcher.sendPropertyCreatedEmail(
	                    ownerEmail,
	                    propertyName);

	    if (TransactionSynchronizationManager.isSynchronizationActive()) {
	        TransactionSynchronizationManager.registerSynchronization(
	                new TransactionSynchronization() {
	                    @Override
	                    public void afterCommit() {
	                        notification.run();
	                    }
	                });
	    } else {
	        notification.run();
	    }

	    return convertToResponse(savedProperty);
	}

    @Override
    @Transactional(readOnly = true)
    public List<PropertyResponse> getMyProperties() {

        User user = getLoggedInUser();

        if (user.getRole() == RoleType.PROPERTY_OWNER) {
            return propertyRepository.findByOwner(user)
                    .stream()
                    .map(this::convertToResponse)
                    .toList();
        }

        if (user.getRole() == RoleType.TENANT) {
            return propertyRepository.findByStatusIn(List.of(PropertyStatus.AVAILABLE, PropertyStatus.PUBLISHED))
                    .stream()
                    .map(this::convertToResponse)
                    .toList();
        }

        validateOwner(user);

        return List.of();
    }

    @Override
    @Transactional(readOnly = true)
    public PropertyResponse getMyPropertyById(Long id) {

        Authentication authentication =
                SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || !authentication.isAuthenticated()) {
            throw new RuntimeException("User is not authenticated");
        }

        if (authentication.getAuthorities().stream()
                .noneMatch(authority ->
                        authority.getAuthority().equals("ROLE_PROPERTY_OWNER"))) {
            throw new RuntimeException(
                    "Only PROPERTY_OWNER can manage properties");
        }

        Property property =
                propertyRepository
                        .findOwnedPropertyByIdAndOwnerEmail(
                                id,
                                authentication.getName(),
                                RoleType.PROPERTY_OWNER)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Property not found or you do not have permission"
                                ));

        return convertToResponse(property);
    }

    /*
     * GET ALL AVAILABLE PROPERTIES
     *
     * Used by tenants to browse properties
     * that are currently available for rental.
     */

@Override
@Transactional(readOnly = true)
public List<PropertyCardResponse> getAvailableProperties() {

	List<PropertyCardResponse> propertyCards =
	        propertyRepository.findAvailablePropertyCards(
	                PropertyStatus.AVAILABLE);

	for (PropertyCardResponse card : propertyCards) {
	    card.setImageUrl(toPublicImageUrl(card.getImageUrl()));
	}

	return propertyCards;
}

private String toPublicImageUrl(String imageUrl) {
	if (imageUrl == null || imageUrl.isBlank()) {
	    return null;
	}

	if (imageUrl.startsWith("http://")
	        || imageUrl.startsWith("https://")
	        || imageUrl.startsWith("/uploads/")) {
	    return imageUrl;
	}

	try {
	    return s3Service.generatePresignedUrl(imageUrl);
	} catch (Exception ex) {
	    return null;
	}
}
    /*
     * GET ONE AVAILABLE PROPERTY
     *
     * Used by tenants to view a specific
     * available property.
     */

    @Override
    @Transactional(readOnly = true)
    public PropertyResponse getPublicPropertyById(Long propertyId) {

        Property property =
                propertyRepository
                        .findById(propertyId)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Property not found with id: "
                                                + propertyId
                                ));

        if (property.getStatus() != PropertyStatus.AVAILABLE && property.getStatus() != PropertyStatus.PUBLISHED) {

            throw new RuntimeException(
                    "Property is not available for tenants"
            );
        }

        return convertToResponse(property);
    }

    @Override
    public PropertyResponse updateProperty(
            Long id,
            PropertyRequest request) {

        User owner = getLoggedInUser();

        validateOwner(owner);

        Property property =
                propertyRepository
                        .findByPropertyIdAndOwner(id, owner)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Property not found or you do not have permission"
                                ));

        property.setPropertyName(request.getPropertyName());

        property.setPropertyType(request.getPropertyType());

        applyPropertyRentalDetails(property, request, true);

        property.setDescription(request.getDescription());

        property.setTotalArea(request.getTotalArea());

        property.setFurnishingStatus(request.getFurnishingStatus());

        property.setParkingAvailable(request.getParkingAvailable());

        property.setYearBuilt(request.getYearBuilt());

        /*
         * Owner and status are intentionally not changed
         * during normal property update.
         */

        Property updatedProperty =
                propertyRepository.save(property);

        return convertToResponse(updatedProperty);
    }

    @Override
    public void deleteProperty(Long id) {

        User owner = getLoggedInUser();

        validateOwner(owner);

        Property property =
                propertyRepository
                        .findByPropertyIdAndOwner(id, owner)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Property not found or you do not have permission"
                                ));

        propertyRepository.delete(property);
    }

    @Override
    public PropertyResponse updatePropertyStatus(
            Long id,
            PropertyStatus status) {

        User owner = getLoggedInUser();

        validateOwner(owner);

        if (status == null) {

            throw new RuntimeException(
                    "Property status is required"
            );
        }

        Property property =
                propertyRepository
                        .findByPropertyIdAndOwner(id, owner)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Property not found or you do not have permission"
                                ));

        // Enforce document approval before a property can transition to PUBLISHED or AVAILABLE
        if (status == PropertyStatus.AVAILABLE || status == PropertyStatus.PUBLISHED) {
            propertyDocumentService.validatePropertyPublishEligibility(property);
        }

        property.setStatus(status);

        Property updatedProperty =
                propertyRepository.save(property);

        return convertToResponse(updatedProperty);
    }

    private User getLoggedInUser() {

        Authentication authentication =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        if (authentication == null ||
                !authentication.isAuthenticated()) {

            throw new RuntimeException(
                    "User is not authenticated"
            );
        }

        String email = authentication.getName();

        return userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new RuntimeException(
                                "Logged-in user not found"
                        ));
    }

    private void validateOwner(User user) {

        if (user.getRole() != RoleType.PROPERTY_OWNER) {

            throw new RuntimeException(
                    "Only PROPERTY_OWNER can manage properties"
            );
        }
    }

        private void applyPropertyRentalDetails(
                        Property property,
                        PropertyRequest request,
                        boolean preserveMissingValues) {
                PropertyType propertyType = request.getPropertyType();
                boolean directRental = propertyType == PropertyType.HOUSE
                                || propertyType == PropertyType.VILLA;

                if (!directRental) {
                        property.setMonthlyRent(null);
                        property.setSecurityDeposit(null);
                        return;
                }

                if (!preserveMissingValues || request.getMonthlyRent() != null) {
                        property.setMonthlyRent(request.getMonthlyRent());
                }
                if (!preserveMissingValues || request.getSecurityDeposit() != null) {
                        property.setSecurityDeposit(request.getSecurityDeposit());
                }
        }

    private PropertyResponse convertToResponse(
            Property property) {

        PropertyResponse response =
                new PropertyResponse();

        response.setPropertyId(
                property.getPropertyId()
        );

        response.setPropertyName(
                property.getPropertyName()
        );

        response.setPropertyType(
                property.getPropertyType()
        );

        response.setMonthlyRent(property.getMonthlyRent());

        response.setSecurityDeposit(property.getSecurityDeposit());

        response.setDescription(
                property.getDescription()
        );

        response.setTotalArea(
                property.getTotalArea()
        );

        response.setFurnishingStatus(
                property.getFurnishingStatus()
        );

        response.setParkingAvailable(
                property.getParkingAvailable()
        );

        response.setYearBuilt(
                property.getYearBuilt()
        );

        response.setStatus(
                property.getStatus()
        );

        if (property.getOwner() != null) {

            response.setOwnerId(
                    property.getOwner().getId()
            );

            response.setOwnerName(
                    property.getOwner().getFirstName()
                            + " "
                            + property.getOwner().getLastName()
            );
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
                property.getCreatedAt()
        );

        response.setUpdatedAt(
                property.getUpdatedAt()
        );

        return response;
    }
    
    @Override
    public PropertyResponse assignPropertyManager(
            Long propertyId,
            Long propertyManagerId) {

        User owner = getLoggedInUser();

        validateOwner(owner);

        Property property =
                propertyRepository
                        .findByPropertyIdAndOwner(propertyId, owner)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Property not found or you do not have permission"));

        PropertyManager propertyManager =
                propertyManagerRepository
                        .findById(propertyManagerId)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Property manager not found with id: "
                                                + propertyManagerId));

        if (propertyManager.getUser() == null) {
            throw new IllegalArgumentException(
                    "Property manager is not linked to a user");
        }

        if (propertyManager.getUser().getRole()
                != RoleType.PROPERTY_MANAGER) {

            throw new IllegalArgumentException(
                    "Selected user is not a PROPERTY_MANAGER");
        }

        property.setPropertyManager(propertyManager);

        Property updatedProperty =
                propertyRepository.save(property);

        return convertToResponse(updatedProperty);
    }


    @Override
    public PropertyResponse removePropertyManager(
            Long propertyId) {

        User owner = getLoggedInUser();

        validateOwner(owner);

        Property property =
                propertyRepository
                        .findByPropertyIdAndOwner(propertyId, owner)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Property not found or you do not have permission"));

        property.setPropertyManager(null);

        Property updatedProperty =
                propertyRepository.save(property);

        return convertToResponse(updatedProperty);
    }
    @Override
    @Transactional(readOnly = true)
    public List<PropertyResponse> searchAvailableProperties(
            String searchQuery,
            String city,
            PropertyType propertyType,
            FurnishingStatus furnishingStatus,
            Boolean parkingAvailable,
            Double minRent,
            Double maxRent,
            Integer bedrooms
    ) {

        // Normalize text filters
        searchQuery = normalize(searchQuery);
        city = normalize(city);

        // Validate rent range
        if (minRent != null && minRent < 0) {
            throw new IllegalArgumentException("Minimum rent cannot be negative");
        }

        if (maxRent != null && maxRent < 0) {
            throw new IllegalArgumentException("Maximum rent cannot be negative");
        }

        if (minRent != null && maxRent != null && minRent > maxRent) {
            throw new IllegalArgumentException(
                    "Minimum rent cannot be greater than maximum rent"
            );
        }

        // Validate bedrooms
        if (bedrooms != null && bedrooms < 0) {
            throw new IllegalArgumentException(
                    "Bedrooms cannot be negative"
            );
        }

        List<Property> properties = propertyRepository.searchAvailableProperties(
                PropertyStatus.AVAILABLE,
                searchQuery,
                city,
                propertyType,
                furnishingStatus,
                parkingAvailable,
                minRent,
                maxRent,
                bedrooms
        );

        return properties.stream()
                .map(this::convertToResponse)
                .toList();
    }
    private String normalize(String value) {

        if (value == null || value.trim().isEmpty()) {
            return null;
        }

        return value.trim();
    }
    
}
