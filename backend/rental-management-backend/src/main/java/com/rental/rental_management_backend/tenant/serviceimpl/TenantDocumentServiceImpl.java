
package com.rental.rental_management_backend.tenant.serviceimpl;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.rental.entity.RentalApplication;
import com.rental.rental_management_backend.rental.repository.RentalApplicationRepository;
import com.rental.rental_management_backend.s3.service.S3Service;
import com.rental.rental_management_backend.tenant.dto.TenantDocumentResponse;
import com.rental.rental_management_backend.tenant.entity.Tenant;
import com.rental.rental_management_backend.tenant.entity.TenantDocument;
import com.rental.rental_management_backend.tenant.enums.DocumentVerificationStatus;
import com.rental.rental_management_backend.tenant.enums.TenantDocumentType;
import com.rental.rental_management_backend.tenant.repository.TenantDocumentRepository;
import com.rental.rental_management_backend.tenant.repository.TenantRepository;
import com.rental.rental_management_backend.tenant.service.TenantDocumentService;

@Service
@Transactional
public class TenantDocumentServiceImpl
        implements TenantDocumentService {

    private final TenantDocumentRepository tenantDocumentRepository;

    private final TenantRepository tenantRepository;

    private final UserRepository userRepository;

    private final RentalApplicationRepository rentalApplicationRepository;

    private final S3Service s3Service;

    public TenantDocumentServiceImpl(
            TenantDocumentRepository tenantDocumentRepository,
            TenantRepository tenantRepository,
            UserRepository userRepository,
            RentalApplicationRepository rentalApplicationRepository,
            S3Service s3Service) {

        this.tenantDocumentRepository =
                tenantDocumentRepository;

        this.tenantRepository =
                tenantRepository;

        this.userRepository =
                userRepository;

        this.rentalApplicationRepository =
                rentalApplicationRepository;

        this.s3Service =
                s3Service;
    }

    // =========================================================
    // UPLOAD DOCUMENT
    // =========================================================

    @Override
    public TenantDocumentResponse uploadDocument(
            String email,
            MultipartFile file,
            TenantDocumentType documentType) {

        validateFile(file);

        if (documentType == null) {
            throw new RuntimeException(
                    "Document type is required");
        }

        User user =
                getAuthenticatedTenantUser(email);

        Tenant tenant =
                tenantRepository
                        .findByUser(user)
                        .orElseGet(() ->
                                createEmptyTenantProfile(user));

        /*
         * Upload document to AWS S3.
         *
         * S3 folder:
         *
         * tenant-documents/
         *     tenantId/
         *         uuid_filename
         */
        String documentUrl =
                saveFile(
                        file,
                        tenant.getTenantId());

        TenantDocument document =
                new TenantDocument();

        document.setTenant(tenant);

        document.setDocumentType(
                documentType);

        /*
         * Original uploaded file name.
         */
        document.setFileName(
                file.getOriginalFilename());

        /*
         * Store S3 object key in PostgreSQL.
         *
         * Example:
         *
         * tenant-documents/32/
         * uuid_aadhar.pdf
         */
        document.setDocumentUrl(
                documentUrl);

        /*
         * New documents always start as PENDING.
         */
        document.setVerificationStatus(
                DocumentVerificationStatus.PENDING);

        /*
         * Explicitly set timestamps.
         *
         * This preserves the existing PostgreSQL
         * uploaded_at fix.
         */
        LocalDateTime now =
                LocalDateTime.now();

        document.setUploadedAt(now);
        document.setUpdatedAt(now);

        /*
         * Save document.
         */
        TenantDocument savedDocument =
                tenantDocumentRepository.save(document);

        return mapToResponse(savedDocument);
    }

    // =========================================================
    // GET MY DOCUMENTS
    // =========================================================

    @Override
    @Transactional(readOnly = true)
    public List<TenantDocumentResponse> getMyDocuments(
            String email) {

        User user =
                getAuthenticatedTenantUser(email);

        Tenant tenant =
                tenantRepository
                        .findByUser(user)
                        .orElseGet(() ->
                                createEmptyTenantProfile(user));

        return tenantDocumentRepository
                .findByTenant(tenant)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // =========================================================
    // GET MY DOCUMENT
    // =========================================================

    @Override
    @Transactional(readOnly = true)
    public TenantDocumentResponse getMyDocument(
            String email,
            Long documentId) {

        User user =
                getAuthenticatedTenantUser(email);

        Tenant tenant =
                tenantRepository
                        .findByUser(user)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Tenant profile not found"));

        TenantDocument document =
                tenantDocumentRepository
                        .findByDocumentIdAndTenant(
                                documentId,
                                tenant)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Document not found or you are not authorized"));

        return mapToResponse(document);
    }

    // =========================================================
    // DELETE MY DOCUMENT
    // =========================================================

    @Override
    public void deleteMyDocument(
            String email,
            Long documentId) {

        User user =
                getAuthenticatedTenantUser(email);

        Tenant tenant =
                tenantRepository
                        .findByUser(user)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Tenant profile not found"));

        TenantDocument document =
                tenantDocumentRepository
                        .findByDocumentIdAndTenant(
                                documentId,
                                tenant)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Document not found or you are not authorized"));

        /*
         * Delete document from AWS S3.
         */
        deletePhysicalFile(
                document.getDocumentUrl());

        /*
         * Delete database record.
         */
        tenantDocumentRepository.delete(document);
    }

    // =========================================================
    // GET TENANT DOCUMENTS
    // =========================================================

    @Override
    @Transactional(readOnly = true)
    public List<TenantDocumentResponse> getTenantDocuments(
            String email,
            Long tenantId) {

        User authenticatedUser =
                getAuthenticatedUser(email);

        Tenant tenant =
                tenantRepository
                        .findById(tenantId)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Tenant not found with ID: "
                                                + tenantId));

        /*
         * SUPER_ADMIN can view documents
         * for any tenant.
         */
        if (authenticatedUser.getRole()
                == RoleType.SUPER_ADMIN) {

            return getTenantDocumentsList(tenant);
        }

        /*
         * PROPERTY_OWNER and PROPERTY_MANAGER
         * require property-level authorization.
         */
        if (authenticatedUser.getRole()
                == RoleType.PROPERTY_OWNER
                || authenticatedUser.getRole()
                == RoleType.PROPERTY_MANAGER) {

            boolean authorized =
                    tenantHasAuthorizedProperty(
                            tenantId,
                            authenticatedUser);

            if (!authorized) {

                throw new RuntimeException(
                        "You are not authorized to view documents for this tenant");
            }

            return getTenantDocumentsList(tenant);
        }

        throw new RuntimeException(
                "You are not authorized to view tenant documents");
    }

    // =========================================================
    // CHECK PROPERTY AUTHORIZATION
    // =========================================================

    private boolean tenantHasAuthorizedProperty(
            Long tenantId,
            User authenticatedUser) {

        List<RentalApplication> applications =
                rentalApplicationRepository
                        .findByTenant_TenantId(tenantId);

        for (RentalApplication application : applications) {

            var property = application.getProperty();

            if (property == null
                    && application.getUnit() != null
                    && application.getUnit().getFloor() != null
                    && application.getUnit()
                            .getFloor()
                            .getBuilding() != null) {
                property = application.getUnit()
                        .getFloor()
                        .getBuilding()
                        .getProperty();
            }

            if (property == null) {
                continue;
            }

            /*
             * PROPERTY_OWNER:
             *
             * The authenticated user must be
             * the owner of the property's owner field.
             */
            if (authenticatedUser.getRole()
                    == RoleType.PROPERTY_OWNER) {

                if (property.getOwner() != null
                        && property.getOwner().getId() != null
                        && property.getOwner()
                                .getId()
                                .equals(authenticatedUser.getId())) {

                    return true;
                }
            }

            /*
             * PROPERTY_MANAGER:
             *
             * The authenticated user must be the
             * user assigned to the property's manager.
             */
            if (authenticatedUser.getRole()
                    == RoleType.PROPERTY_MANAGER) {

                if (property.getPropertyManager() != null
                        && property.getPropertyManager()
                                .getUser() != null
                        && property.getPropertyManager()
                                .getUser()
                                .getId() != null
                        && property.getPropertyManager()
                                .getUser()
                                .getId()
                                .equals(authenticatedUser.getId())) {

                    return true;
                }
            }
        }

        return false;
    }

    // =========================================================
    // GET TENANT DOCUMENT LIST
    // =========================================================

    private List<TenantDocumentResponse> getTenantDocumentsList(
            Tenant tenant) {

        return tenantDocumentRepository
                .findByTenant(tenant)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // =========================================================
    // SUPER ADMIN - VERIFY / REJECT
    // =========================================================

    @Override
    public TenantDocumentResponse updateVerificationStatus(
            Long tenantId,
            Long documentId,
            DocumentVerificationStatus status) {

        if (status == null) {
            throw new RuntimeException(
                    "Verification status is required");
        }

        Tenant tenant =
                tenantRepository
                        .findById(tenantId)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Tenant not found with ID: "
                                                + tenantId));

        TenantDocument document =
                tenantDocumentRepository
                        .findByDocumentIdAndTenant(
                                documentId,
                                tenant)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Document not found for this tenant"));

        document.setVerificationStatus(status);

        /*
         * Explicitly update timestamp.
         */
        document.setUpdatedAt(
                LocalDateTime.now());

        TenantDocument updatedDocument =
                tenantDocumentRepository.save(document);

        return mapToResponse(updatedDocument);
    }

    // =========================================================
    // GET AUTHENTICATED USER
    // =========================================================

    private User getAuthenticatedUser(
            String email) {

        if (email == null
                || email.isBlank()) {

            throw new RuntimeException(
                    "Authenticated user email not found");
        }

        return userRepository
                .findByEmail(
                        email.trim().toLowerCase())
                .orElseThrow(() ->
                        new RuntimeException(
                                "Authenticated user not found"));
    }

    // =========================================================
    // SAVE FILE TO AWS S3
    // =========================================================

    private String saveFile(
            MultipartFile file,
            Long tenantId) {

        try {

            /*
             * Upload to:
             *
             * tenant-documents/{tenantId}/
             *
             * S3Service generates the unique filename.
             */
            return s3Service.uploadFile(
                    file,
                    "tenant-documents/" + tenantId);

        } catch (Exception e) {

            throw new RuntimeException(
                    "Failed to store tenant document file in S3",
                    e);
        }
    }

    // =========================================================
    // DELETE FILE FROM AWS S3
    // =========================================================

    private void deletePhysicalFile(
            String documentUrl) {

        if (documentUrl == null
                || documentUrl.isBlank()) {

            return;
        }

        /*
         * New records contain an S3 object key.
         *
         * Example:
         *
         * tenant-documents/32/
         * uuid_aadhar.pdf
         */
        if (documentUrl.startsWith(
                "tenant-documents/")) {

            try {

                s3Service.deleteFile(
                        documentUrl);

            } catch (Exception e) {

                System.err.println(
                        "Could not delete tenant document from S3: "
                                + e.getMessage());
            }

            return;
        }

        /*
         * Old local filesystem records are
         * intentionally ignored here.
         *
         * This prevents an S3 migration from
         * accidentally trying to treat an old
         * /uploads/... path as an S3 key.
         */
    }

    // =========================================================
    // VALIDATE FILE
    // =========================================================

    private void validateFile(
            MultipartFile file) {

        if (file == null || file.isEmpty()) {

            throw new RuntimeException(
                    "Please select a document file");
        }

        /*
         * Maximum 10 MB.
         */
        long maxSize =
                10 * 1024 * 1024;

        if (file.getSize() > maxSize) {

            throw new RuntimeException(
                    "Document size must not exceed 10 MB");
        }

        String contentType =
                file.getContentType();

        if (contentType == null
                || !(contentType.equalsIgnoreCase(
                            "application/pdf")
                || contentType.equalsIgnoreCase(
                            "image/jpeg")
                || contentType.equalsIgnoreCase(
                            "image/png"))) {

            throw new RuntimeException(
                    "Only PDF, JPG, JPEG and PNG documents are allowed");
        }

        String originalFilename =
                file.getOriginalFilename();

        if (originalFilename == null
                || !hasAllowedExtension(
                        originalFilename)) {

            throw new RuntimeException(
                    "Only PDF, JPG, JPEG and PNG documents are allowed");
        }
    }

    // =========================================================
    // FILE EXTENSION VALIDATION
    // =========================================================

    private boolean hasAllowedExtension(
            String filename) {

        String lowerCaseFilename =
                filename.toLowerCase();

        return lowerCaseFilename.endsWith(".pdf")
                || lowerCaseFilename.endsWith(".jpg")
                || lowerCaseFilename.endsWith(".jpeg")
                || lowerCaseFilename.endsWith(".png");
    }

    // =========================================================
    // GET AUTHENTICATED TENANT
    // =========================================================

    private User getAuthenticatedTenantUser(
            String email) {

        if (email == null
                || email.isBlank()) {

            throw new RuntimeException(
                    "Authenticated user email not found");
        }

        User user =
                userRepository
                        .findByEmail(
                                email.trim().toLowerCase())
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Authenticated user not found"));

        if (user.getRole() != RoleType.TENANT) {

            throw new RuntimeException(
                    "Only TENANT users can access their documents");
        }

        return user;
    }

    // =========================================================
    // CREATE EMPTY TENANT PROFILE
    // =========================================================

    private Tenant createEmptyTenantProfile(
            User user) {

        Tenant tenant =
                new Tenant();

        tenant.setUser(user);

        return tenantRepository.save(tenant);
    }

    // =========================================================
    // MAP RESPONSE
    // =========================================================

    private TenantDocumentResponse mapToResponse(
            TenantDocument document) {

        Tenant tenant =
                document.getTenant();

        TenantDocumentResponse response =
                new TenantDocumentResponse();

        response.setDocumentId(
                document.getDocumentId());

        response.setTenantId(
                tenant.getTenantId());

        response.setUserId(
                tenant.getUser().getId());

        response.setDocumentType(
                document.getDocumentType());

        response.setFileName(
                document.getFileName());

        /*
         * Generate temporary presigned URL for
         * S3 documents.
         *
         * Old local URLs are returned unchanged
         * for backward compatibility.
         */
        String documentUrl =
                document.getDocumentUrl();

        if (documentUrl == null
                || documentUrl.isBlank()) {

            response.setDocumentUrl(null);

        } else if (documentUrl.startsWith(
                "/uploads/")) {

            response.setDocumentUrl(
                    documentUrl);

        } else {

            response.setDocumentUrl(
                    s3Service.generatePresignedUrl(
                            documentUrl));
        }

        response.setVerificationStatus(
                document.getVerificationStatus());

        response.setUploadedAt(
                document.getUploadedAt());

        response.setUpdatedAt(
                document.getUpdatedAt());

        return response;
    }
}
