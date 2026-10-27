package com.rental.rental_management_backend.property.serviceimpl;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.exception.ResourceNotFoundException;
import com.rental.rental_management_backend.property.dto.PropertyImageResponse;
import com.rental.rental_management_backend.property.dto.PublicPropertyImageResponse;
import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.entity.PropertyImage;
import com.rental.rental_management_backend.property.enums.PropertyStatus;
import com.rental.rental_management_backend.property.repository.PropertyImageRepository;
import com.rental.rental_management_backend.property.repository.PropertyRepository;
import com.rental.rental_management_backend.property.service.PropertyImageService;
import com.rental.rental_management_backend.s3.service.S3Service;

@Service
@Transactional
public class PropertyImageServiceImpl implements PropertyImageService {

    private final PropertyImageRepository propertyImageRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final S3Service s3Service;

    public PropertyImageServiceImpl(
            PropertyImageRepository propertyImageRepository,
            PropertyRepository propertyRepository,
            UserRepository userRepository,
            S3Service s3Service) {

        this.propertyImageRepository = propertyImageRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.s3Service = s3Service;
    }

    // =========================================================
    // ADD IMAGE
    // =========================================================

    @Override
    public PropertyImageResponse addImage(
            Long propertyId,
            MultipartFile file,
            String imageType,
            Boolean isPrimary) {

        validateFile(file);

        User authenticatedUser = getAuthenticatedUser();

        Property property = getAccessibleProperty(
                propertyId,
                authenticatedUser);

        String imageUrl = saveFile(file, propertyId);

        /*
         * If this image is primary,
         * remove primary status from existing images.
         */
        if (Boolean.TRUE.equals(isPrimary)) {

            List<PropertyImage> existingImages =
                    propertyImageRepository.findByProperty(property);

            for (PropertyImage image : existingImages) {
                image.setIsPrimary(false);
            }

            propertyImageRepository.saveAll(existingImages);
        }

        PropertyImage image = new PropertyImage();

        image.setImageUrl(imageUrl);
        image.setImageType(imageType);
        image.setIsPrimary(Boolean.TRUE.equals(isPrimary));
        image.setProperty(property);

        PropertyImage savedImage =
                propertyImageRepository.save(image);

        return mapToResponse(savedImage);
    }

    // =========================================================
    // GET ALL IMAGES FOR PROPERTY
    // =========================================================

    @Override
    public List<PropertyImageResponse> getImagesByProperty(
            Long propertyId) {

        User authenticatedUser = getAuthenticatedUser();

        Property property = getAccessibleProperty(
                propertyId,
                authenticatedUser);

        return propertyImageRepository
                .findByProperty(property)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // =========================================================
    // GET IMAGE BY ID
    // =========================================================

    @Override
    public PropertyImageResponse getImageById(
            Long imageId) {

        User authenticatedUser = getAuthenticatedUser();

        PropertyImage image = propertyImageRepository
                .findByImageId(imageId)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Image not found with ID: " + imageId));

        validateImageAccess(
                image.getProperty(),
                authenticatedUser);

        return mapToResponse(image);
    }

    // =========================================================
    // UPDATE IMAGE
    // =========================================================

    @Override
    public PropertyImageResponse updateImage(
            Long imageId,
            MultipartFile file,
            String imageType,
            Boolean isPrimary) {

        User authenticatedUser = getAuthenticatedUser();

        PropertyImage image = propertyImageRepository
                .findByImageId(imageId)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Image not found with ID: " + imageId));

        Property property = image.getProperty();

        validateImageAccess(
                property,
                authenticatedUser);

        /*
         * Replace existing file if a new file is provided.
         */
        if (file != null && !file.isEmpty()) {

            validateFile(file);

            // Delete old image from S3
            deletePhysicalFile(image.getImageUrl());

            // Upload new image to S3
            String newImageUrl =
                    saveFile(
                            file,
                            property.getPropertyId());

            image.setImageUrl(newImageUrl);
        }

        if (imageType != null && !imageType.isBlank()) {
            image.setImageType(imageType);
        }

        /*
         * Make this image primary.
         */
        if (Boolean.TRUE.equals(isPrimary)) {

            List<PropertyImage> existingImages =
                    propertyImageRepository.findByProperty(property);

            for (PropertyImage existingImage : existingImages) {
                existingImage.setIsPrimary(false);
            }

            propertyImageRepository.saveAll(existingImages);

            image.setIsPrimary(true);

        } else if (Boolean.FALSE.equals(isPrimary)) {

            image.setIsPrimary(false);
        }

        PropertyImage updatedImage =
                propertyImageRepository.save(image);

        return mapToResponse(updatedImage);
    }

    // =========================================================
    // DELETE IMAGE
    // =========================================================

    @Override
    public void deleteImage(Long imageId) {

        User authenticatedUser = getAuthenticatedUser();

        PropertyImage image = propertyImageRepository
                .findByImageId(imageId)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Image not found with ID: " + imageId));

        validateImageAccess(
                image.getProperty(),
                authenticatedUser);

        // Delete image from S3
        deletePhysicalFile(image.getImageUrl());

        // Delete database record
        propertyImageRepository.delete(image);
    }

    // =========================================================
    // GET ACCESSIBLE PROPERTY
    // =========================================================

    private Property getAccessibleProperty(
            Long propertyId,
            User authenticatedUser) {

        Property property = propertyRepository
                .findById(propertyId)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Property not found with ID: "
                                        + propertyId));

        validateImageAccess(
                property,
                authenticatedUser);

