package com.rental.rental_management_backend.maintenance.service;

import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.entity.PropertyManager;
import com.rental.rental_management_backend.property.repository.PropertyManagerRepository;
import com.rental.rental_management_backend.property.repository.PropertyRepository;

@Service
public class MaintenancePropertyAccessService {

    private final UserRepository userRepository;
    private final PropertyRepository propertyRepository;
    private final PropertyManagerRepository propertyManagerRepository;

    public MaintenancePropertyAccessService(
            UserRepository userRepository,
            PropertyRepository propertyRepository,
            PropertyManagerRepository propertyManagerRepository) {
        this.userRepository = userRepository;
        this.propertyRepository = propertyRepository;
        this.propertyManagerRepository = propertyManagerRepository;
    }

    public User getAuthenticatedUser() {
        Authentication authentication =
                SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || !authentication.isAuthenticated()) {
            throw new AccessDeniedException("User is not authenticated");
        }

        return userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new AccessDeniedException(
                        "Logged-in user not found"));
    }

    public Set<Long> getAuthorizedPropertyIds(User user) {
        if (user.getRole() == RoleType.PROPERTY_OWNER) {
            return propertyRepository.findByOwner(user).stream()
                    .map(Property::getPropertyId)
                    .collect(Collectors.toSet());
        }

        if (user.getRole() == RoleType.PROPERTY_MANAGER) {
            PropertyManager manager = propertyManagerRepository
                    .findByUser(user)
                    .orElseThrow(() -> new AccessDeniedException(
                            "Property manager record not found"));

            return propertyRepository.findByPropertyManager(manager).stream()
                    .map(Property::getPropertyId)
                    .collect(Collectors.toSet());
        }

        if (user.getRole() == RoleType.SUPER_ADMIN) {
            return propertyRepository.findAll().stream()
                    .map(Property::getPropertyId)
                    .collect(Collectors.toSet());
        }

        throw new AccessDeniedException(
                "You do not have permission to manage maintenance workers");
    }

    public Property getAuthorizedProperty(User user, Long propertyId) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new RuntimeException(
                        "Property not found with ID: " + propertyId));

        if (user.getRole() != RoleType.SUPER_ADMIN
                && !getAuthorizedPropertyIds(user)
                        .contains(property.getPropertyId())) {
            throw new AccessDeniedException(
                    "You do not have access to this property");
        }

        return property;
    }
}
