
package com.rental.rental_management_backend.rental.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.rental.rental_management_backend.rental.dto.RentInvoiceRequest;
import com.rental.rental_management_backend.rental.dto.RentInvoiceResponse;
import com.rental.rental_management_backend.rental.service.RentInvoiceService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/rent-invoices")
public class RentInvoiceController {

    private final RentInvoiceService rentInvoiceService;

    public RentInvoiceController(
            RentInvoiceService rentInvoiceService) {

        this.rentInvoiceService = rentInvoiceService;
    }

    // Create monthly rent invoice

    @PostMapping
    @PreAuthorize("hasAnyRole('PROPERTY_OWNER', 'PROPERTY_MANAGER', 'SUPER_ADMIN')")
    public ResponseEntity<RentInvoiceResponse> createInvoice(
            @Valid @RequestBody RentInvoiceRequest request) {

        RentInvoiceResponse response =
                rentInvoiceService.createInvoice(request);

        return new ResponseEntity<>(
                response,
                HttpStatus.CREATED
        );
    }

    // Get logged-in tenant's invoices

    @GetMapping("/my")
    @PreAuthorize("hasRole('TENANT')")
    public ResponseEntity<List<RentInvoiceResponse>> getMyInvoices() {

        List<RentInvoiceResponse> response =
                rentInvoiceService.getMyInvoices();

        return ResponseEntity.ok(response);
    }

    // Get invoice by ID

    @GetMapping("/{invoiceId}")
    @PreAuthorize("hasAnyRole('PROPERTY_OWNER', 'PROPERTY_MANAGER', 'TENANT', 'SUPER_ADMIN')")
    public ResponseEntity<RentInvoiceResponse> getInvoiceById(
            @PathVariable Long invoiceId) {

        RentInvoiceResponse response =
                rentInvoiceService.getInvoiceById(invoiceId);

        return ResponseEntity.ok(response);
    }

    // Get all invoices

    @GetMapping
    @PreAuthorize("hasAnyRole('PROPERTY_OWNER', 'PROPERTY_MANAGER', 'SUPER_ADMIN')")
    public ResponseEntity<List<RentInvoiceResponse>> getAllInvoices() {

        List<RentInvoiceResponse> response =
                rentInvoiceService.getAllInvoices();

        return ResponseEntity.ok(response);
    }
}
