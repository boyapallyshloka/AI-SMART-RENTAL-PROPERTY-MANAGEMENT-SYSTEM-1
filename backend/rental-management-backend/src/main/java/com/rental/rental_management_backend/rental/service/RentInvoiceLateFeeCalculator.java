package com.rental.rental_management_backend.rental.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

import com.rental.rental_management_backend.rental.entity.RentInvoice;

public final class RentInvoiceLateFeeCalculator {

    private static final BigDecimal DAILY_LATE_FEE_RATE =
            new BigDecimal("0.02");

    private static final ZoneId BUSINESS_TIME_ZONE =
            ZoneId.of("Asia/Kolkata");

    private RentInvoiceLateFeeCalculator() {
    }

    public static LocalDate currentDate() {
        return LocalDate.now(BUSINESS_TIME_ZONE);
    }

    public static boolean recalculate(
            RentInvoice invoice,
            LocalDate currentDate) {

        if (invoice.getDueDate() == null
                || !currentDate.isAfter(invoice.getDueDate())) {
            return false;
        }

        long daysLate = ChronoUnit.DAYS.between(
                invoice.getDueDate(),
                currentDate);
        BigDecimal rentAmount = invoice.getRentAmount() == null
                ? BigDecimal.ZERO
                : invoice.getRentAmount();
        BigDecimal lateFee = rentAmount
                .multiply(DAILY_LATE_FEE_RATE)
                .multiply(BigDecimal.valueOf(daysLate))
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal totalAmount = rentAmount.add(lateFee)
                .setScale(2, RoundingMode.HALF_UP);

        BigDecimal existingLateFee = invoice.getLateFee();
        BigDecimal existingTotalAmount = invoice.getTotalAmount();
        boolean changed = existingLateFee == null
                || existingLateFee.compareTo(lateFee) != 0
                || existingTotalAmount == null
                || existingTotalAmount.compareTo(totalAmount) != 0;

        invoice.setLateFee(lateFee);
        invoice.setTotalAmount(totalAmount);
        return changed;
    }
}
