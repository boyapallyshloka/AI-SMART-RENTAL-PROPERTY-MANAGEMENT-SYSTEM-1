
package com.rental.rental_management_backend.rental.service;

import java.util.List;
import java.util.Optional;
import java.time.LocalDate;
import java.time.YearMonth;

import com.rental.rental_management_backend.rental.dto.RentInvoiceRequest;
import com.rental.rental_management_backend.rental.dto.RentInvoiceResponse;

public interface RentInvoiceService {

    RentInvoiceResponse createInvoice(RentInvoiceRequest request);

    Optional<Long> createScheduledInvoice(
            Long agreementId,
            YearMonth billingPeriod,
            LocalDate today);

    RentInvoiceResponse getInvoiceById(Long invoiceId);

    List<RentInvoiceResponse> getAllInvoices();

    List<RentInvoiceResponse> getMyInvoices();
}
