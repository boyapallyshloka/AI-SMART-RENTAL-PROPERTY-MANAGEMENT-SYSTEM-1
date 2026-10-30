package com.rental.rental_management_backend.property.serviceimpl;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

import org.springframework.core.io.Resource;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.exception.ResourceNotFoundException;
import com.rental.rental_management_backend.property.dto.PropertyDocumentDownload;
import com.rental.rental_management_backend.property.dto.PropertyDocumentResponse;
import com.rental.rental_management_backend.property.dto.PropertyDocumentVerificationRequest;
import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.entity.PropertyDocument;
import com.rental.rental_management_backend.property.enums.PropertyDocumentType;
import com.rental.rental_management_backend.property.repository.PropertyDocumentRepository;
import com.rental.rental_management_backend.property.repository.PropertyRepository;
import com.rental.rental_management_backend.property.service.PropertyDocumentService;
import com.rental.rental_management_backend.s3.service.S3Service;
import com.rental.rental_management_backend.tenant.enums.DocumentVerificationStatus;

@Service
@Transactional
public class PropertyDocumentServiceImpl implements PropertyDocumentService {

    private static final long MAX_FILE_SIZE = 10L * 1024 * 1024;
    private static final int MAX_FILE_NAME_LENGTH = 255;
    private static final int MAX_DOCUMENT_NAME_LENGTH = 255;
    private static final int MAX_REJECTION_REASON_LENGTH = 500;

    private final PropertyDocumentRepository propertyDocumentRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final S3Service s3Service;

    public PropertyDocumentServiceImpl(
            PropertyDocumentRepository propertyDocumentRepository,
            PropertyRepository propertyRepository,
            UserRepository userRepository,
            S3Service s3Service) {
        this.propertyDocumentRepository = propertyDocumentRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.s3Service = s3Service;
    }

