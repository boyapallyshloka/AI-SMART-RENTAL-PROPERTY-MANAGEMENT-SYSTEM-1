package com.rental.rental_management_backend.property.serviceimpl;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.exception.ResourceNotFoundException;
import com.rental.rental_management_backend.property.dto.PropertyDocumentResponse;
import com.rental.rental_management_backend.property.dto.PropertyPublishEligibilityResponse;
import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.entity.PropertyDocument;
import com.rental.rental_management_backend.property.enums.PropertyDocumentStatus;
import com.rental.rental_management_backend.property.enums.PropertyDocumentType;
import com.rental.rental_management_backend.property.repository.PropertyDocumentRepository;
import com.rental.rental_management_backend.property.repository.PropertyRepository;
import com.rental.rental_management_backend.property.service.PropertyDocumentService;
import com.rental.rental_management_backend.s3.service.S3Service;

@Service
@Transactional
public class PropertyDocumentServiceImpl implements PropertyDocumentService {

    public static final List<PropertyDocumentType> REQUIRED_DOCUMENT_TYPES =
            List.of(PropertyDocumentType.TITLE_DEED);

    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    private final PropertyDocumentRepository documentRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final S3Service s3Service;

    public PropertyDocumentServiceImpl(
            PropertyDocumentRepository documentRepository,
            PropertyRepository propertyRepository,
            UserRepository userRepository,
            S3Service s3Service) {
        this.documentRepository = documentRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.s3Service = s3Service;
    }

    // =========================================================
    // OWNER: UPLOAD DOCUMENT
    // =========================================================
    @Override
    public PropertyDocumentResponse uploadDocument(
            Long propertyId,
            MultipartFile file,
            PropertyDocumentType documentType,
            String ownerEmail) {

        validateFile(file);

        if (documentType == null) {
            throw new IllegalArgumentException("Document type is required");
        }

        User owner = getAuthenticatedOwnerUser(ownerEmail);
        Property property = getOwnedProperty(propertyId, owner);

        String s3Folder = "property-documents/" + propertyId;
        String fileKey;
        try {
            fileKey = s3Service.uploadFile(file, s3Folder);
        } catch (Exception ex) {
            throw new RuntimeException("Failed to upload document to secure storage: " + ex.getMessage(), ex);
        }

        PropertyDocument document = new PropertyDocument();
        document.setProperty(property);
        document.setDocumentType(documentType);
        document.setFileName(file.getOriginalFilename());
        document.setFileKey(fileKey);
        document.setFileSize(file.getSize());
        document.setContentType(file.getContentType());
        document.setStatus(PropertyDocumentStatus.PENDING);
        document.setRejectionReason(null);
        document.setReviewedBy(null);
        document.setReviewedAt(null);

        PropertyDocument saved = documentRepository.save(document);
        return mapToResponse(saved);
    }

