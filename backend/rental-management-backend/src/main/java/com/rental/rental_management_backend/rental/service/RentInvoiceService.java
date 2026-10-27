
package com.rental.rental_management_backend.rental.service;

import java.time.LocalDate;
import java.util.List;

import com.rental.rental_management_backend.rental.dto.RentInvoiceLateFeeRequest;
import com.rental.rental_management_backend.rental.dto.RentInvoiceRequest;
import com.rental.rental_management_backend.rental.dto.RentInvoiceResponse;

public interface RentInvoiceService {

    RentInvoiceResponse createInvoice(RentInvoiceRequest request);

    RentInvoiceResponse updateLateFee(
            Long invoiceId,
            RentInvoiceLateFeeRequest request);

    void generateScheduledInvoice(Long agreementId, LocalDate today);

    RentInvoiceResponse getInvoiceById(Long invoiceId);

    List<RentInvoiceResponse> getAllInvoices();

    List<RentInvoiceResponse> getMyInvoices();
}
