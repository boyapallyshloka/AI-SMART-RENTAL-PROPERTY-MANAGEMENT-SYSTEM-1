
package com.rental.rental_management_backend.rental.service;

import java.time.LocalDate;
import java.util.List;

import com.rental.rental_management_backend.rental.dto.RentInvoiceRequest;
import com.rental.rental_management_backend.rental.dto.RentInvoiceResponse;

public interface RentInvoiceService {

    RentInvoiceResponse createInvoice(RentInvoiceRequest request);

    void generateScheduledInvoice(Long agreementId, LocalDate today);

    RentInvoiceResponse getInvoiceById(Long invoiceId);

    List<RentInvoiceResponse> getAllInvoices();

    List<RentInvoiceResponse> getMyInvoices();
}