    @Override
    public PropertyDocumentResponse uploadDocument(
            String email,
            Long propertyId,
            MultipartFile file,
            PropertyDocumentType documentType,
            String documentName) {
        User user = getAuthenticatedUser(email);
        Property property = getProperty(propertyId);
        validatePropertyAccess(property, user);
        String safeFileName = validateAndSanitizeFile(file);

        if (documentType == null) {
            throw new IllegalArgumentException("Document type is required");
        }

        String safeDocumentName =
                documentName == null || documentName.isBlank()
                        ? safeFileName
                        : documentName.trim();
        if (safeDocumentName.length() > MAX_DOCUMENT_NAME_LENGTH) {
            throw new IllegalArgumentException(
                    "Document name must not exceed "
                            + MAX_DOCUMENT_NAME_LENGTH + " characters");
        }

        String contentType = normalizeContentType(file.getContentType());
        byte[] fileContents;
        try {
            fileContents = file.getBytes();
        } catch (IOException exception) {
            throw new IllegalArgumentException(
                    "Unable to read the uploaded document",
                    exception);
        }

        String storageKey = s3Service.uploadBytes(
                fileContents,
                safeFileName,
                contentType,
                "property-documents/" + propertyId);

        PropertyDocument document = new PropertyDocument();
        document.setProperty(property);
        document.setDocumentType(documentType);
        document.setDocumentName(safeDocumentName);
        document.setFileName(safeFileName);
        document.setFilePath(storageKey);
        document.setContentType(contentType);
        document.setFileSize(file.getSize());
        document.setVerificationStatus(DocumentVerificationStatus.PENDING);
        document.setUploadedAt(LocalDateTime.now());

        try {
            return mapToResponse(
                    propertyDocumentRepository.saveAndFlush(document));
        } catch (RuntimeException saveException) {
            try {
                s3Service.deleteFile(storageKey);
            } catch (RuntimeException cleanupException) {
                saveException.addSuppressed(cleanupException);
            }
            throw saveException;
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<PropertyDocumentResponse> getDocuments(
            String email,
            Long propertyId) {
        User user = getAuthenticatedUser(email);
        Property property = getProperty(propertyId);
        validatePropertyAccess(property, user);

        return propertyDocumentRepository
                .findByProperty_PropertyIdOrderByUploadedAtDesc(propertyId)
                .stream()
                .map(this::mapToResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<PropertyDocumentResponse> getPendingDocuments() {
        return propertyDocumentRepository
                .findByVerificationStatusOrderByUploadedAtDesc(
                        DocumentVerificationStatus.PENDING)
                .stream()
                .map(this::mapToAdminResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<PropertyDocumentResponse> getPropertyDocumentsForAdmin(
            String email,
            Long propertyId) {
        User user = getAuthenticatedUser(email);
        validateSuperAdmin(user);
        getProperty(propertyId);

        return propertyDocumentRepository
                .findByProperty_PropertyIdOrderByUploadedAtDesc(propertyId)
                .stream()
                .map(this::mapToAdminResponse)
                .toList();
    }

    @Override
    public PropertyDocumentResponse approveDocument(
            String email,
            Long documentId) {
        User user = getAuthenticatedUser(email);
        validateSuperAdmin(user);
        PropertyDocument document = getDocumentById(documentId);

        return mapToAdminResponse(updateVerification(
                user,
                document,
                DocumentVerificationStatus.VERIFIED,
                null));
    }

    @Override
    public PropertyDocumentResponse rejectDocument(
            String email,
            Long documentId,
            String reason) {
        User user = getAuthenticatedUser(email);
        validateSuperAdmin(user);
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException(
                    "Rejection reason is required");
        }
        if (reason.length() > MAX_REJECTION_REASON_LENGTH) {
            throw new IllegalArgumentException(
                    "Rejection reason must not exceed "
                            + MAX_REJECTION_REASON_LENGTH + " characters");
        }
        String trimmedReason = reason.trim();

        PropertyDocument document = getDocumentById(documentId);
        return mapToAdminResponse(updateVerification(
                user,
                document,
                DocumentVerificationStatus.REJECTED,
                trimmedReason));
    }

    @Override
    @Transactional(readOnly = true)
    public PropertyDocumentDownload downloadAdminDocument(
            String email,
            Long documentId) {
        User user = getAuthenticatedUser(email);
        validateSuperAdmin(user);
        return createDownload(getDocumentById(documentId));
    }

    @Override
    @Transactional(readOnly = true)
    public PropertyDocumentResponse getDocument(
            String email,
            Long propertyId,
            Long documentId) {
        User user = getAuthenticatedUser(email);
        Property property = getProperty(propertyId);
        validatePropertyAccess(property, user);

        return mapToResponse(getDocumentForProperty(propertyId, documentId));
    }

    @Override
    @Transactional(readOnly = true)
    public PropertyDocumentDownload downloadDocument(
            String email,
            Long propertyId,
            Long documentId) {
        User user = getAuthenticatedUser(email);
        Property property = getProperty(propertyId);
        validatePropertyAccess(property, user);

        PropertyDocument document =
                getDocumentForProperty(propertyId, documentId);
        return createDownload(document);
    }

    @Override
    public void deleteDocument(
            String email,
            Long propertyId,
            Long documentId) {
        User user = getAuthenticatedUser(email);
        Property property = getProperty(propertyId);
        validatePropertyAccess(property, user);

        PropertyDocument document =
                getDocumentForProperty(propertyId, documentId);
        validateStoredKey(document.getFilePath(), propertyId);
        s3Service.deleteFile(document.getFilePath());
        propertyDocumentRepository.delete(document);
    }

    @Override
    public PropertyDocumentResponse updateVerificationStatus(
            String email,
            Long propertyId,
            Long documentId,
            PropertyDocumentVerificationRequest request) {
        User user = getAuthenticatedUser(email);
        if (user.getRole() != RoleType.SUPER_ADMIN) {
            throw new AccessDeniedException(
                    "Only SUPER_ADMIN can verify property documents");
        }

        if (request == null
                || (request.getStatus() != DocumentVerificationStatus.VERIFIED
                && request.getStatus() != DocumentVerificationStatus.REJECTED)) {
            throw new IllegalArgumentException(
                    "Verification status must be VERIFIED or REJECTED");
        }

        Property property = getProperty(propertyId);
        PropertyDocument document =
                getDocumentForProperty(property.getPropertyId(), documentId);
        return mapToResponse(updateVerification(
                user,
                document,
                request.getStatus(),
                request.getRejectionReason()));
    }

    private PropertyDocument updateVerification(
            User user,
            PropertyDocument document,
            DocumentVerificationStatus status,
            String rejectionReason) {
        if (status == DocumentVerificationStatus.REJECTED
                && rejectionReason != null
                && rejectionReason.length() > MAX_REJECTION_REASON_LENGTH) {
            throw new IllegalArgumentException(
                    "Rejection reason must not exceed "
                            + MAX_REJECTION_REASON_LENGTH + " characters");
        }

        document.setVerificationStatus(status);
        document.setVerifiedAt(LocalDateTime.now());
        document.setVerifiedBy(user);
        document.setRejectionReason(
                status == DocumentVerificationStatus.REJECTED
                        && rejectionReason != null
                        && !rejectionReason.isBlank()
                                ? rejectionReason.trim()
                                : null);
        return propertyDocumentRepository.save(document);
    }

    private void validateSuperAdmin(User user) {
        if (user.getRole() != RoleType.SUPER_ADMIN) {
            throw new AccessDeniedException(
                    "Only SUPER_ADMIN can manage property documents");
        }
    }

    private User getAuthenticatedUser(String email) {
        if (email == null || email.isBlank()) {
            throw new AccessDeniedException(
                    "Authenticated user email not found");
        }

        return userRepository.findByEmail(
                        email.trim().toLowerCase(Locale.ROOT))
                .orElseThrow(() -> new AccessDeniedException(
                        "Authenticated user not found"));
    }

    private Property getProperty(Long propertyId) {
        return propertyRepository.findDetailsById(propertyId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Property not found with ID: " + propertyId));
    }

    private PropertyDocument getDocumentForProperty(
            Long propertyId,
            Long documentId) {
        return propertyDocumentRepository
                .findByDocumentIdAndProperty_PropertyId(documentId, propertyId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Property document not found"));
    }

    private PropertyDocument getDocumentById(Long documentId) {
        return propertyDocumentRepository
                .findByDocumentIdWithAdminDetails(documentId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Property document not found"));
    }

    private PropertyDocumentDownload createDownload(
            PropertyDocument document) {
        Long propertyId = document.getProperty().getPropertyId();
        validateStoredKey(document.getFilePath(), propertyId);
        Resource resource = s3Service.downloadFile(document.getFilePath());
        return new PropertyDocumentDownload(
                resource,
                document.getFileName(),
                document.getContentType());
    }

    private void validatePropertyAccess(Property property, User user) {
        if (user.getRole() == RoleType.SUPER_ADMIN) {
            return;
        }

        if (user.getRole() == RoleType.PROPERTY_OWNER
                && property.getOwner() != null
                && Objects.equals(
                        property.getOwner().getId(),
                        user.getId())) {
            return;
        }

        if (user.getRole() == RoleType.PROPERTY_MANAGER
                && property.getPropertyManager() != null
                && property.getPropertyManager().getUser() != null
                && Objects.equals(
                        property.getPropertyManager().getUser().getId(),
                        user.getId())) {
            return;
        }

        throw new AccessDeniedException(
                "You are not authorized to access documents for this property");
    }

    private String validateAndSanitizeFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException(
                    "Please select a document file");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException(
                    "Document size must not exceed 10 MB");
        }

        String originalFileName = file.getOriginalFilename();
        if (originalFileName == null || originalFileName.isBlank()
                || originalFileName.contains("/")
                || originalFileName.contains("\\")
                || originalFileName.contains("..")) {
            throw new IllegalArgumentException(
                    "The document filename is invalid");
        }

        String safeFileName = originalFileName.trim()
                .replaceAll("[^A-Za-z0-9._ -]", "_")
                .replaceAll("^[.\\s]+", "");
        if (safeFileName.isBlank()
                || safeFileName.length() > MAX_FILE_NAME_LENGTH) {
            throw new IllegalArgumentException(
                    "The document filename is invalid");
        }

        String lowerFileName = safeFileName.toLowerCase(Locale.ROOT);
        String contentType = normalizeContentType(file.getContentType());
        boolean validPdf = lowerFileName.endsWith(".pdf")
                && "application/pdf".equals(contentType);
        boolean validJpeg = (lowerFileName.endsWith(".jpg")
                || lowerFileName.endsWith(".jpeg"))
                && "image/jpeg".equals(contentType);
        boolean validPng = lowerFileName.endsWith(".png")
                && "image/png".equals(contentType);
        if (!validPdf && !validJpeg && !validPng) {
            throw new IllegalArgumentException(
                    "Only matching PDF, JPG, JPEG and PNG documents are allowed");
        }

        return safeFileName;
    }

    private String normalizeContentType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return "";
        }
        return contentType.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
    }

    private void validateStoredKey(String filePath, Long propertyId) {
        String expectedPrefix = "property-documents/" + propertyId + "/";
        if (filePath == null || !filePath.startsWith(expectedPrefix)) {
            throw new IllegalStateException(
                    "Property document storage reference is invalid");
        }

        String storedFileName = filePath.substring(expectedPrefix.length());
        if (storedFileName.contains("/")
                || storedFileName.contains("\\")
                || storedFileName.contains("..")
                || !storedFileName.matches(
                        "[0-9a-fA-F-]{36}_[A-Za-z0-9._ -]{1,255}")) {
            throw new IllegalStateException(
                    "Property document storage reference is invalid");
        }
    }

    private PropertyDocumentResponse mapToResponse(
            PropertyDocument document) {
        PropertyDocumentResponse response = new PropertyDocumentResponse();
        response.setDocumentId(document.getDocumentId());
        response.setPropertyId(document.getProperty().getPropertyId());
        response.setDocumentType(document.getDocumentType());
        response.setDocumentName(document.getDocumentName());
        response.setFileName(document.getFileName());
        response.setContentType(document.getContentType());
        response.setFileSize(document.getFileSize());
        response.setVerificationStatus(document.getVerificationStatus());
        response.setUploadedAt(document.getUploadedAt());
        response.setVerifiedAt(document.getVerifiedAt());
        response.setRejectionReason(document.getRejectionReason());

        User verifiedBy = document.getVerifiedBy();
        if (verifiedBy != null) {
            response.setVerifiedById(verifiedBy.getId());
            String displayName = (
                    (verifiedBy.getFirstName() == null
                            ? ""
                            : verifiedBy.getFirstName().trim())
                    + " "
                    + (verifiedBy.getLastName() == null
                            ? ""
                            : verifiedBy.getLastName().trim()))
                    .trim();
            response.setVerifiedByName(
                    displayName.isEmpty() ? null : displayName);
        }
        return response;
    }

    private PropertyDocumentResponse mapToAdminResponse(
            PropertyDocument document) {
        PropertyDocumentResponse response = mapToResponse(document);
        Property property = document.getProperty();
        response.setPropertyName(property.getPropertyName());

        User owner = property.getOwner();
        if (owner != null) {
            response.setOwnerId(owner.getId());
            response.setOwnerName(
                    ((owner.getFirstName() == null ? "" : owner.getFirstName())
                            + " "
                            + (owner.getLastName() == null ? "" : owner.getLastName()))
                            .trim());
            response.setOwnerEmail(owner.getEmail());
        }

        return response;
    }
}
