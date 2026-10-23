package com.rental.rental_management_backend.rental.serviceImpl;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.UUID;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.springframework.stereotype.Service;

import com.rental.rental_management_backend.property.entity.Building;
import com.rental.rental_management_backend.property.entity.Floor;
import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.entity.PropertyAddress;
import com.rental.rental_management_backend.property.entity.Unit;
import com.rental.rental_management_backend.property.repository.PropertyAddressRepository;
import com.rental.rental_management_backend.rental.entity.RentalAgreement;
import com.rental.rental_management_backend.rental.service.RentalAgreementPdfService;
import com.rental.rental_management_backend.s3.service.S3Service;

@Service
public class RentalAgreementPdfServiceImpl
        implements RentalAgreementPdfService {

    private final PropertyAddressRepository propertyAddressRepository;

    private final S3Service s3Service;

    public RentalAgreementPdfServiceImpl(
            PropertyAddressRepository propertyAddressRepository,
            S3Service s3Service) {

        this.propertyAddressRepository =
                propertyAddressRepository;

        this.s3Service =
                s3Service;
    }

    @Override
    public String generateAgreementPdf(
            RentalAgreement agreement) {

        if (agreement == null) {
            throw new IllegalArgumentException(
                    "Rental agreement cannot be null");
        }

        if (agreement.getAgreementId() == null) {
            throw new IllegalArgumentException(
                    "Agreement ID is required before generating PDF");
        }

        try {

            String fileName =
                    "agreement_"
                            + agreement.getAgreementId()
                            + "_"
                            + UUID.randomUUID()
                            + ".pdf";

            byte[] pdfBytes;

            /*
             * Generate PDF in memory.
             */
            try (PDDocument document =
                         new PDDocument()) {

                PDPage page =
                        new PDPage();

                document.addPage(page);

                try (PDPageContentStream contentStream =
                             new PDPageContentStream(
                                     document,
                                     page)) {

                    PDType1Font titleFont =
                            new PDType1Font(
                                    Standard14Fonts.FontName.HELVETICA_BOLD);

                    PDType1Font normalFont =
                            new PDType1Font(
                                    Standard14Fonts.FontName.HELVETICA);

                    float y = 750;

                    // =====================================================
                    // TITLE
                    // =====================================================

                    contentStream.beginText();

                    contentStream.setFont(
                            titleFont,
                            18);

                    contentStream.newLineAtOffset(
                            200,
                            y);

                    contentStream.showText(
                            "RENTAL AGREEMENT");

                    contentStream.endText();

                    y -= 40;

                    // =====================================================
                    // AGREEMENT DETAILS
                    // =====================================================

                    y = writeLine(
                            contentStream,
                            normalFont,
                            "Agreement ID: "
                                    + agreement.getAgreementId(),
                            y);

                    y = writeLine(
                            contentStream,
                            normalFont,
                            "Status: "
                                    + agreement.getStatus(),
                            y);

                    y -= 10;

                    // =====================================================
                    // TENANT DETAILS
                    // =====================================================

                    y = writeLine(
                            contentStream,
                            titleFont,
                            "TENANT DETAILS",
                            y);

                    if (agreement.getTenant() != null
                            && agreement.getTenant().getUser() != null) {

                        String firstName =
                                agreement.getTenant()
                                        .getUser()
                                        .getFirstName();

                        String lastName =
                                agreement.getTenant()
                                        .getUser()
                                        .getLastName();

                        String tenantName =
                                ((firstName != null)
                                        ? firstName
                                        : "")
                                + " "
                                + ((lastName != null)
                                        ? lastName
                                        : "");

                        String tenantEmail =
                                agreement.getTenant()
                                        .getUser()
                                        .getEmail();

                        String tenantPhone =
                                agreement.getTenant()
                                        .getUser()
                                        .getPhone();

                        y = writeLine(
                                contentStream,
                                normalFont,
                                "Tenant Name: "
                                        + tenantName.trim(),
                                y);

                        y = writeLine(
                                contentStream,
                                normalFont,
                                "Tenant Email: "
                                        + tenantEmail,
                                y);

                        y = writeLine(
                                contentStream,
                                normalFont,
                                "Tenant Phone: "
                                        + tenantPhone,
                                y);
                    }

                    y -= 10;

                    // =====================================================
                    // PROPERTY / ADDRESS / UNIT DETAILS
                    // =====================================================

                    y = writeLine(
                            contentStream,
                            titleFont,
                            "PROPERTY DETAILS",
                            y);

                    Unit unit =
                            agreement.getUnit();

                    if (unit != null) {

                        y = writeLine(
                                contentStream,
                                normalFont,
                                "Room No: "
                                        + unit.getUnitNumber(),
                                y);

                        y = writeLine(
                                contentStream,
                                normalFont,
                                "Unit Type: "
                                        + unit.getUnitType(),
                                y);

                        y = writeLine(
                                contentStream,
                                normalFont,
                                "Bedrooms: "
                                        + unit.getBedrooms(),
                                y);

                        y = writeLine(
                                contentStream,
                                normalFont,
                                "Bathrooms: "
                                        + unit.getBathrooms(),
                                y);

                        y = writeLine(
                                contentStream,
                                normalFont,
                                "Area: "
                                        + unit.getArea(),
                                y);

                        Floor floor =
                                unit.getFloor();

                        if (floor != null) {

                            Building building =
                                    floor.getBuilding();

                            if (building != null) {

                                Property property =
                                        building.getProperty();

                                if (property != null) {

                                    // -------------------------------------
                                    // PROPERTY NAME
                                    // -------------------------------------

                                    y = writeLine(
                                            contentStream,
                                            normalFont,
                                            "Property Name: "
                                                    + property.getPropertyName(),
                                            y);

                                    // -------------------------------------
                                    // PROPERTY ADDRESS
                                    // -------------------------------------

                                    OptionalAddressResult addressResult =
                                            getPropertyAddress(property);

                                    if (addressResult.address() != null) {

                                        PropertyAddress address =
                                                addressResult.address();

                                        y = writeLine(
                                                contentStream,
                                                normalFont,
                                                "Address Line 1: "
                                                        + address.getAddressLine1(),
                                                y);

                                        if (address.getAddressLine2() != null
                                                && !address.getAddressLine2()
                                                        .trim()
                                                        .isEmpty()) {

                                            y = writeLine(
                                                    contentStream,
                                                    normalFont,
                                                    "Address Line 2: "
                                                            + address.getAddressLine2(),
                                                    y);
                                        }

                                        y = writeLine(
                                                contentStream,
                                                normalFont,
                                                "Area: "
                                                        + address.getArea(),
                                                y);

                                        y = writeLine(
                                                contentStream,
                                                normalFont,
                                                "City: "
                                                        + address.getCity(),
                                                y);

                                        y = writeLine(
                                                contentStream,
                                                normalFont,
                                                "State: "
                                                        + address.getState(),
                                                y);

                                        y = writeLine(
                                                contentStream,
                                                normalFont,
                                                "Country: "
                                                        + address.getCountry(),
                                                y);

                                        y = writeLine(
                                                contentStream,
                                                normalFont,
                                                "Pincode: "
                                                        + address.getPincode(),
                                                y);
                                    }
                                }
                            }
                        }
                    }

                    if (unit == null && agreement.getProperty() != null) {
                        Property property = agreement.getProperty();
<<<<<<< HEAD
                        y = writeLine(contentStream, normalFont,
                                "Property Name: " + property.getPropertyName(), y);
                        OptionalAddressResult addressResult = getPropertyAddress(property);
                        if (addressResult.address() != null) {
                            PropertyAddress address = addressResult.address();
                            y = writeLine(contentStream, normalFont,
                                    "Address: " + address.getAddressLine1(), y);
                            String locality = java.util.stream.Stream.of(
                                            address.getArea(), address.getCity(),
                                            address.getState(), address.getPincode())
                                    .filter(value -> value != null && !value.isBlank())
                                    .collect(java.util.stream.Collectors.joining(", "));
                            if (!locality.isBlank()) {
                                y = writeLine(contentStream, normalFont,
                                        "Location: " + locality, y);
                            }
=======
                        y = writeLine(
                                contentStream,
                                normalFont,
                                "Property Name: " + property.getPropertyName(),
                                y);

                        OptionalAddressResult addressResult =
                                getPropertyAddress(property);
                        if (addressResult.address() != null) {
                            PropertyAddress address = addressResult.address();
                            y = writeLine(
                                    contentStream,
                                    normalFont,
                                    "Address: " + address.getAddressLine1(),
                                    y);
                            y = writeLine(
                                    contentStream,
                                    normalFont,
                                    "City: " + address.getCity(),
                                    y);
                            y = writeLine(
                                    contentStream,
                                    normalFont,
                                    "State: " + address.getState(),
                                    y);
>>>>>>> origin/backend/dev1
                        }
                    }

                    y -= 10;

                    // =====================================================
                    // AGREEMENT TERMS
                    // =====================================================

                    y = writeLine(
                            contentStream,
                            titleFont,
                            "AGREEMENT TERMS",
                            y);

                    Integer leaseDurationMonths = null;

                    if (agreement.getRentalApplication() != null) {

                        leaseDurationMonths =
                                agreement.getRentalApplication()
                                        .getPreferredLeaseDurationMonths();
                    }

                    if (leaseDurationMonths != null) {

                        y = writeLine(
                                contentStream,
                                normalFont,
                                "Lease Duration: "
                                        + leaseDurationMonths
                                        + " months",
                                y);
                    }

                    y = writeLine(
                            contentStream,
                            normalFont,
                            "Start Date: "
                                    + agreement.getStartDate(),
                            y);

                    y = writeLine(
                            contentStream,
                            normalFont,
                            "End Date: "
                                    + agreement.getEndDate(),
                            y);

                    y = writeLine(
                            contentStream,
                            normalFont,
                            "Move-in Date: "
                                    + agreement.getMoveInDate(),
                            y);

                    y = writeLine(
                            contentStream,
                            normalFont,
                            "Move-out Date: "
                                    + agreement.getMoveOutDate(),
                            y);

                    // =====================================================
                    // FINANCIAL DETAILS
                    // =====================================================

                    y -= 10;

                    y = writeLine(
                            contentStream,
                            titleFont,
                            "FINANCIAL DETAILS",
                            y);

                    y = writeLine(
                            contentStream,
                            normalFont,
                            "Monthly Rent: "
                                    + agreement.getMonthlyRent(),
                            y);

                    y = writeLine(
                            contentStream,
                            normalFont,
                            "Security Deposit: "
                                    + agreement.getSecurityDeposit(),
                            y);

                    y = writeLine(
                            contentStream,
                            normalFont,
                            "Rent Due Day: "
                                    + agreement.getDueDay(),
                            y);

                    y = writeLine(
                            contentStream,
                            normalFont,
                            "Notice Period: "
                                    + agreement.getNoticePeriodDays()
                                    + " days",
                            y);

                    // =====================================================
                    // TERMS AND CONDITIONS
                    // =====================================================

                    y -= 10;

                    y = writeLine(
                            contentStream,
                            titleFont,
                            "TERMS AND CONDITIONS",
                            y);

                    String terms =
                            agreement.getTermsAndConditions();

                    if (terms != null
                            && !terms.trim().isEmpty()) {

                        y = writeLine(
                                contentStream,
                                normalFont,
                                terms,
                                y);

                    } else {

                        y = writeLine(
                                contentStream,
                                normalFont,
                                "No additional terms specified.",
                                y);
                    }

                    // =====================================================
                    // SIGNATURES
                    // =====================================================

                    y -= 30;

                    y = writeLine(
                            contentStream,
                            normalFont,
                            "Tenant Signature: ______________________________",
                            y);

                    y -= 20;

                    writeLine(
                            contentStream,
                            normalFont,
                            "Owner/Manager Signature: ________________________",
                            y);
                }

                /*
                 * Save the generated PDF into memory
                 * instead of the local filesystem.
                 */
                try (ByteArrayOutputStream outputStream =
                             new ByteArrayOutputStream()) {

                    document.save(outputStream);

                    pdfBytes =
                            outputStream.toByteArray();
                }
            }

            /*
             * Upload generated PDF to AWS S3.
             *
             * Example S3 key:
             *
             * rental-agreements/15/
             * agreement_15_abc123.pdf
             */
            return s3Service.uploadBytes(
                    pdfBytes,
                    fileName,
                    "application/pdf",
                    "rental-agreements/"
                            + agreement.getAgreementId());

        } catch (IOException e) {

            throw new RuntimeException(
                    "Failed to generate rental agreement PDF",
                    e);

        } catch (Exception e) {

            throw new RuntimeException(
                    "Failed to upload rental agreement PDF to S3",
                    e);
        }
    }

    /**
     * Fetches the property address using:
     *
     * findByProperty(Property property)
     */
    private OptionalAddressResult getPropertyAddress(
            Property property) {

        if (property == null) {
            return new OptionalAddressResult(null);
        }

        PropertyAddress address =
                propertyAddressRepository
                        .findByProperty(property)
                        .orElse(null);

        return new OptionalAddressResult(address);
    }

    /**
     * Small internal record used to keep
     * address retrieval simple and null-safe.
     */
    private record OptionalAddressResult(
            PropertyAddress address) {
    }

    // =========================================================
    // WRITE ONE LINE INTO PDF
    // =========================================================

    private float writeLine(
            PDPageContentStream contentStream,
            PDType1Font font,
            String text,
            float y) throws IOException {

        contentStream.beginText();

        contentStream.setFont(
                font,
                10);

        contentStream.newLineAtOffset(
                60,
                y);

        contentStream.showText(
                text != null
                        ? text
                        : "");

        contentStream.endText();

        return y - 18;
    }
}
