
package com.rental.rental_management_backend.reports.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.expense.entity.Expense;
import com.rental.rental_management_backend.expense.repository.ExpenseRepository;
import com.rental.rental_management_backend.maintenance.entity.MaintenanceRequest;
import com.rental.rental_management_backend.maintenance.enums.MaintenanceCostResponsibility;
import com.rental.rental_management_backend.maintenance.repository.MaintenanceRequestRepository;
import com.rental.rental_management_backend.payment.entity.Payment;
import com.rental.rental_management_backend.payment.enums.PaymentStatus;
import com.rental.rental_management_backend.payment.repository.PaymentRepository;
import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.entity.PropertyManager;
import com.rental.rental_management_backend.property.entity.Unit;
import com.rental.rental_management_backend.property.enums.UnitStatus;
import com.rental.rental_management_backend.property.repository.PropertyManagerRepository;
import com.rental.rental_management_backend.property.repository.PropertyRepository;
import com.rental.rental_management_backend.property.repository.UnitRepository;
import com.rental.rental_management_backend.rental.entity.RentInvoice;
import com.rental.rental_management_backend.rental.enums.InvoiceStatus;
import com.rental.rental_management_backend.rental.repository.RentInvoiceRepository;
import com.rental.rental_management_backend.reports.dto.ReportsAnalyticsResponse;
import com.rental.rental_management_backend.reports.dto.ReportsAnalyticsResponse.ExpenseBreakdown;
import com.rental.rental_management_backend.reports.dto.ReportsAnalyticsResponse.MonthlyTrend;
import com.rental.rental_management_backend.reports.dto.ReportsAnalyticsResponse.PropertyIncome;
import com.rental.rental_management_backend.reports.dto.ReportsAnalyticsResponse.Summary;

@Service
@Transactional(readOnly = true)
public class ReportsAnalyticsServiceImpl implements ReportsAnalyticsService {

    private static final BigDecimal ZERO =
            BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

    private final UserRepository userRepository;
    private final PropertyRepository propertyRepository;
    private final PropertyManagerRepository propertyManagerRepository;
    private final UnitRepository unitRepository;
    private final RentInvoiceRepository rentInvoiceRepository;
    private final PaymentRepository paymentRepository;
    private final ExpenseRepository expenseRepository;
    private final MaintenanceRequestRepository maintenanceRequestRepository;

    public ReportsAnalyticsServiceImpl(
            UserRepository userRepository,
            PropertyRepository propertyRepository,
            PropertyManagerRepository propertyManagerRepository,
            UnitRepository unitRepository,
            RentInvoiceRepository rentInvoiceRepository,
            PaymentRepository paymentRepository,
            ExpenseRepository expenseRepository,
            MaintenanceRequestRepository maintenanceRequestRepository) {

        this.userRepository = userRepository;
        this.propertyRepository = propertyRepository;
        this.propertyManagerRepository = propertyManagerRepository;
        this.unitRepository = unitRepository;
        this.rentInvoiceRepository = rentInvoiceRepository;
        this.paymentRepository = paymentRepository;
        this.expenseRepository = expenseRepository;
        this.maintenanceRequestRepository = maintenanceRequestRepository;
    }

