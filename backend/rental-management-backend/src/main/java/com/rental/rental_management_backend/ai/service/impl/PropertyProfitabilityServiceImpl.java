package com.rental.rental_management_backend.ai.service.impl;

import java.math.BigDecimal;
import java.math.MathContext;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.ai.client.M6ProfitabilityClient;
import com.rental.rental_management_backend.ai.dto.M6ProfitabilityRequest;
import com.rental.rental_management_backend.ai.dto.M6ProfitabilityResponse;
import com.rental.rental_management_backend.ai.service.PropertyProfitabilityService;
import com.rental.rental_management_backend.expense.entity.Expense;
import com.rental.rental_management_backend.expense.repository.ExpenseRepository;
import com.rental.rental_management_backend.maintenance.entity.MaintenanceRequest;
import com.rental.rental_management_backend.maintenance.enums.MaintenancePayer;
import com.rental.rental_management_backend.maintenance.enums.MaintenanceStatus;
import com.rental.rental_management_backend.maintenance.repository.MaintenanceRequestRepository;
import com.rental.rental_management_backend.payment.enums.PaymentStatus;
import com.rental.rental_management_backend.payment.repository.PaymentRepository;
import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.entity.PropertyAddress;
import com.rental.rental_management_backend.property.entity.Unit;
import com.rental.rental_management_backend.property.enums.PropertyType;
import com.rental.rental_management_backend.property.enums.UnitStatus;
import com.rental.rental_management_backend.property.repository.PropertyAddressRepository;
import com.rental.rental_management_backend.property.repository.PropertyRepository;
import com.rental.rental_management_backend.property.repository.UnitRepository;
import com.rental.rental_management_backend.rental.entity.RentalAgreement;
import com.rental.rental_management_backend.rental.enums.AgreementStatus;
import com.rental.rental_management_backend.rental.repository.RentalAgreementRepository;