    // =========================================================
    // OWNER: GET DOCUMENTS FOR PROPERTY
    // =========================================================
    @Override
    @Transactional(readOnly = true)
    public List<PropertyDocumentResponse> getDocumentsForOwner(
            Long propertyId,
            String ownerEmail) {

        User owner = getAuthenticatedOwnerUser(ownerEmail);
        Property property = getOwnedProperty(propertyId, owner);

        return documentRepository.findByPropertyOrderByUploadedAtDesc(property)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // =========================================================
    // OWNER: GET SINGLE DOCUMENT
    // =========================================================
    @Override
    @Transactional(readOnly = true)
    public PropertyDocumentResponse getDocumentForOwner(
            Long propertyId,
            Long documentId,
            String ownerEmail) {

        User owner = getAuthenticatedOwnerUser(ownerEmail);
        Property property = getOwnedProperty(propertyId, owner);

        PropertyDocument document = documentRepository
                .findByDocumentIdAndProperty(documentId, property)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Property document not found with ID: " + documentId));

        return mapToResponse(document);
    }

    // =========================================================
    // OWNER: DOWNLOAD DOCUMENT
    // =========================================================
    @Override
    @Transactional(readOnly = true)
    public Resource downloadDocumentForOwner(
            Long propertyId,
            Long documentId,
            String ownerEmail) {

        User owner = getAuthenticatedOwnerUser(ownerEmail);
        Property property = getOwnedProperty(propertyId, owner);

        PropertyDocument document = documentRepository
                .findByDocumentIdAndProperty(documentId, property)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Property document not found with ID: " + documentId));

        return s3Service.downloadFile(document.getFileKey());
    }

    // =========================================================
    // OWNER: DELETE DOCUMENT
    // =========================================================
    @Override
    public void deleteDocumentForOwner(
            Long propertyId,
            Long documentId,
            String ownerEmail) {

        User owner = getAuthenticatedOwnerUser(ownerEmail);
        Property property = getOwnedProperty(propertyId, owner);

        PropertyDocument document = documentRepository
                .findByDocumentIdAndProperty(documentId, property)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Property document not found with ID: " + documentId));

        if (document.getStatus() == PropertyDocumentStatus.APPROVED) {
            throw new IllegalStateException(
                    "Approved documents cannot be removed as they are required for property verification. " +
                    "Contact support or an administrator if this document needs replacement.");
        }

        try {
            s3Service.deleteFile(document.getFileKey());
        } catch (Exception ex) {
            System.err.println("Failed to delete S3 file: " + ex.getMessage());
        }

        documentRepository.delete(document);
    }

    // =========================================================
    // SUPER ADMIN: LIST PENDING DOCUMENTS
    // =========================================================
    @Override
    @Transactional(readOnly = true)
    public List<PropertyDocumentResponse> getPendingDocumentsForAdmin() {
        return documentRepository.findAllPendingWithDetails(PropertyDocumentStatus.PENDING)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // =========================================================
    // SUPER ADMIN: LIST ALL DOCUMENTS FOR PROPERTY
    // =========================================================
    @Override
    @Transactional(readOnly = true)
    public List<PropertyDocumentResponse> getDocumentsByPropertyForAdmin(Long propertyId) {
        return documentRepository.findByProperty_PropertyIdOrderByUploadedAtDesc(propertyId)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // =========================================================
    // SUPER ADMIN: APPROVE DOCUMENT
    // =========================================================
    @Override
    public PropertyDocumentResponse approveDocument(
            Long documentId,
            String adminEmail) {

        User admin = getAuthenticatedAdminUser(adminEmail);

        PropertyDocument document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Property document not found with ID: " + documentId));

        document.setStatus(PropertyDocumentStatus.APPROVED);
        document.setReviewedBy(admin);
        document.setReviewedAt(LocalDateTime.now());
        document.setRejectionReason(null);

        PropertyDocument saved = documentRepository.save(document);
        return mapToResponse(saved);
    }

    // =========================================================
    // SUPER ADMIN: REJECT DOCUMENT
    // =========================================================
    @Override
    public PropertyDocumentResponse rejectDocument(
            Long documentId,
            String reason,
            String adminEmail) {

        if (reason == null || reason.trim().isBlank()) {
            throw new IllegalArgumentException("A rejection reason is required");
        }

        User admin = getAuthenticatedAdminUser(adminEmail);

        PropertyDocument document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Property document not found with ID: " + documentId));

        document.setStatus(PropertyDocumentStatus.REJECTED);
        document.setReviewedBy(admin);
        document.setReviewedAt(LocalDateTime.now());
        document.setRejectionReason(reason.trim());

        PropertyDocument saved = documentRepository.save(document);
        return mapToResponse(saved);
    }

    // =========================================================
    // SUPER ADMIN: DOWNLOAD DOCUMENT
    // =========================================================
    @Override
    @Transactional(readOnly = true)
    public Resource downloadDocumentForAdmin(Long documentId) {
        PropertyDocument document = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Property document not found with ID: " + documentId));

        return s3Service.downloadFile(document.getFileKey());
    }

    // =========================================================
    // PUBLICATION ELIGIBILITY CHECK
    // =========================================================
    @Override
    @Transactional(readOnly = true)
    public PropertyPublishEligibilityResponse getPublishEligibility(
            Long propertyId,
            String ownerEmail) {

        User owner = getAuthenticatedOwnerUser(ownerEmail);
        Property property = getOwnedProperty(propertyId, owner);

        List<PropertyDocument> docs = documentRepository.findByPropertyOrderByUploadedAtDesc(property);

        Set<PropertyDocumentType> approvedTypes = docs.stream()
                .filter(d -> d.getStatus() == PropertyDocumentStatus.APPROVED)
                .map(PropertyDocument::getDocumentType)
                .collect(Collectors.toSet());

        List<PropertyDocumentType> missingRequired = new ArrayList<>();
        List<String> reasons = new ArrayList<>();

        for (PropertyDocumentType reqType : REQUIRED_DOCUMENT_TYPES) {
            if (!approvedTypes.contains(reqType)) {
                missingRequired.add(reqType);
                reasons.add("Required document '" + formatDocumentTypeName(reqType) + "' is not approved.");
            }
        }

        long pendingCount = docs.stream()
                .filter(d -> d.getStatus() == PropertyDocumentStatus.PENDING)
                .count();

        long rejectedCount = docs.stream()
                .filter(d -> d.getStatus() == PropertyDocumentStatus.REJECTED)
                .count();

        long approvedCount = docs.stream()
                .filter(d -> d.getStatus() == PropertyDocumentStatus.APPROVED)
                .count();

        if (pendingCount > 0) {
            reasons.add(pendingCount + " document(s) are currently under administrator review.");
        }

        boolean eligible = missingRequired.isEmpty();

        PropertyPublishEligibilityResponse response = new PropertyPublishEligibilityResponse();
        response.setPropertyId(property.getPropertyId());
        response.setCurrentStatus(property.getStatus() != null ? property.getStatus().name() : "DRAFT");
        response.setEligible(eligible);
        response.setRequiredDocumentTypes(REQUIRED_DOCUMENT_TYPES);
        response.setApprovedDocumentTypes(new ArrayList<>(approvedTypes));
        response.setMissingDocumentTypes(missingRequired);
        response.setApprovedDocumentCount(approvedCount);
        response.setPendingDocumentCount(pendingCount);
        response.setRejectedDocumentCount(rejectedCount);
        response.setReasons(reasons);

        return response;
    }

    // =========================================================
    // PUBLICATION VALIDATION ENFORCEMENT
    // =========================================================
    @Override
    @Transactional(readOnly = true)
    public void validatePropertyPublishEligibility(Property property) {
        if (property == null || property.getPropertyId() == null) {
            throw new IllegalArgumentException("Property cannot be null");
        }

        List<PropertyDocument> docs = documentRepository.findByPropertyOrderByUploadedAtDesc(property);

        Set<PropertyDocumentType> approvedTypes = docs.stream()
                .filter(d -> d.getStatus() == PropertyDocumentStatus.APPROVED)
                .map(PropertyDocument::getDocumentType)
                .collect(Collectors.toSet());

        List<String> missingDescriptions = new ArrayList<>();
        for (PropertyDocumentType reqType : REQUIRED_DOCUMENT_TYPES) {
            if (!approvedTypes.contains(reqType)) {
                missingDescriptions.add(formatDocumentTypeName(reqType));
            }
        }

        if (!missingDescriptions.isEmpty()) {
            throw new IllegalStateException(
                    "Cannot publish or make property available. The following required document(s) must be approved " +
                    "by a Super Administrator before publishing: " + String.join(", ", missingDescriptions));
        }
    }

    @Override
    @Transactional(readOnly = true)
    public void validatePropertySubmissionEligibility(Property property) {
        if (property == null || property.getPropertyId() == null) {
            throw new IllegalArgumentException("Property cannot be null");
        }

        List<PropertyDocument> documents =
                documentRepository.findByPropertyOrderByUploadedAtDesc(property);
        Set<PropertyDocumentType> submittedTypes = documents.stream()
                .filter(document -> document.getStatus() != PropertyDocumentStatus.REJECTED)
                .map(PropertyDocument::getDocumentType)
                .collect(Collectors.toSet());

        List<String> missingDescriptions = REQUIRED_DOCUMENT_TYPES.stream()
                .filter(requiredType -> !submittedTypes.contains(requiredType))
                .map(this::formatDocumentTypeName)
                .toList();

        if (!missingDescriptions.isEmpty()) {
            throw new IllegalStateException(
                    "Cannot submit property for approval. Upload the required document(s): "
                            + String.join(", ", missingDescriptions));
        }
    }

    // =========================================================
    // HELPER METHODS
    // =========================================================

    private String formatDocumentTypeName(PropertyDocumentType type) {
        if (type == null) return "Unknown";
        switch (type) {
            case TITLE_DEED:
                return "Proof of Ownership / Title Deed";
            case PROPERTY_TAX_RECEIPT:
                return "Property Tax Receipt";
            case BUILDING_PERMIT:
                return "Building Permit / Occupancy Certificate";
            case INSURANCE_POLICY:
                return "Property Insurance Policy";
            default:
                return type.name().replace('_', ' ');
        }
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Please select a document file to upload");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("Document size must not exceed 10 MB");
        }

        String contentType = file.getContentType();
        if (contentType == null || !(
                contentType.equalsIgnoreCase("application/pdf")
                || contentType.equalsIgnoreCase("image/jpeg")
                || contentType.equalsIgnoreCase("image/png")
                || contentType.equalsIgnoreCase("image/jpg"))) {
            throw new IllegalArgumentException("Only PDF, JPG, JPEG, and PNG files are accepted");
        }

        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || !hasAllowedExtension(originalFilename)) {
            throw new IllegalArgumentException("Only PDF, JPG, JPEG, and PNG files are accepted");
        }
    }

    private boolean hasAllowedExtension(String filename) {
        String lower = filename.toLowerCase();
        return lower.endsWith(".pdf")
                || lower.endsWith(".jpg")
                || lower.endsWith(".jpeg")
                || lower.endsWith(".png");
    }

    private User getAuthenticatedOwnerUser(String email) {
        if (email == null || email.isBlank()) {
            throw new RuntimeException("Authenticated user email not found");
        }

        User user = userRepository.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + email));

