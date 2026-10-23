
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

import com.rental.rental_management_backend.rental.entity.RentInvoice;
import com.rental.rental_management_backend.rental.service.RentInvoicePdfService;
import com.rental.rental_management_backend.s3.service.S3Service;

@Service
public class RentInvoicePdfServiceImpl
        implements RentInvoicePdfService {

    private final S3Service s3Service;

    public RentInvoicePdfServiceImpl(
            S3Service s3Service) {

        this.s3Service = s3Service;
    }

    @Override
    public String generateInvoicePdf(
            RentInvoice invoice) {

        try {

            /*
             * Generate unique PDF file name.
             */
            String fileName =
                    "invoice_"
                    + invoice.getInvoiceId()
                    + "_"
                    + UUID.randomUUID()
                    + ".pdf";

            /*
             * Generate PDF in memory.
             *
             * No local uploads/invoices directory
             * is created anymore.
             */
            byte[] pdfBytes;

            try (PDDocument document =
                         new PDDocument()) {

                PDPage page =
                        new PDPage();

                document.addPage(page);

                try (PDPageContentStream contentStream =
                             new PDPageContentStream(
                                     document,
                                     page)) {

                    float y = 750;

                    // =====================================================
                    // TITLE
                    // =====================================================

                    contentStream.beginText();

                    contentStream.setFont(
                            new PDType1Font(
                                    Standard14Fonts.FontName.HELVETICA_BOLD
                            ),
                            20
                    );

                    contentStream.newLineAtOffset(
                            200,
                            y
                    );

                    contentStream.showText(
                            "RENT INVOICE"
                    );

                    contentStream.endText();

                    y -= 50;

                    // =====================================================
                    // INVOICE NUMBER
                    // =====================================================

                    writeLine(
                            contentStream,
                            "Invoice Number: "
                                    + invoice.getInvoiceNumber(),
                            y
                    );

                    y -= 25;

                    // =====================================================
                    // BILLING PERIOD
                    // =====================================================

                    writeLine(
                            contentStream,
                            "Billing Period: "
                                    + invoice.getBillingMonth()
                                    + "/"
                                    + invoice.getBillingYear(),
                            y
                    );

                    y -= 25;

                    // =====================================================
                    // INVOICE DATE
                    // =====================================================

                    writeLine(
                            contentStream,
                            "Invoice Date: "
                                    + invoice.getInvoiceDate(),
                            y
                    );

                    y -= 25;

                    // =====================================================
                    // DUE DATE
                    // =====================================================

                    writeLine(
                            contentStream,
                            "Due Date: "
                                    + invoice.getDueDate(),
                            y
                    );

                    y -= 40;

                    // =====================================================
                    // TENANT
                    // =====================================================

                    writeLine(
                            contentStream,
                            "Tenant ID: "
                                    + invoice.getTenantId(),
                            y
                    );

                    y -= 25;

                    // =====================================================
                    // UNIT
                    // =====================================================

                    writeLine(
                            contentStream,
                            "Unit: "
                                    + (invoice.getUnitId() == null
                                            ? "Entire property"
                                            : "#" + invoice.getUnitId()),
                            y
                    );

                    y -= 40;

                    // =====================================================
                    // RENT
                    // =====================================================

                    writeLine(
                            contentStream,
                            "Rent Amount: INR "
                                    + invoice.getRentAmount(),
                            y
                    );

                    y -= 25;

                    // =====================================================
                    // LATE FEE
                    // =====================================================

                    writeLine(
                            contentStream,
                            "Late Fee: INR "
                                    + invoice.getLateFee(),
                            y
                    );

                    y -= 25;

                    // =====================================================
                    // TOTAL
                    // =====================================================

                    writeLine(
                            contentStream,
                            "Total Amount: INR "
                                    + invoice.getTotalAmount(),
                            y
                    );

                    y -= 25;

                    // =====================================================
                    // STATUS
                    // =====================================================

                    writeLine(
                            contentStream,
                            "Status: "
                                    + invoice.getStatus(),
                            y
                    );
                }

                /*
                 * Write PDF into memory instead of local filesystem.
                 */
                try (ByteArrayOutputStream outputStream =
                             new ByteArrayOutputStream()) {

                    document.save(outputStream);

                    pdfBytes =
                            outputStream.toByteArray();
                }
            }

            // =========================================================
            // UPLOAD PDF TO AWS S3
            // =========================================================

            /*
             * S3 folder:
             *
             * invoices/{invoiceId}/
             */
            return s3Service.uploadBytes(
                    pdfBytes,
                    fileName,
                    "application/pdf",
                    "invoices/" + invoice.getInvoiceId()
            );

        } catch (IOException e) {

            throw new RuntimeException(
                    "Failed to generate invoice PDF",
                    e
            );
        } catch (Exception e) {

            throw new RuntimeException(
                    "Failed to upload invoice PDF to S3",
                    e
            );
        }
    }

    // =========================================================
    // WRITE PDF LINE
    // =========================================================

    private void writeLine(
            PDPageContentStream contentStream,
            String text,
            float y) throws IOException {

        contentStream.beginText();

        contentStream.setFont(
                new PDType1Font(
                        Standard14Fonts.FontName.HELVETICA
                ),
                12
        );

        contentStream.newLineAtOffset(
                70,
                y
        );

        contentStream.showText(
                text
        );

        contentStream.endText();
    }
}