        return property;
    }

    // =========================================================
    // VALIDATE PROPERTY ACCESS
    // =========================================================

    private void validateImageAccess(
            Property property,
            User authenticatedUser) {

        if (property == null) {

            throw new AccessDeniedException(
                    "Property not found");
        }

        /*
         * PROPERTY_OWNER access
         */
        if (property.getOwner() != null
                && property.getOwner()
                        .getId()
                        .equals(authenticatedUser.getId())) {

            return;
        }

        /*
         * PROPERTY_MANAGER access
         *
         * Manager can access the property only when
         * the property is assigned to that manager.
         */
        if (property.getPropertyManager() != null
                && property.getPropertyManager().getUser() != null
                && property.getPropertyManager()
                        .getUser()
                        .getId()
                        .equals(authenticatedUser.getId())) {

            return;
        }

        throw new AccessDeniedException(
                "You are not authorized to access this property image");
    }

    // =========================================================
    // SAVE FILE TO S3
    // =========================================================

    private String saveFile(
            MultipartFile file,
            Long propertyId) {

        try {

            /*
             * Upload property image to:
             *
             * property-images/{propertyId}/
             *
             * Example:
             * property-images/5/uuid_image.jpg
             *
             * The returned value is the S3 object key.
             */
            return s3Service.uploadFile(
                    file,
                    "property-images/" + propertyId);

        } catch (Exception e) {

            throw new RuntimeException(
                    "Failed to upload image to S3",
                    e);
        }
    }

    // =========================================================
    // DELETE FILE FROM S3
    // =========================================================

    private void deletePhysicalFile(
            String imageUrl) {

        if (imageUrl == null
                || imageUrl.isBlank()) {

            return;
        }

        try {

            /*
             * imageUrl contains the S3 object key.
             *
             * Example:
             * property-images/5/uuid_image.jpg
             */
            s3Service.deleteFile(imageUrl);

        } catch (Exception e) {

            System.err.println(
                    "Could not delete image from S3: "
                            + e.getMessage());
        }
    }

    // =========================================================
    // VALIDATE FILE
    // =========================================================

    private void validateFile(
            MultipartFile file) {

        if (file == null
                || file.isEmpty()) {

            throw new IllegalArgumentException(
                    "Please select an image file");
        }

        String contentType =
                file.getContentType();

        if (contentType == null
                || !(contentType.equalsIgnoreCase("image/jpeg")
                || contentType.equalsIgnoreCase("image/png")
                || contentType.equalsIgnoreCase("image/jpg")
                || contentType.equalsIgnoreCase("image/webp"))) {

            throw new IllegalArgumentException(
                    "Only JPG, JPEG, PNG and WEBP images are allowed");
        }

        /*
         * Maximum 5 MB.
         */
        long maxSize =
                5 * 1024 * 1024;

        if (file.getSize() > maxSize) {

            throw new IllegalArgumentException(
                    "Image size must not exceed 5 MB");
        }
    }

    // =========================================================
    // GET AUTHENTICATED USER
    // =========================================================

    private User getAuthenticatedUser() {

        Authentication authentication =
                SecurityContextHolder
                        .getContext()
                        .getAuthentication();

        if (authentication == null
                || !authentication.isAuthenticated()) {

            throw new AccessDeniedException(
                    "User is not authenticated");
        }

        String email =
                authentication.getName();

        return userRepository
                .findByEmail(email)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Authenticated user not found"));
    }

    // =========================================================
    // MAP RESPONSE
    // =========================================================

    private PropertyImageResponse mapToResponse(
            PropertyImage image) {

        Property property =
                image.getProperty();

        PropertyImageResponse response =
                new PropertyImageResponse();

        response.setImageId(
                image.getImageId());

        /*
         * Database stores the S3 object key.
         *
         * Example:
         * property-images/5/uuid_image.jpg
         *
         * Response returns a temporary presigned URL.
         */
        String imageUrl = image.getImageUrl();

        if (imageUrl == null
                || imageUrl.isBlank()) {

            response.setImageUrl(null);

        } else if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {

            response.setImageUrl(imageUrl);

        } else if (imageUrl.startsWith("/uploads/")) {

            /*
             * Backward compatibility for old local
             * image records that may still exist in DB.
             */
            response.setImageUrl(imageUrl);

        } else {

            try {
                response.setImageUrl(
                        s3Service.generatePresignedUrl(
                                imageUrl));
            } catch (Exception ex) {
                response.setImageUrl(imageUrl);
            }
        }

        response.setImageType(
                image.getImageType());

        response.setIsPrimary(
                image.getIsPrimary());

        response.setPropertyId(
                property.getPropertyId());

        response.setPropertyName(
                property.getPropertyName());

        response.setCreatedAt(
                image.getCreatedAt());

        response.setUpdatedAt(
                image.getUpdatedAt());

        return response;
    }

    // =========================================================
    // PUBLIC TENANT IMAGES
    // =========================================================

    @Override
    @Transactional(readOnly = true)
    public List<PublicPropertyImageResponse> getPublicImagesByProperty(
            Long propertyId) {

        Property property = propertyRepository
                .findById(propertyId)
                .orElseThrow(() ->
                        new RuntimeException(
                                "Property not found with ID: "
                                        + propertyId));

        if (property.getStatus() != PropertyStatus.AVAILABLE) {
            throw new ResourceNotFoundException(
                    "Property images are not available for browsing");
        }

        return propertyImageRepository
                .findByProperty(property)
                .stream()
                .map(this::mapToResponse)
                .map(image -> new PublicPropertyImageResponse(
                        image.getImageUrl(),
                        image.getImageType(),
                        image.getIsPrimary()))
                .collect(Collectors.toList());
    }
}
