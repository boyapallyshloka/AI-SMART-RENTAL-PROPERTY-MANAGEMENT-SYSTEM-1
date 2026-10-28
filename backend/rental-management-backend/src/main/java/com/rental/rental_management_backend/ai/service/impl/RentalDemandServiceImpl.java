package com.rental.rental_management_backend.ai.service.impl;

import java.math.BigDecimal;
import java.math.MathContext;
import java.time.LocalDate;
import java.time.YearMonth;

import org.springframework.stereotype.Service;

import com.rental.rental_management_backend.ai.client.FastApiRentalDemandClient;
import com.rental.rental_management_backend.ai.dto.RentalDemandPreviewRequestDTO;
import com.rental.rental_management_backend.ai.dto.RentalDemandRequestDTO;
import com.rental.rental_management_backend.ai.dto.RentalDemandResponseDTO;
import com.rental.rental_management_backend.ai.service.RentalDemandService;
import com.rental.rental_management_backend.property.enums.PropertyStatus;
import com.rental.rental_management_backend.property.enums.UnitStatus;
import com.rental.rental_management_backend.property.repository.PropertyRepository;
import com.rental.rental_management_backend.property.repository.UnitRepository;
import com.rental.rental_management_backend.rental.repository.RentalAgreementRepository;
import com.rental.rental_management_backend.rental.repository.RentalApplicationRepository;

@Service
public class RentalDemandServiceImpl implements RentalDemandService {

    private final UnitRepository unitRepository;

    private final PropertyRepository propertyRepository;

    private final RentalApplicationRepository rentalApplicationRepository;

    private final RentalAgreementRepository rentalAgreementRepository;

    private final FastApiRentalDemandClient fastApiRentalDemandClient;

    public RentalDemandServiceImpl(
            UnitRepository unitRepository,
            PropertyRepository propertyRepository,
            RentalApplicationRepository rentalApplicationRepository,
            RentalAgreementRepository rentalAgreementRepository,
            FastApiRentalDemandClient fastApiRentalDemandClient) {

        this.unitRepository = unitRepository;

        this.propertyRepository = propertyRepository;

        this.rentalApplicationRepository = rentalApplicationRepository;

        this.rentalAgreementRepository = rentalAgreementRepository;

        this.fastApiRentalDemandClient = fastApiRentalDemandClient;
    }