        if (user.getRole() != RoleType.PROPERTY_OWNER) {
            throw new RuntimeException("Only PROPERTY_OWNER users can manage property documents");
        }

        return user;
    }

    private User getAuthenticatedAdminUser(String email) {
        if (email == null || email.isBlank()) {
            throw new RuntimeException("Authenticated user email not found");
        }

        User user = userRepository.findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + email));

        if (user.getRole() != RoleType.SUPER_ADMIN) {
            throw new RuntimeException("Only SUPER_ADMIN users can review property documents");
        }

        return user;
    }

    private Property getOwnedProperty(Long propertyId, User owner) {
        return propertyRepository.findByPropertyIdAndOwner(propertyId, owner)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Property not found with ID: " + propertyId + " or you do not have permission"));
    }

    private PropertyDocumentResponse mapToResponse(PropertyDocument document) {
        PropertyDocumentResponse res = new PropertyDocumentResponse();
        res.setDocumentId(document.getDocumentId());

        Property p = document.getProperty();
        if (p != null) {
            res.setPropertyId(p.getPropertyId());
            res.setPropertyName(p.getPropertyName());
            if (p.getOwner() != null) {
                res.setOwnerId(p.getOwner().getId());
                res.setOwnerName(p.getOwner().getFirstName() + " " + p.getOwner().getLastName());
                res.setOwnerEmail(p.getOwner().getEmail());
            }
        }

        res.setDocumentType(document.getDocumentType());
        res.setFileName(document.getFileName());
        res.setFileSize(document.getFileSize());
        res.setContentType(document.getContentType());

        if (document.getFileKey() != null && !document.getFileKey().isBlank()) {
            try {
                res.setDocumentUrl(s3Service.generatePresignedUrl(document.getFileKey()));
            } catch (Exception ex) {
                res.setDocumentUrl(null);
            }
        }

        res.setStatus(document.getStatus());
        res.setRejectionReason(document.getRejectionReason());

        if (document.getReviewedBy() != null) {
            res.setReviewedByUserId(document.getReviewedBy().getId());
            res.setReviewedByName(document.getReviewedBy().getFirstName() + " " + document.getReviewedBy().getLastName());
            res.setReviewedByEmail(document.getReviewedBy().getEmail());
        }

        res.setReviewedAt(document.getReviewedAt());
        res.setUploadedAt(document.getUploadedAt());
        res.setUpdatedAt(document.getUpdatedAt());

        return res;
    }
}
