package com.rental.rental_management_backend.maintenance.service;

import java.lang.reflect.Method;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.rental.rental_management_backend.maintenance.dto.M5PredictionRequest;
import com.rental.rental_management_backend.maintenance.enums.MaintenanceStatus;
import com.rental.rental_management_backend.maintenance.repository.EquipmentInstallationDateProjection;
import com.rental.rental_management_backend.maintenance.repository.EquipmentRepository;
import com.rental.rental_management_backend.maintenance.repository.InspectionRepository;
import com.rental.rental_management_backend.maintenance.repository.MaintenanceHistoryProjection;
import com.rental.rental_management_backend.maintenance.repository.MaintenanceRequestRepository;
import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.entity.Unit;
import com.rental.rental_management_backend.property.repository.PropertyAmenityRepository;

@Service
public class M5AggregationService {

    private final MaintenanceRequestRepository maintenanceRepo;
    private final EquipmentRepository equipmentRepo;
    private final InspectionRepository inspectionRepo;
    private final PropertyAmenityRepository propertyAmenityRepo;

    @Autowired
    public M5AggregationService(
            MaintenanceRequestRepository maintenanceRepo,
            EquipmentRepository equipmentRepo,
            InspectionRepository inspectionRepo,
            PropertyAmenityRepository propertyAmenityRepo) {

        this.maintenanceRepo = maintenanceRepo;
        this.equipmentRepo = equipmentRepo;
        this.inspectionRepo = inspectionRepo;
        this.propertyAmenityRepo = propertyAmenityRepo;
    }

