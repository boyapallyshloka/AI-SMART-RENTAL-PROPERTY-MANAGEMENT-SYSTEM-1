package com.rental.rental_management_backend.reports.dto;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.List;

/** Response DTOs for owner/manager reports and analytics. */
public record ReportsAnalyticsResponse(
        String startDate,
        String endDate,
        Summary summary,
        List<PropertyIncome> propertyIncome,
        List<MonthlyTrend> monthlyIncomeTrend,
        List<ExpenseBreakdown> expenseBreakdown) {

    public record Summary(
            long totalProperties,
            long totalUnits,
            long occupiedUnits,
            long vacantUnits,
            long otherUnits,
            BigDecimal occupancyRatePercent,
            BigDecimal vacancyRatePercent,
            BigDecimal rentalIncomeCollected,
            BigDecimal outstandingRent,
            BigDecimal recordedExpenses,
            BigDecimal maintenanceCost,
            BigDecimal estimatedNetIncome,
            long maintenanceRequests) {
    }

    public record PropertyIncome(
            Long propertyId,
            String propertyName,
            BigDecimal incomeCollected,
            BigDecimal recordedExpenses,
            BigDecimal maintenanceCost,
            BigDecimal estimatedNetIncome,
            long totalUnits,
            long occupiedUnits,
            long vacantUnits,
            BigDecimal occupancyRatePercent) {
    }

    public record MonthlyTrend(YearMonth month, BigDecimal incomeCollected) {
    }

    public record ExpenseBreakdown(String category, BigDecimal amount) {
    }

	public String startDate() {
		return startDate;
	}

	public String endDate() {
		return endDate;
	}

	public Summary summary() {
		return summary;
	}

	public List<PropertyIncome> propertyIncome() {
		return propertyIncome;
	}

	public List<MonthlyTrend> monthlyIncomeTrend() {
		return monthlyIncomeTrend;
	}

	public List<ExpenseBreakdown> expenseBreakdown() {
		return expenseBreakdown;
	}
    
}
