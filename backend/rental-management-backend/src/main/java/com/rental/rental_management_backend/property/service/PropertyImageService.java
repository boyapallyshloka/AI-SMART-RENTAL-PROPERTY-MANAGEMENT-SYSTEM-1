package com.rental.rental_management_backend.property.service;



import java.util.List;

import org.springframework.web.multipart.MultipartFile;

import com.rental.rental_management_backend.property.dto.PropertyImageResponse;


public interface PropertyImageService {

    PropertyImageResponse addImage(
            Long propertyId,
            MultipartFile file,
            String imageType,
            Boolean isPrimary);

    List<PropertyImageResponse> getImagesByProperty(Long propertyId);

    PropertyImageResponse getImageById(Long imageId);

    PropertyImageResponse updateImage(
            Long imageId,
            MultipartFile file,
            String imageType,
            Boolean isPrimary);

    void deleteImage(Long imageId);
    List<PropertyImageResponse> getPublicImagesByProperty(Long propertyId);
}