@Service
@Transactional(readOnly = true)
public class PropertyProfitabilityServiceImpl
        implements PropertyProfitabilityService {

    private static final BigDecimal ZERO = BigDecimal.ZERO;
    private static final BigDecimal ONE = BigDecimal.ONE;
    private static final int HISTORY_MONTHS = 6;

    private final PropertyRepository propertyRepository;
    private final PropertyAddressRepository propertyAddressRepository;
    private final UnitRepository unitRepository;
    private final RentalAgreementRepository rentalAgreementRepository;
    private final PaymentRepository paymentRepository;
    private final ExpenseRepository expenseRepository;
    private final MaintenanceRequestRepository maintenanceRequestRepository;
    private final UserRepository userRepository;
    private final M6ProfitabilityClient profitabilityClient;

    public PropertyProfitabilityServiceImpl(
            PropertyRepository propertyRepository,
            PropertyAddressRepository propertyAddressRepository,
            UnitRepository unitRepository,
            RentalAgreementRepository rentalAgreementRepository,
            PaymentRepository paymentRepository,
            ExpenseRepository expenseRepository,
            MaintenanceRequestRepository maintenanceRequestRepository,
            UserRepository userRepository,
            M6ProfitabilityClient profitabilityClient) {
        this.propertyRepository = propertyRepository;
        this.propertyAddressRepository = propertyAddressRepository;
        this.unitRepository = unitRepository;
        this.rentalAgreementRepository = rentalAgreementRepository;
        this.paymentRepository = paymentRepository;
        this.expenseRepository = expenseRepository;
        this.maintenanceRequestRepository = maintenanceRequestRepository;
        this.userRepository = userRepository;
        this.profitabilityClient = profitabilityClient;
    }

    @Override
    public M6ProfitabilityResponse predict(
            Long propertyId,
            String authenticatedEmail) {
        User user = userRepository.findByEmail(authenticatedEmail)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Authenticated user was not found"));
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Property was not found"));

        authorize(property, user);

        PropertyAddress address = propertyAddressRepository
                .findByProperty(property)
                .orElseThrow(() -> invalidData(
                        "Property address and city are required for profitability prediction"));
        String city = address.getCity();
        if (city == null || city.isBlank()) {
            throw invalidData(
                    "Property address and city are required for profitability prediction");
        }

        boolean directRental = isDirectRental(property);
        List<Unit> rentableUnits = directRental
                ? List.of()
                : loadRentableUnits(propertyId);
        BigDecimal sizeSqft = resolveSize(property, rentableUnits, directRental);
        BigDecimal bedroomsBhk =
                resolveBedrooms(property, rentableUnits, directRental);
        BigDecimal propertyRent =
                resolveMonthlyRent(property, rentableUnits, directRental);
        int yearBuilt = resolveYearBuilt(property);

        YearMonth currentMonth = YearMonth.now();
        YearMonth firstMonth = currentMonth.minusMonths(HISTORY_MONTHS - 1L);
        LocalDateTime rangeStart = firstMonth.atDay(1).atStartOfDay();
        LocalDateTime rangeEndExclusive = currentMonth.plusMonths(1)
                .atDay(1).atStartOfDay();
        List<YearMonth> availableMonths = availableMonths(
                property, firstMonth, currentMonth);

        Map<YearMonth, BigDecimal> collectedByMonth =
                initializeMonthlyAmounts(availableMonths);
        for (PaymentRepository.ProfitabilityPayment payment
                : paymentRepository.findSuccessfulPaymentsForPropertyBetween(
                        propertyId,
                        PaymentStatus.SUCCESS,
                        rangeStart,
                        rangeEndExclusive)) {
            YearMonth month = YearMonth.from(payment.getPaymentDate());
            if (collectedByMonth.containsKey(month)) {
                requireNonNegative(payment.getAmount(), "payment amount");
                collectedByMonth.merge(
                        month, payment.getAmount(), BigDecimal::add);
            }
        }

        Map<YearMonth, BigDecimal> expenseByMonth =
                initializeMonthlyAmounts(availableMonths);
        LocalDate firstDate = firstMonth.atDay(1);
        LocalDate lastDate = currentMonth.atEndOfMonth();
        for (Expense expense : expenseRepository
                .findByProperty_PropertyIdAndExpenseDateBetween(
                        propertyId, firstDate, lastDate)) {
            YearMonth month = YearMonth.from(expense.getExpenseDate());
            if (expenseByMonth.containsKey(month)) {
                requireNonNegative(expense.getAmount(), "expense amount");
                expenseByMonth.merge(
                        month, expense.getAmount(), BigDecimal::add);
            }
        }

        for (MaintenanceRequest request : maintenanceRequestRepository
                .findByProperty_PropertyIdAndStatusAndPayerAndCompletedDateGreaterThanEqualAndCompletedDateLessThan(
                        propertyId,
                        MaintenanceStatus.COMPLETED,
                        MaintenancePayer.OWNER_PAID,
                        rangeStart,
                        rangeEndExclusive)) {
            YearMonth month = YearMonth.from(request.getCompletedDate());
            if (expenseByMonth.containsKey(month)
                    && request.getCost() != null) {
                requireNonNegative(request.getCost(), "maintenance cost");
                expenseByMonth.merge(
                        month, request.getCost(), BigDecimal::add);
            }
        }

        LocalDate rangeStartDate = firstMonth.atDay(1);
        LocalDate rangeEndDate = currentMonth.atEndOfMonth();
        List<RentalAgreement> agreements =
                rentalAgreementRepository.findProfitabilityAgreements(
                        propertyId,
                        rangeStartDate,
                        rangeEndDate,
                        AgreementStatus.DRAFT);

        Set<Long> rentableUnitIds = rentableUnits.stream()
                .map(Unit::getUnitId)
                .collect(Collectors.toSet());
        List<MonthlyValues> history = new ArrayList<>();

        for (YearMonth month : availableMonths) {
            List<Unit> unitsInMonth = directRental
                    ? List.of()
                    : unitsCreatedBy(rentableUnits, month);
            Set<Long> unitIdsInMonth = unitsInMonth.stream()
                    .map(Unit::getUnitId)
                    .collect(Collectors.toSet());
            BigDecimal monthlyRent = directRental
                    ? propertyRent
                    : sumUnitRent(unitsInMonth);
            BigDecimal occupancyRate = occupancyRate(
                    property,
                    directRental,
                    month,
                    agreements,
                    unitIdsInMonth,
                    unitsInMonth.size(),
                    rentableUnitIds);
            BigDecimal collectedRent = collectedByMonth.get(month);
            BigDecimal expenseAmount = expenseByMonth.get(month);

            history.add(new MonthlyValues(
                    month,
                    monthlyRent,
                    collectedRent,
                    expenseAmount,
                    occupancyRate));
        }

        if (history.isEmpty()) {
            throw invalidData(
                    "No monthly property history is available for profitability prediction");
        }

        M6ProfitabilityRequest request = createRequest(
                city,
                sizeSqft,
                bedroomsBhk,
                yearBuilt,
                history);
        M6ProfitabilityResponse response = profitabilityClient.predict(request);

        if (response == null
                || !Boolean.TRUE.equals(response.success())
                || response.predictedNextMonthProfit() == null
                || response.profitabilityLabel() == null
                || response.modelVersion() == null
                || response.modelVersion().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "M6 profitability service returned an invalid response");
        }
        return response;
    }

    private void authorize(Property property, User user) {
        if (user.getRole() == RoleType.SUPER_ADMIN) {
            return;
        }
        if (user.getRole() == RoleType.PROPERTY_OWNER
                && property.getOwner() != null
                && Objects.equals(property.getOwner().getId(), user.getId())) {
            return;
        }
        if (user.getRole() == RoleType.PROPERTY_MANAGER
                && property.getPropertyManager() != null
                && property.getPropertyManager().getUser() != null
                && Objects.equals(
                        property.getPropertyManager().getUser().getId(),
                        user.getId())) {
            return;
        }
        throw new AccessDeniedException(
                "You are not authorized to view profitability for this property");
    }

    private boolean isDirectRental(Property property) {
        return property.getPropertyType() == PropertyType.HOUSE
                || property.getPropertyType() == PropertyType.VILLA;
    }

    private List<Unit> loadRentableUnits(Long propertyId) {
        List<Unit> propertyUnits =
                unitRepository.findAllByPropertyIdForProfitability(propertyId);
        List<Unit> rentableUnits = new ArrayList<>();
        for (Unit unit : propertyUnits) {
            if (unit.getStatus() == null) {
                throw invalidData("A property Unit has no valid status");
            }
            if (unit.getStatus() != UnitStatus.MAINTENANCE) {
                rentableUnits.add(unit);
            }
        }
        if (rentableUnits.isEmpty()) {
            throw invalidData(
                    "Property has no rentable Units for profitability prediction");
        }
        return rentableUnits;
    }

    private BigDecimal resolveSize(
            Property property,
            List<Unit> rentableUnits,
            boolean directRental) {
        if (property.getTotalArea() != null) {
            return nonNegativeArea(property.getTotalArea(), "Property total area");
        }
        if (directRental) {
            throw invalidData(
                    "Property total area is required for HOUSE/VILLA profitability prediction");
        }

        BigDecimal totalArea = ZERO;
        for (Unit unit : rentableUnits) {
            if (unit.getArea() == null) {
                throw invalidData(
                        "Every rentable Unit must have area when Property total area is unavailable");
            }
            totalArea = totalArea.add(nonNegativeArea(
                    unit.getArea(), "Unit area"));
        }
        return totalArea;
    }

    private BigDecimal resolveBedrooms(
            Property property,
            List<Unit> rentableUnits,
            boolean directRental) {
        if (directRental) {
            Integer bedrooms = property.getBedrooms();
            if (bedrooms == null || bedrooms < 0) {
                throw invalidData(
                        "Property bedrooms are required for HOUSE/VILLA profitability prediction");
            }
            return BigDecimal.valueOf(bedrooms);
        }

        BigDecimal totalBedrooms = ZERO;
        for (Unit unit : rentableUnits) {
            if (unit.getBedrooms() == null || unit.getBedrooms() < 0) {
                throw invalidData(
                        "Every rentable Unit must have a valid bedroom count");
            }
            totalBedrooms =
                    totalBedrooms.add(BigDecimal.valueOf(unit.getBedrooms()));
        }
        return totalBedrooms.divide(
                BigDecimal.valueOf(rentableUnits.size()),
                MathContext.DECIMAL128);
    }

    private BigDecimal resolveMonthlyRent(
            Property property,
            List<Unit> rentableUnits,
            boolean directRental) {
        if (directRental) {
            return requireNonNegative(
                    property.getMonthlyRent(), "Property monthly rent");
        }
        return sumUnitRent(rentableUnits);
    }

    private BigDecimal sumUnitRent(List<Unit> units) {
        BigDecimal total = ZERO;
        for (Unit unit : units) {
            total = total.add(requireNonNegative(
                    unit.getMonthlyRent(), "Unit monthly rent"));
        }
        return total;
    }

    private int resolveYearBuilt(Property property) {
        Integer yearBuilt = property.getYearBuilt();
        if (yearBuilt == null || yearBuilt < 0
                || yearBuilt > LocalDate.now().getYear()) {
            throw invalidData(
                    "Property yearBuilt must be present and cannot be in the future");
        }
        return yearBuilt;
    }

    private List<YearMonth> availableMonths(
            Property property,
            YearMonth firstMonth,
            YearMonth currentMonth) {
        if (property.getCreatedAt() == null) {
            throw invalidData(
                    "Property creation date is required to determine available history");
        }
        YearMonth createdMonth =
                YearMonth.from(property.getCreatedAt().toLocalDate());
        List<YearMonth> months = new ArrayList<>();
        for (YearMonth month = firstMonth;
                !month.isAfter(currentMonth);
                month = month.plusMonths(1)) {
            if (!month.isBefore(createdMonth)) {
                months.add(month);
            }
        }
        return months;
    }

    private List<Unit> unitsCreatedBy(
            List<Unit> rentableUnits,
            YearMonth month) {
        LocalDate monthEnd = month.atEndOfMonth();
        return rentableUnits.stream()
                .filter(unit -> unit.getCreatedAt() != null
                        && !unit.getCreatedAt().toLocalDate().isAfter(monthEnd))
                .toList();
    }

    private BigDecimal occupancyRate(
            Property property,
            boolean directRental,
            YearMonth month,
            List<RentalAgreement> agreements,
            Set<Long> unitIdsInMonth,
            int rentableUnitCount,
            Set<Long> rentableUnitIds) {
        LocalDate monthStart = month.atDay(1);
        LocalDate monthEnd = month.atEndOfMonth();
        if (directRental) {
            boolean occupied = agreements.stream()
                    .anyMatch(agreement ->
                            agreement.getUnit() == null
                                    && agreement.getProperty() != null
                                    && Objects.equals(
                                            agreement.getProperty().getPropertyId(),
                                            property.getPropertyId())
                                    && coversMonth(
                                            agreement, monthStart, monthEnd));
            return occupied ? ONE : ZERO;
        }
        if (rentableUnitCount == 0) {
            return ZERO;
        }

        Set<Long> occupiedUnitIds = new HashSet<>();
        for (RentalAgreement agreement : agreements) {
            Unit unit = agreement.getUnit();
            if (unit != null
                    && rentableUnitIds.contains(unit.getUnitId())
                    && unitIdsInMonth.contains(unit.getUnitId())
                    && coversMonth(agreement, monthStart, monthEnd)) {
                occupiedUnitIds.add(unit.getUnitId());
            }
        }
        return BigDecimal.valueOf(occupiedUnitIds.size())
                .divide(BigDecimal.valueOf(rentableUnitCount),
                        MathContext.DECIMAL128);
    }

    private boolean coversMonth(
            RentalAgreement agreement,
            LocalDate monthStart,
            LocalDate monthEnd) {
        if (agreement.getStatus() == null
                || agreement.getStatus() == AgreementStatus.DRAFT
                || agreement.getStartDate() == null
                || agreement.getEndDate() == null) {
            return false;
        }
        LocalDate endDate = agreement.getEndDate();
        if (agreement.getMoveOutDate() != null
                && agreement.getMoveOutDate().isBefore(endDate)) {
            endDate = agreement.getMoveOutDate();
        }
        return !agreement.getStartDate().isAfter(monthEnd)
                && !endDate.isBefore(monthStart);
    }

    private M6ProfitabilityRequest createRequest(
            String city,
            BigDecimal sizeSqft,
            BigDecimal bedroomsBhk,
            int yearBuilt,
            List<MonthlyValues> history) {
        MonthlyValues current = history.get(history.size() - 1);
        List<M6ProfitabilityRequest.MonthlyFinancialRecord> monthlyHistory =
                history.subList(
                                Math.max(0, history.size() - HISTORY_MONTHS),
                                history.size() - 1)
                        .stream()
                        .map(month -> new M6ProfitabilityRequest.MonthlyFinancialRecord(
                                month.month().atDay(1),
                                asDouble(month.monthlyRent()),
                                asDouble(month.collectedRent()),
                                asDouble(month.expenseAmount()),
                                asDouble(month.occupancyRate())))
                        .toList();

        return new M6ProfitabilityRequest(
                city,
                sizeSqft.doubleValue(),
                bedroomsBhk.doubleValue(),
                Math.max(0, current.month().getYear() - yearBuilt) * 1.0,
                current.month().atDay(1),
                asDouble(current.monthlyRent()),
                asDouble(current.collectedRent()),
                asDouble(current.expenseAmount()),
                asDouble(current.occupancyRate()),
                monthlyHistory);
    }

    private Map<YearMonth, BigDecimal> initializeMonthlyAmounts(
            List<YearMonth> months) {
        Map<YearMonth, BigDecimal> amounts = new HashMap<>();
        for (YearMonth month : months) {
            amounts.put(month, ZERO);
        }
        return amounts;
    }

    private BigDecimal nonNegativeArea(double value, String field) {
        if (!Double.isFinite(value) || value < 0) {
            throw invalidData(field + " must be a valid non-negative value");
        }
        return BigDecimal.valueOf(value);
    }

    private BigDecimal requireNonNegative(BigDecimal value, String field) {
        if (value == null || value.signum() < 0) {
            throw invalidData(field + " must be present and non-negative");
        }
        return value;
    }

    private double asDouble(BigDecimal value) {
        return value.doubleValue();
    }

    private ResponseStatusException invalidData(String message) {
        return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, message);
    }

    private record MonthlyValues(
            YearMonth month,
            BigDecimal monthlyRent,
            BigDecimal collectedRent,
            BigDecimal expenseAmount,
            BigDecimal occupancyRate) {
    }
}
