
package com.rental.rental_management_backend.property.serviceimpl;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.exception.ResourceNotFoundException;
import com.rental.rental_management_backend.property.dto.PropertyAddressRequest;
import com.rental.rental_management_backend.property.dto.PropertyAddressResponse;
import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.entity.PropertyAddress;
import com.rental.rental_management_backend.property.enums.PropertyStatus;
import com.rental.rental_management_backend.property.repository.PropertyAddressRepository;
import com.rental.rental_management_backend.property.repository.PropertyRepository;
import com.rental.rental_management_backend.property.service.PropertyAddressService;

@Service
@Transactional(noRollbackFor = ResourceNotFoundException.class)
public class PropertyAddressServiceImpl
        implements PropertyAddressService {

    private final PropertyAddressRepository addressRepository;

    private final PropertyRepository propertyRepository;

    private final UserRepository userRepository;

    public PropertyAddressServiceImpl(
            PropertyAddressRepository addressRepository,
            PropertyRepository propertyRepository,
            UserRepository userRepository) {

        this.addressRepository = addressRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
    }

    @Override
    public PropertyAddressResponse createAddress(
            Long propertyId,
            PropertyAddressRequest request) {

        Property property = getOwnedProperty(propertyId);

        if (addressRepository.existsByProperty(property)) {

            throw new RuntimeException(
                    "Address already exists for this property"
            );
        }

        PropertyAddress address = new PropertyAddress();

        mapRequestToEntity(request, address);

        address.setProperty(property);

        PropertyAddress savedAddress =
                addressRepository.save(address);

        return convertToResponse(savedAddress);
    }

    @Override
    public PropertyAddressResponse getAddressByPropertyId(
            Long propertyId) {

        PropertyAddress address =
                getOwnedAddress(propertyId);

        return convertToResponse(address);
    }

    @Override
    public PropertyAddressResponse updateAddress(
            Long propertyId,
            PropertyAddressRequest request) {

        PropertyAddress address =
                getOwnedAddress(propertyId);

        mapRequestToEntity(request, address);

        PropertyAddress updatedAddress =
                addressRepository.save(address);

        return convertToResponse(updatedAddress);
    }

    @Override
    public void deleteAddress(Long propertyId) {

        PropertyAddress address =
                getOwnedAddress(propertyId);

        addressRepository.delete(address);
    }

    private PropertyAddress getOwnedAddress(Long propertyId) {
        User loggedInUser = getLoggedInUser();
        validateOwner(loggedInUser);

        return addressRepository
                .findByPropertyIdAndOwner(propertyId, loggedInUser)
                .orElseGet(() -> {
                    Property property =
                            propertyRepository
                                    .findByPropertyIdAndOwner(
                                            propertyId,
                                            loggedInUser)
                                    .orElseThrow(() ->
                                            new ResourceNotFoundException(
                                                    "Property not found or you do not have permission"));

                    return addressRepository.findByProperty(property)
                            .orElseThrow(() ->
                                    new ResourceNotFoundException(
                                            "Address not found for this property"));
                });
    }

    /*
     * OWNER PROPERTY ACCESS
     *
     * Used only by owner management operations.
     */
    private Property getOwnedProperty(Long propertyId) {

        User loggedInUser = getLoggedInUser();

        validateOwner(loggedInUser);

        return propertyRepository
                .findByPropertyIdAndOwner(
                        propertyId,
                        loggedInUser
                )
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Property not found or you do not have permission"
                        )
                );
    }

    /*
     * GET LOGGED-IN USER
     */
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

        return userRepository
                .findByEmail(email)
                .orElseThrow(() ->
                        new RuntimeException(
                                "Logged-in user not found"
                        )
                );
    }

    /*
     * OWNER VALIDATION
     *
     * This is intentionally kept unchanged
     * for owner management operations.
     */
    private void validateOwner(User user) {

        if (user.getRole() != RoleType.PROPERTY_OWNER) {

            throw new RuntimeException(
                    "Only PROPERTY_OWNER can manage property addresses"
            );
        }
    }

    /*
     * PUBLIC ADDRESS READ
     *
     * Used when a TENANT views an AVAILABLE property.
     *
     * This method does NOT call getOwnedProperty()
     * because a tenant does not own the property.
     */
    @Override
    public PropertyAddressResponse getPublicAddressByPropertyId(
            Long propertyId) {

        PropertyAddress address =
                addressRepository
                        .findByPropertyIdAndStatus(
                                propertyId,
                                PropertyStatus.AVAILABLE)
                        .orElseGet(() -> {
                            Property property =
                                    propertyRepository
                                            .findById(propertyId)
                                            .orElseThrow(() ->
                                                    new RuntimeException(
                                                            "Property not found with id: "
                                                                    + propertyId));

                            if (property.getStatus() != PropertyStatus.AVAILABLE
                                    && property.getStatus() != PropertyStatus.PUBLISHED) {
                                throw new RuntimeException(
                                        "Property is not available for tenants");
                            }

                            return addressRepository
                                    .findByProperty(property)
                                    .orElseThrow(() ->
                                            new RuntimeException(
                                                    "Address not found for this property"));
                        });

        return convertToResponse(address);
    }

    /*
     * MAP REQUEST TO ENTITY
     */
    private void mapRequestToEntity(
            PropertyAddressRequest request,
            PropertyAddress address) {

        address.setAddressLine1(
                request.getAddressLine1()
        );

        address.setAddressLine2(
                request.getAddressLine2()
        );

        address.setArea(
                request.getArea()
        );

        // M1: Area Type
        address.setAreaType(
                request.getAreaType()
        );

        address.setCity(
                request.getCity()
        );

        address.setState(
                request.getState()
        );

        address.setCountry(
                request.getCountry()
        );

        address.setPincode(
                request.getPincode()
        );

        address.setLatitude(
                request.getLatitude()
        );

        address.setLongitude(
                request.getLongitude()
        );
    }

    /*
     * ENTITY TO RESPONSE
     */
    private PropertyAddressResponse convertToResponse(
            PropertyAddress address) {

        PropertyAddressResponse response =
                new PropertyAddressResponse();

        response.setAddressId(
                address.getAddressId()
        );

        response.setPropertyId(
                address.getProperty()
                        .getPropertyId()
        );

        response.setAddressLine1(
                address.getAddressLine1()
        );

        response.setAddressLine2(
                address.getAddressLine2()
        );

        response.setArea(
                address.getArea()
        );

        // M1: Area Type
        response.setAreaType(
                address.getAreaType()
        );

        response.setCity(
                address.getCity()
        );

        response.setState(
                address.getState()
        );

        response.setCountry(
                address.getCountry()
        );

        response.setPincode(
                address.getPincode()
        );

        response.setLatitude(
                address.getLatitude()
        );

        response.setLongitude(
                address.getLongitude()
        );

        response.setCreatedAt(
                address.getCreatedAt()
        );

        response.setUpdatedAt(
                address.getUpdatedAt()
        );

        return response;
    }
}