    @Override
    public RentalDemandResponseDTO predictRentalDemand(
            RentalDemandPreviewRequestDTO request) {

        String city = request.getCity().trim();

        String area = request.getArea().trim();

        Integer month = request.getMonth();

        long apartmentUnitCount =
                unitRepository.countUnitsForRentalDemand(
                        city,
                        area);

        long occupiedApartmentUnitCount =
                unitRepository.countUnitsByStatusForRentalDemand(
                        city,
                        area,
                        UnitStatus.OCCUPIED);

        long vacantApartmentUnitCount =
                unitRepository.countUnitsByStatusForRentalDemand(
                        city,
                        area,
                        UnitStatus.VACANT);

        long houseVillaPropertyCount =
                propertyRepository.countDirectRentalPropertiesForRentalDemand(
                        city,
                        area);

        long occupiedHouseVillaPropertyCount =
                propertyRepository.countDirectRentalPropertiesByStatusForRentalDemand(
                        city,
                        area,
                        PropertyStatus.OCCUPIED);

        long availableHouseVillaPropertyCount =
                propertyRepository.countDirectRentalPropertiesByStatusForRentalDemand(
                        city,
                        area,
                        PropertyStatus.AVAILABLE);

        long propertyCount =
                apartmentUnitCount + houseVillaPropertyCount;

        long occupiedRentalCount =
                occupiedApartmentUnitCount
                        + occupiedHouseVillaPropertyCount;

        long availableRentalCount =
                vacantApartmentUnitCount
                        + availableHouseVillaPropertyCount;

        long apartmentPricedCount =
                unitRepository.countPricedUnitsForRentalDemand(
                        city,
                        area);

        long houseVillaPricedCount =
                propertyRepository.countPricedDirectRentalPropertiesForRentalDemand(
                        city,
                        area);

        BigDecimal apartmentAverageRent =
                unitRepository.averageMonthlyRentForRentalDemand(
                        city,
                        area);

        BigDecimal houseVillaAverageRent =
                propertyRepository.averageDirectRentalMonthlyRentForRentalDemand(
                        city,
                        area);

        long pricedRentalCount =
                apartmentPricedCount + houseVillaPricedCount;

        BigDecimal averageRent = null;
        if (pricedRentalCount > 0) {
            BigDecimal weightedRentTotal =
                    BigDecimal.ZERO;

            if (apartmentAverageRent != null) {
                weightedRentTotal = weightedRentTotal.add(
                        apartmentAverageRent.multiply(
                                BigDecimal.valueOf(apartmentPricedCount)));
            }

            if (houseVillaAverageRent != null) {
                weightedRentTotal = weightedRentTotal.add(
                        houseVillaAverageRent.multiply(
                                BigDecimal.valueOf(houseVillaPricedCount)));
            }

            averageRent = weightedRentTotal.divide(
                    BigDecimal.valueOf(pricedRentalCount),
                    MathContext.DECIMAL64);
        }

        /*
         * M3 predicts next month's demand.
         *
         * Therefore, the requested month is treated as the
         * current observation month.
         */

        int currentYear = request.getYear();

        YearMonth currentYearMonth =
                YearMonth.of(currentYear, month);

        /*
         * Current month's statistics.
         */

        LocalDate currentStartDate =
                currentYearMonth.atDay(1);

        LocalDate currentEndDate =
                currentYearMonth
                        .plusMonths(1)
                        .atDay(1);

        long applicationCount =
                rentalApplicationRepository
                        .countApplicationsForRentalDemand(
                                city,
                                area,
                                currentStartDate,
                                currentEndDate);

        long agreementStartCount =
                rentalAgreementRepository
                        .countAgreementStartsForRentalDemand(
                                city,
                                area,
                                currentStartDate,
                                currentEndDate);

        /*
         * ---------------------------------------------------------
         * M3 Historical Demand Features
         * ---------------------------------------------------------
         *
         * Demand = application_count.
         *
         * demand_lag_1_month:
         * Previous calendar month's application_count.
         *
         * demand_lag_2_month:
         * Two calendar months before the current observation month.
         */

        /*
         * 1. demand_lag_1_month
         *
         * Previous calendar month.
         *
         * Examples:
         * October 2026 -> September 2026
         * January 2027 -> December 2026
         */

        YearMonth lag1YearMonth =
                currentYearMonth.minusMonths(1);

        long demandLag1Month =
                getApplicationCountForMonth(
                        city,
                        area,
                        lag1YearMonth);

        /*
         * 2. demand_lag_2_month
         *
         * Two calendar months before the current observation month.
         *
         * Examples:
         * September 2026 -> July 2026
         * January 2027 -> November 2026
         * February 2027 -> December 2026
         *
         * Year changes automatically when crossing January.
         */

        YearMonth lag2YearMonth =
                currentYearMonth.minusMonths(2);

        long demandLag2Month =
                getApplicationCountForMonth(
                        city,
                        area,
                        lag2YearMonth);

        /*
         * 3. demand_growth_1_month
         *
         * If lag1 == 0 and current == 0:
         *     growth = 0.0
         *
         * If lag1 == 0 and current > 0:
         *     growth = current
         *
         * If lag1 > 0:
         *     growth = (current - lag1) / lag1
         *
         * Result is rounded to 4 decimal places.
         */

        double demandGrowth1Month;

        if (demandLag1Month == 0) {

            if (applicationCount == 0) {

                demandGrowth1Month = 0.0;

            } else {

                demandGrowth1Month =
                        (double) applicationCount;
            }

        } else {

            double rawGrowth =
                    (double) (applicationCount - demandLag1Month)
                            / demandLag1Month;

            demandGrowth1Month =
                    Math.round(rawGrowth * 10000.0)
                            / 10000.0;
        }

        /*
         * Occupancy and vacancy rates.
         */

        double occupancyRate = 0.0;

        if (propertyCount > 0) {

            occupancyRate =
                    ((double) occupiedRentalCount / propertyCount)
                            * 100.0;
        }

        double vacancyRate = 0.0;

        if (propertyCount > 0) {

            vacancyRate =
                    ((double) availableRentalCount / propertyCount)
                            * 100.0;
        }

        /*
         * Build FastAPI M3 request.
         */

        RentalDemandRequestDTO fastApiRequest =
                new RentalDemandRequestDTO();

        fastApiRequest.setCity(city);

        fastApiRequest.setAreaLocality(area);

        fastApiRequest.setYear(currentYear);

        fastApiRequest.setMonth(month);
        fastApiRequest.setYear(request.getYear());

        fastApiRequest.setPropertyCount(
                (int) propertyCount);

        fastApiRequest.setApplicationCount(
                (int) applicationCount);

        fastApiRequest.setAgreementStartCount(
                (int) agreementStartCount);

        fastApiRequest.setAverageMonthlyRent(
                averageRent != null
                        ? averageRent.doubleValue()
                        : 0.0);

        fastApiRequest.setDemandLag1Month(
                (int) demandLag1Month);

        fastApiRequest.setDemandLag2Month(
                (int) demandLag2Month);

        fastApiRequest.setDemandGrowth1Month(
                demandGrowth1Month);

        fastApiRequest.setOccupancyRate(
                occupancyRate);

        fastApiRequest.setVacancyRate(
                vacancyRate);

        fastApiRequest.setAvailableUnitCount(
                (int) availableRentalCount);

        /*
         * Send all 13 M3 features to FastAPI.
         */

        return fastApiRentalDemandClient.predictDemand(
                fastApiRequest);
    }

    /**
     * Gets the tenant application count for a specific
     * city, area and calendar month.
     *
     * In M3, application_count is the demand value.
     */

    private long getApplicationCountForMonth(
            String city,
            String area,
            YearMonth yearMonth) {

        LocalDate startDate =
                yearMonth.atDay(1);

        LocalDate endDate =
                yearMonth
                        .plusMonths(1)
                        .atDay(1);

        return rentalApplicationRepository
                .countApplicationsForRentalDemand(
                        city,
                        area,
                        startDate,
                        endDate);
    }
}