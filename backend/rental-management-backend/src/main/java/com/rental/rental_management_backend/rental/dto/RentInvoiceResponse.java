package com.rental.rental_management_backend.rental.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import com.rental.rental_management_backend.rental.enums.InvoiceStatus;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RentInvoiceResponse {


private Long invoiceId;

private String invoiceNumber;

private Long agreementId;

private Long tenantId;

private String tenantName;

private String tenantEmail;

private Long unitId;

private Long propertyId;

private String propertyName;

private Integer billingMonth;

private Integer billingYear;

private LocalDate invoiceDate;

private LocalDate dueDate;

private BigDecimal rentAmount;

private BigDecimal lateFee;

private BigDecimal totalAmount;

// Total amount successfully paid for this invoice
private BigDecimal totalPaid;

// Remaining amount still to be paid
private BigDecimal remainingAmount;

private String invoiceDocument;

private InvoiceStatus status;

private LocalDateTime createdAt;

private LocalDateTime updatedAt;


public Long getInvoiceId() {
    return invoiceId;
}

public void setInvoiceId(Long invoiceId) {
    this.invoiceId = invoiceId;
}


public String getInvoiceNumber() {
    return invoiceNumber;
}

public void setInvoiceNumber(String invoiceNumber) {
    this.invoiceNumber = invoiceNumber;
}


public Long getAgreementId() {
    return agreementId;
}

public void setAgreementId(Long agreementId) {
    this.agreementId = agreementId;
}


public Long getTenantId() {
    return tenantId;
}

public void setTenantId(Long tenantId) {
    this.tenantId = tenantId;
}

public String getTenantName() {
    return tenantName;
}

public void setTenantName(String tenantName) {
    this.tenantName = tenantName;
}

public String getTenantEmail() {
    return tenantEmail;
}

public void setTenantEmail(String tenantEmail) {
    this.tenantEmail = tenantEmail;
}


public Long getUnitId() {
    return unitId;
}

public void setUnitId(Long unitId) {
    this.unitId = unitId;
}

public Long getPropertyId() {
    return propertyId;
}

public void setPropertyId(Long propertyId) {
    this.propertyId = propertyId;
}

public String getPropertyName() {
    return propertyName;
}

public void setPropertyName(String propertyName) {
    this.propertyName = propertyName;
}


public Integer getBillingMonth() {
    return billingMonth;
}

public void setBillingMonth(Integer billingMonth) {
    this.billingMonth = billingMonth;
}


public Integer getBillingYear() {
    return billingYear;
}

public void setBillingYear(Integer billingYear) {
    this.billingYear = billingYear;
}


public LocalDate getInvoiceDate() {
    return invoiceDate;
}

public void setInvoiceDate(LocalDate invoiceDate) {
    this.invoiceDate = invoiceDate;
}


public LocalDate getDueDate() {
    return dueDate;
}

public void setDueDate(LocalDate dueDate) {
    this.dueDate = dueDate;
}


public BigDecimal getRentAmount() {
    return rentAmount;
}

public void setRentAmount(BigDecimal rentAmount) {
    this.rentAmount = rentAmount;
}


public BigDecimal getLateFee() {
    return lateFee;
}

public void setLateFee(BigDecimal lateFee) {
    this.lateFee = lateFee;
}


public BigDecimal getTotalAmount() {
    return totalAmount;
}

public void setTotalAmount(BigDecimal totalAmount) {
    this.totalAmount = totalAmount;
}


public BigDecimal getTotalPaid() {
    return totalPaid;
}

public void setTotalPaid(BigDecimal totalPaid) {
    this.totalPaid = totalPaid;
}


public BigDecimal getRemainingAmount() {
    return remainingAmount;
}

public void setRemainingAmount(BigDecimal remainingAmount) {
    this.remainingAmount = remainingAmount;
}


public String getInvoiceDocument() {
    return invoiceDocument;
}

public void setInvoiceDocument(String invoiceDocument) {
    this.invoiceDocument = invoiceDocument;
}


public InvoiceStatus getStatus() {
    return status;
}

public void setStatus(InvoiceStatus status) {
    this.status = status;
}


public LocalDateTime getCreatedAt() {
    return createdAt;
}

public void setCreatedAt(LocalDateTime createdAt) {
    this.createdAt = createdAt;
}


public LocalDateTime getUpdatedAt() {
    return updatedAt;
}

public void setUpdatedAt(LocalDateTime updatedAt) {
    this.updatedAt = updatedAt;
}


}