    @Override
    public ReportsAnalyticsResponse getReports(
            String authenticatedEmail,
            LocalDate startDate,
            LocalDate endDate) {

        if (startDate == null || endDate == null
                || startDate.isAfter(endDate)) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "startDate must be on or before endDate");
        }

        User user = userRepository.findByEmail(authenticatedEmail)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Authenticated user was not found"));

        List<Property> properties = resolveProperties(user);

        Set<Long> propertyIds = properties.stream()
                .map(Property::getPropertyId)
                .collect(Collectors.toSet());

        Map<Long, List<Unit>> unitsByProperty = new HashMap<>();
        Map<Long, Long> propertyIdByUnitId = new HashMap<>();

        for (Unit unit : unitRepository.findAll()) {

            if (unit.getFloor() == null
                    || unit.getFloor().getBuilding() == null
                    || unit.getFloor().getBuilding().getProperty() == null) {
                continue;
            }

            Long propertyId = unit.getFloor()
                    .getBuilding()
                    .getProperty()
                    .getPropertyId();

            if (!propertyIds.contains(propertyId)) {
                continue;
            }

            unitsByProperty
                    .computeIfAbsent(propertyId, key -> new ArrayList<>())
                    .add(unit);

            propertyIdByUnitId.put(unit.getUnitId(), propertyId);
        }

        LocalDateTime start = startDate.atStartOfDay();
        LocalDateTime endExclusive = endDate.plusDays(1).atStartOfDay();

        List<RentInvoice> invoices = rentInvoiceRepository.findAll().stream()
                .filter(invoice ->
                        propertyIdByUnitId.containsKey(invoice.getUnitId()))
                .toList();

        Map<Long, RentInvoice> invoiceById = invoices.stream()
                .collect(Collectors.toMap(
                        RentInvoice::getInvoiceId,
                        Function.identity(),
                        (first, second) -> first));

        Map<Long, BigDecimal> successfulPaymentByInvoice = new HashMap<>();
        Map<Long, BigDecimal> incomeByProperty = zeroAmounts(propertyIds);

        // Initialize every month in the requested range.
        Map<YearMonth, BigDecimal> incomeByMonth = new LinkedHashMap<>();

        YearMonth firstMonth = YearMonth.from(startDate);
        YearMonth lastMonth = YearMonth.from(endDate);

        for (YearMonth month = firstMonth;
                !month.isAfter(lastMonth);
                month = month.plusMonths(1)) {

            incomeByMonth.put(month, BigDecimal.ZERO);
        }

        // Calculate successful rental payments.
        for (Payment payment : paymentRepository.findAll()) {

            if (payment.getPaymentStatus() != PaymentStatus.SUCCESS
                    || payment.getInvoice() == null
                    || payment.getPaymentDate() == null
                    || payment.getAmount() == null) {
                continue;
            }

            Long invoiceId = payment.getInvoice().getInvoiceId();

            if (!invoiceById.containsKey(invoiceId)) {
                continue;
            }

            LocalDateTime paymentDate = payment.getPaymentDate();

            // Payments after the reporting period do not reduce
            // historical outstanding rent.
            if (!paymentDate.isBefore(endExclusive)) {
                continue;
            }

            BigDecimal amount = safe(payment.getAmount());

            successfulPaymentByInvoice.merge(
                    invoiceId, amount, BigDecimal::add);

            if (paymentDate.isBefore(start)) {
                continue;
            }

            RentInvoice invoice = invoiceById.get(invoiceId);

            Long propertyId =
                    propertyIdByUnitId.get(invoice.getUnitId());

            if (propertyId == null) {
                continue;
            }

            incomeByProperty.merge(
                    propertyId, amount, BigDecimal::add);

            YearMonth paymentMonth = YearMonth.from(paymentDate);

            incomeByMonth.merge(
                    paymentMonth, amount, BigDecimal::add);
        }

        // Outstanding rent as of endDate.
        Map<Long, BigDecimal> outstandingByProperty =
                zeroAmounts(propertyIds);

        for (RentInvoice invoice : invoices) {

            if (invoice.getStatus() == InvoiceStatus.CANCELLED
                    || invoice.getDueDate() == null
                    || invoice.getDueDate().isAfter(endDate)) {
                continue;
            }

            Long propertyId =
                    propertyIdByUnitId.get(invoice.getUnitId());

            if (propertyId == null) {
                continue;
            }

            BigDecimal invoiceAmount = safe(invoice.getTotalAmount());

            BigDecimal paidAmount = successfulPaymentByInvoice
                    .getOrDefault(invoice.getInvoiceId(), BigDecimal.ZERO);

            BigDecimal outstanding = invoiceAmount.subtract(paidAmount);

            if (outstanding.signum() > 0) {
                outstandingByProperty.merge(
                        propertyId, outstanding, BigDecimal::add);
            }
        }

        // Recorded expenses during the requested period.
        Map<Long, BigDecimal> expensesByProperty =
                zeroAmounts(propertyIds);

        Map<String, BigDecimal> expenseByCategory = new HashMap<>();

        for (Expense expense : expenseRepository.findAll()) {

            if (expense.getProperty() == null
                    || expense.getExpenseDate() == null
                    || expense.getExpenseDate().isBefore(startDate)
                    || expense.getExpenseDate().isAfter(endDate)) {
                continue;
            }

            Long propertyId = expense.getProperty().getPropertyId();

            if (!propertyIds.contains(propertyId)) {
                continue;
            }

            BigDecimal amount = safe(expense.getAmount());

            expensesByProperty.merge(
                    propertyId, amount, BigDecimal::add);

            String category = expense.getCategory() == null
                    ? "UNCATEGORIZED"
                    : expense.getCategory().name();

            expenseByCategory.merge(
                    category, amount, BigDecimal::add);
        }

        // Maintenance costs are deducted from net income when the
        // request is completed, has a recorded cost, and has a
        // completion date within the requested reporting period.
        //
        // This assumes these costs are not already included in
        // the Expenses table. The current schema does not establish
        // whether the cost was actually paid.
        Map<Long, BigDecimal> maintenanceByProperty =
                zeroAmounts(propertyIds);

        long maintenanceCount = 0;

        for (MaintenanceRequest request
                : maintenanceRequestRepository.findAll()) {

            if (request.getProperty() == null
                    || request.getRequestedDate() == null) {
                continue;
            }

            Long propertyId = request.getProperty().getPropertyId();

            if (!propertyIds.contains(propertyId)) {
                continue;
            }

            LocalDateTime requestedDate = request.getRequestedDate();

            // Count requests by request date, independently of cost.
            if (!requestedDate.isBefore(start)
                    && requestedDate.isBefore(endExclusive)) {
                maintenanceCount++;
            }

            // Deduct only completed requests with a cost and a
            // completion date inside the reporting period.
            if (request.getStatus() == null
                    || !"COMPLETED".equals(request.getStatus().name())
                    || request.getCost() == null
                    || request.getCostResponsibility() != MaintenanceCostResponsibility.OWNER_PAID
                    || request.getCompletedDate() == null) {
                continue;
            }

            if (request.getPayer() == MaintenancePayer.TENANT_PAID) {
                continue;
            }

            LocalDateTime completedDate = request.getCompletedDate();

            if (completedDate.isBefore(start)
                    || !completedDate.isBefore(endExclusive)) {
                continue;
            }

            maintenanceByProperty.merge(
                    propertyId,
                    safe(request.getCost()),
                    BigDecimal::add);
        }

        List<PropertyIncome> propertyReports = new ArrayList<>();

        long totalUnits = 0;
        long occupiedUnits = 0;
        long vacantUnits = 0;
        long otherUnits = 0;

        BigDecimal totalIncome = BigDecimal.ZERO;
        BigDecimal totalExpenses = BigDecimal.ZERO;
        BigDecimal totalMaintenance = BigDecimal.ZERO;
        BigDecimal totalOutstanding = BigDecimal.ZERO;

        for (Property property : properties) {

            Long propertyId = property.getPropertyId();

            List<Unit> units = unitsByProperty.getOrDefault(
                    propertyId, List.of());

            long occupied = units.stream()
                    .filter(unit ->
                            unit.getStatus() == UnitStatus.OCCUPIED)
                    .count();

            long vacant = units.stream()
                    .filter(unit ->
                            unit.getStatus() == UnitStatus.VACANT)
                    .count();

            long other = units.size() - occupied - vacant;

            BigDecimal income =
                    money(incomeByProperty.get(propertyId));

            BigDecimal expenses =
                    money(expensesByProperty.get(propertyId));

            BigDecimal maintenance =
                    money(maintenanceByProperty.get(propertyId));

            // Net income = rent collected - expenses - maintenance.
            BigDecimal netIncome = income
                    .subtract(expenses)
                    .subtract(maintenance);

            propertyReports.add(new PropertyIncome(
                    propertyId,
                    property.getPropertyName(),
                    income,
                    expenses,
                    maintenance,
                    money(netIncome),
                    units.size(),
                    occupied,
                    vacant,
                    percentage(occupied, units.size())));

            totalUnits += units.size();
            occupiedUnits += occupied;
            vacantUnits += vacant;
            otherUnits += other;

            totalIncome = totalIncome.add(income);
            totalExpenses = totalExpenses.add(expenses);
            totalMaintenance = totalMaintenance.add(maintenance);

            totalOutstanding = totalOutstanding.add(
                    money(outstandingByProperty.get(propertyId)));
        }

        propertyReports.sort(
                Comparator.comparing(
                        PropertyIncome::propertyName,
                        Comparator.nullsLast(
                                String.CASE_INSENSITIVE_ORDER)));

        List<MonthlyTrend> monthlyTrend = incomeByMonth.entrySet().stream()
                .map(entry -> new MonthlyTrend(
                        entry.getKey(),
                        money(entry.getValue())))
                .toList();

        List<ExpenseBreakdown> expenseBreakdown =
                expenseByCategory.entrySet().stream()
                        .sorted(Map.Entry.comparingByKey())
                        .map(entry -> new ExpenseBreakdown(
                                entry.getKey(),
                                money(entry.getValue())))
                        .toList();

        // Overall net income also deducts maintenance costs.
        BigDecimal totalNetIncome = totalIncome
                .subtract(totalExpenses)
                .subtract(totalMaintenance);

        Summary summary = new Summary(
                properties.size(),
                totalUnits,
                occupiedUnits,
                vacantUnits,
                otherUnits,
                percentage(occupiedUnits, totalUnits),
                percentage(vacantUnits, totalUnits),
                money(totalIncome),
                money(totalOutstanding),
                money(totalExpenses),
                money(totalMaintenance),
                money(totalNetIncome),
                maintenanceCount);

        return new ReportsAnalyticsResponse(
                startDate.toString(),
                endDate.toString(),
                summary,
                propertyReports,
                monthlyTrend,
                expenseBreakdown);
    }

    private List<Property> resolveProperties(User user) {

        if (user.getRole() == RoleType.SUPER_ADMIN) {
            return propertyRepository.findAll();
        }

        if (user.getRole() == RoleType.PROPERTY_OWNER) {
            return propertyRepository.findByOwner(user);
        }

        if (user.getRole() == RoleType.PROPERTY_MANAGER) {

            PropertyManager manager = propertyManagerRepository
                    .findByUser(user)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.FORBIDDEN,
                            "No property manager profile is linked to this user"));

            return propertyRepository.findByPropertyManager(manager);
        }

        throw new ResponseStatusException(
                HttpStatus.FORBIDDEN,
                "You are not allowed to access reports and analytics");
    }

    private Map<Long, BigDecimal> zeroAmounts(Set<Long> propertyIds) {

        Map<Long, BigDecimal> result = new HashMap<>();

        propertyIds.forEach(id -> result.put(id, BigDecimal.ZERO));

        return result;
    }

    private BigDecimal safe(BigDecimal amount) {

        return amount == null ? BigDecimal.ZERO : amount;
    }

    private BigDecimal money(BigDecimal amount) {

        return safe(amount).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal percentage(long numerator, long denominator) {

        if (denominator == 0) {
            return ZERO;
        }

        return BigDecimal.valueOf(numerator)
                .multiply(BigDecimal.valueOf(100))
                .divide(
                        BigDecimal.valueOf(denominator),
                        2,
                        RoundingMode.HALF_UP);
    }
}