    public M5PredictionRequest aggregate(Property property, Unit unit) {

        int currentYear = LocalDate.now().getYear();

        Long propertyId = (property != null && property.getPropertyId() != null)
                ? property.getPropertyId()
                : 0L;

        // 1. property_age_years
        double propertyAge = 0.0;

        if (property != null && property.getYearBuilt() != null) {
            propertyAge = (double) (currentYear - property.getYearBuilt());
        }

        // 2. size_sqft
        double sizeSqft = 0.0;

        if (unit != null) {
            Double unitArea = extractDouble(
                    unit,
                    "getAreaSqft",
                    "getArea",
                    "getSizeSqft"
            );

            if (unitArea != null) {
                sizeSqft = unitArea;
            }
        }

        if (sizeSqft == 0.0
                && property != null
                && property.getTotalArea() != null) {

            sizeSqft = ((Number) property.getTotalArea()).doubleValue();
        }

        // 3. bedrooms_bhk
        Integer bedroomsBhk = null;

        if (unit != null) {
            Integer bhk = extractInteger(
                    unit,
                    "getBedrooms",
                    "getBedroomsBhk",
                    "getBhk"
            );

            if (bhk != null) {
                bedroomsBhk = bhk;
            }
        }

        if (bedroomsBhk == null && property != null && property.getBedrooms() != null) {
            bedroomsBhk = property.getBedrooms();
        }

        if (bedroomsBhk == null) {
            bedroomsBhk = 1;
        }

        // 4. amenity_count
        // Count ONLY amenities belonging to this property.
        int amenityCount = 0;

        if (property != null && property.getPropertyId() != null) {

            List<?> propertyAmenities =
                    propertyAmenityRepo.findByProperty(property);

            if (propertyAmenities != null) {
                amenityCount = propertyAmenities.size();
            }
        }

        // 5. Fetch maintenance history
        // Always use property-scoped maintenance data for M5.
        List<MaintenanceHistoryProjection> requests;

        if (propertyId > 0) {
            requests =
                    maintenanceRepo.findHistoryValuesByPropertyId(propertyId);
        } else {
            requests = List.of();
        }

        // 6. historical_maintenance_count
        int histCount = (requests != null)
                ? requests.size()
                : 0;

        // 7. maintenance_count_last_90d
        LocalDateTime ninetyDaysAgo =
                LocalDateTime.now().minusDays(90);

        int countLast90d = 0;

        if (requests != null) {
            countLast90d = (int) requests.stream()
                    .filter(r -> r.getRequestedDate() != null
                            && r.getRequestedDate().isAfter(ninetyDaysAgo))
                    .count();
        }

        // 8. historical_maintenance_cost
        double totalCost = 0.0;

        if (requests != null) {
            totalCost = requests.stream()
                    .filter(r -> r.getCost() != null)
                    .mapToDouble(r -> r.getCost().doubleValue())
                    .sum();
        }

        // 9. historical_avg_cost
        double avgCost =
                histCount > 0
                        ? (totalCost / histCount)
                        : 0.0;

        // 10. days_since_last_maintenance
        int daysSinceLast = 365;

        if (requests != null) {

            Optional<LocalDateTime> lastCompleted =
                    requests.stream()
                            .filter(r -> r.getStatus() == MaintenanceStatus.COMPLETED
                                    && r.getCompletedDate() != null)
                            .map(MaintenanceHistoryProjection::getCompletedDate)
                            .max(LocalDateTime::compareTo);

            if (lastCompleted.isPresent()) {

                daysSinceLast =
                        (int) ChronoUnit.DAYS.between(
                                lastCompleted.get().toLocalDate(),
                                LocalDate.now()
                        );
            }
        }

        // 11. dominant_issue_category
        String dominantCategory = "OTHER";

        if (requests != null && !requests.isEmpty()) {

            dominantCategory = requests.stream()
                    .filter(r -> r.getCategory() != null)
                    .collect(
                            Collectors.groupingBy(
                                    r -> r.getCategory().name(),
                                    Collectors.counting()
                            )
                    )
                    .entrySet()
                    .stream()
                    .max(Map.Entry.comparingByValue())
                    .map(Map.Entry::getKey)
                    .orElse("OTHER");
        }

        // 12. inspection_count
        int inspectionCount =
                (int) inspectionRepo
                        .countByProperty_PropertyId(propertyId);

        // 13. needs_attention_count
        int eqAttention =
                (int) equipmentRepo
                        .countByProperty_PropertyIdAndNeedsAttentionTrue(
                                propertyId
                        );

        int inspAttention =
                (int) inspectionRepo
                        .countByProperty_PropertyIdAndHasIssuesRequiringAttentionTrue(
                                propertyId
                        );

        int needsAttentionCount =
                eqAttention + inspAttention;

        // 14. equipment_count
        List<EquipmentInstallationDateProjection> equipmentList =
                equipmentRepo.findInstallationDatesByPropertyId(propertyId);

        int equipmentCount =
                (equipmentList != null)
                        ? equipmentList.size()
                        : 0;

        // 15. avg_equipment_age_years
        double avgEquipmentAge = propertyAge;

        if (equipmentList != null
                && !equipmentList.isEmpty()) {

            avgEquipmentAge = equipmentList.stream()
                    .filter(e -> e.getInstallationDate() != null)
                    .mapToDouble(e ->
                            ChronoUnit.DAYS.between(
                                    e.getInstallationDate(),
                                    LocalDate.now()
                            ) / 365.25
                    )
                    .average()
                    .orElse(propertyAge);
        }

        // 16. critical_equipment_count
        int criticalEquipmentCount =
                (int) equipmentRepo
                        .countByProperty_PropertyIdAndIsCriticalTrue(
                                propertyId
                        );

        // 17. snapshot_month
        String snapshotMonth =
                YearMonth.now().toString();

        // Populate M5PredictionRequest
        M5PredictionRequest request =
                new M5PredictionRequest();

        request.setPropertyAgeYears(propertyAge);
        request.setSizeSqft(sizeSqft);
        request.setBedroomsBhk(bedroomsBhk);
        request.setAmenityCount(amenityCount);
        request.setHistoricalMaintenanceCount(histCount);
        request.setMaintenanceCountLast90d(countLast90d);
        request.setHistoricalMaintenanceCost(totalCost);
        request.setHistoricalAvgCost(avgCost);
        request.setDaysSinceLastMaintenance(daysSinceLast);
        request.setDominantIssueCategory(dominantCategory);
        request.setInspectionCount(inspectionCount);
        request.setNeedsAttentionCount(needsAttentionCount);
        request.setEquipmentCount(equipmentCount);
        request.setAvgEquipmentAgeYears(avgEquipmentAge);
        request.setCriticalEquipmentCount(criticalEquipmentCount);
        request.setSnapshotMonth(snapshotMonth);

        return request;
    }

    private Long extractLong(
            Object target,
            String... methodNames) {

        for (String mName : methodNames) {

            try {

                Method method =
                        target.getClass().getMethod(mName);

                Object val =
                        method.invoke(target);

                if (val != null) {
                    return ((Number) val).longValue();
                }

            } catch (Exception ignored) {
            }
        }

        return null;
    }

    private Double extractDouble(
            Object target,
            String... methodNames) {

        for (String mName : methodNames) {

            try {

                Method method =
                        target.getClass().getMethod(mName);

                Object val =
                        method.invoke(target);

                if (val != null) {
                    return ((Number) val).doubleValue();
                }

            } catch (Exception ignored) {
            }
        }

        return null;
    }

    private Integer extractInteger(
            Object target,
            String... methodNames) {

        for (String mName : methodNames) {

            try {

                Method method =
                        target.getClass().getMethod(mName);

                Object val =
                        method.invoke(target);

                if (val != null) {
                    return ((Number) val).intValue();
                }

            } catch (Exception ignored) {
            }
        }

        return null;
    }
}
