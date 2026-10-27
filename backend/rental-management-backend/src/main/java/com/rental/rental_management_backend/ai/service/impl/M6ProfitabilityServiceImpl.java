package com.rental.rental_management_backend.ai.service.impl;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.ai.dto.M6ProfitabilityResponse;
import com.rental.rental_management_backend.ai.service.M6ProfitabilityService;
import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.entity.PropertyManager;
import com.rental.rental_management_backend.property.repository.PropertyRepository;

@Service
public class M6ProfitabilityServiceImpl implements M6ProfitabilityService {

    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;

    public M6ProfitabilityServiceImpl(
            PropertyRepository propertyRepository,
            UserRepository userRepository) {
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
    }

    @Override
    public M6ProfitabilityResponse predictPropertyProfitability(Long propertyId) {
        if (propertyId == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Property ID is required");
        }

        Authentication authentication =
                SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication.getName() == null
                || authentication.getName().isBlank()) {
            throw new AccessDeniedException("User is not authenticated");
        }

        User authenticatedUser = userRepository.findByEmail(authentication.getName())
                .orElseThrow(() -> new AccessDeniedException(
                        "Authenticated user not found"));

        Property property = propertyRepository.findDetailsById(propertyId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Property not found"));

        if (!canAccessProperty(authenticatedUser, property)) {
            throw new AccessDeniedException(
                    "You do not have permission to view this property profitability prediction");
        }

        throw new ResponseStatusException(
                HttpStatus.NOT_IMPLEMENTED,
                "M6 feature aggregation is not implemented yet");
    }

    private boolean canAccessProperty(User user, Property property) {
        return switch (user.getRole()) {
            case SUPER_ADMIN -> true;
            case PROPERTY_OWNER -> property.getOwner() != null
                    && user.getId().equals(property.getOwner().getId());
            case PROPERTY_MANAGER -> {
                PropertyManager manager = property.getPropertyManager();
                yield manager != null
                        && manager.getUser() != null
                        && user.getId().equals(manager.getUser().getId());
            }
            case TENANT -> false;
        };
    }
}
