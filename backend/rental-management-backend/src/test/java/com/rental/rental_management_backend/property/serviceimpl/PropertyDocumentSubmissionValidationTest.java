package com.rental.rental_management_backend.property.serviceimpl;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.entity.PropertyDocument;
import com.rental.rental_management_backend.property.enums.PropertyDocumentStatus;
import com.rental.rental_management_backend.property.enums.PropertyDocumentType;
import com.rental.rental_management_backend.property.repository.PropertyDocumentRepository;
import com.rental.rental_management_backend.property.repository.PropertyRepository;
import com.rental.rental_management_backend.s3.service.S3Service;

@ExtendWith(MockitoExtension.class)
class PropertyDocumentSubmissionValidationTest {

    @Mock
    private PropertyDocumentRepository documentRepository;
    @Mock
    private PropertyRepository propertyRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private S3Service s3Service;

    @InjectMocks
    private PropertyDocumentServiceImpl documentService;

    @Test
    void pendingTitleDeedIsSufficientForPropertySubmission() {
        Property property = property();
        when(documentRepository.findByPropertyOrderByUploadedAtDesc(property))
                .thenReturn(List.of(document(PropertyDocumentStatus.PENDING)));

        assertDoesNotThrow(
                () -> documentService.validatePropertySubmissionEligibility(property));
    }

    @Test
    void missingOrRejectedTitleDeedBlocksPropertySubmission() {
        Property property = property();
        when(documentRepository.findByPropertyOrderByUploadedAtDesc(property))
                .thenReturn(List.of(document(PropertyDocumentStatus.REJECTED)));

        assertThrows(IllegalStateException.class,
                () -> documentService.validatePropertySubmissionEligibility(property));
    }

    private Property property() {
        Property property = new Property();
        property.setPropertyId(72L);
        return property;
    }

    private PropertyDocument document(PropertyDocumentStatus status) {
        PropertyDocument document = new PropertyDocument();
        document.setDocumentType(PropertyDocumentType.TITLE_DEED);
        document.setStatus(status);
        return document;
    }
}
