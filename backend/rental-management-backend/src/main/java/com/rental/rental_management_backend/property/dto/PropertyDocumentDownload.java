package com.rental.rental_management_backend.property.dto;

import org.springframework.core.io.Resource;

public record PropertyDocumentDownload(
        Resource resource,
        String fileName,
        String contentType) {
}
