package com.rental.rental_management_backend.ai.service.impl;

import java.math.BigDecimal;
import java.time.Year;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.rental.rental_management_backend.ai.client.FastApiRentPredictionClient;
import com.rental.rental_management_backend.ai.dto.RentPredictionPreviewRequestDTO;
import com.rental.rental_management_backend.ai.dto.RentPredictionRequestDTO;
import com.rental.rental_management_backend.ai.dto.RentPredictionResponseDTO;
import com.rental.rental_management_backend.ai.service.RentPredictionService;
import com.rental.rental_management_backend.property.entity.Amenity;
import com.rental.rental_management_backend.property.entity.Building;
import com.rental.rental_management_backend.property.entity.Floor;
import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.entity.PropertyAddress;
import com.rental.rental_management_backend.property.entity.PropertyAmenity;
import com.rental.rental_management_backend.property.enums.AreaType;
import com.rental.rental_management_backend.property.enums.FurnishingStatus;
import com.rental.rental_management_backend.property.enums.PropertyType;
import com.rental.rental_management_backend.property.repository.FloorRepository;
import com.rental.rental_management_backend.property.repository.PropertyAddressRepository;
import com.rental.rental_management_backend.property.repository.PropertyAmenityRepository;

@Service
@Transactional(readOnly = true)
public class RentPredictionServiceImpl implements RentPredictionService {

    private final FloorRepository floorRepository;

    private final PropertyAddressRepository propertyAddressRepository;

    private final PropertyAmenityRepository propertyAmenityRepository;

    private final FastApiRentPredictionClient fastApiRentPredictionClient;

    public RentPredictionServiceImpl(
            FloorRepository floorRepository,
            PropertyAddressRepository propertyAddressRepository,
            PropertyAmenityRepository propertyAmenityRepository,
            FastApiRentPredictionClient fastApiRentPredictionClient) {

        this.floorRepository = floorRepository;
        this.propertyAddressRepository = propertyAddressRepository;
        this.propertyAmenityRepository = propertyAmenityRepository;
        this.fastApiRentPredictionClient = fastApiRentPredictionClient;
    }

    @Override
    public RentPredictionResponseDTO predictRent(
            RentPredictionPreviewRequestDTO previewRequest) {

        // ---------------------------------------------------------
        // 1. Validate request
        // ---------------------------------------------------------

        if (previewRequest == null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Rent prediction request is required");
        }

        if (previewRequest.getFloorId() == null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Floor ID is required for rent prediction");
        }

        if (previewRequest.getArea() == null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Unit area is required for rent prediction");
        }

        if (previewRequest.getBedrooms() == null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Unit bedrooms are required for rent prediction");
        }

        if (previewRequest.getBathrooms() == null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Unit bathrooms are required for rent prediction");
        }

        // ---------------------------------------------------------
        // 2. Load Floor
        // ---------------------------------------------------------

        Floor floor = floorRepository
                .findById(previewRequest.getFloorId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Floor not found with id: "
                                + previewRequest.getFloorId()));

        // ---------------------------------------------------------
        // 3. Load Building
        // ---------------------------------------------------------

        if (floor.getBuilding() == null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Floor is not associated with a building");
        }

        Building building = floor.getBuilding();

        // ---------------------------------------------------------
        // 4. Load Property
        // ---------------------------------------------------------

        if (building.getProperty() == null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Building is not associated with a property");
        }

        Property property = building.getProperty();

        // ---------------------------------------------------------
        // 5. Load Property Address
        // ---------------------------------------------------------

        PropertyAddress address =
                propertyAddressRepository
                        .findByProperty(property)
                        .orElseThrow(() -> new ResponseStatusException(
                                HttpStatus.BAD_REQUEST,
                                "Property address is required for rent prediction"));

        // ---------------------------------------------------------
        // 6. Validate existing data
        // ---------------------------------------------------------

        validateRequiredData(
                previewRequest,
                floor,
                building,
                property,
                address);

        // ---------------------------------------------------------
        // 7. Load Property Amenities
        // ---------------------------------------------------------

        List<PropertyAmenity> propertyAmenities =
                propertyAmenityRepository.findByProperty(property);

        // ---------------------------------------------------------
        // 8. Build 23-field M1 request
        // ---------------------------------------------------------

        RentPredictionRequestDTO request =
                buildPredictionRequest(
                        previewRequest,
                        floor,
                        building,
                        property,
                        address,
                        propertyAmenities);

        // ---------------------------------------------------------
        // 9. Call FastAPI
        // ---------------------------------------------------------

        Map<String, Object> modelResponse;

        try {

            modelResponse =
                    fastApiRentPredictionClient.predictRent(request);

        } catch (Exception e) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Failed to get rent prediction from FastAPI service",
                    e);
        }

        // ---------------------------------------------------------
        // 10. Extract predicted rent
        // ---------------------------------------------------------

        BigDecimal predictedRent =
                extractPredictedRent(modelResponse);

        // ---------------------------------------------------------
        // 11. Build response
        // ---------------------------------------------------------

        RentPredictionResponseDTO response =
                new RentPredictionResponseDTO();

        response.setPredictedRent(predictedRent);

        return response;
    }

    /**
     * Builds the exact 23-field request expected by M1 FastAPI.
     *
     * Unit-specific values come from the UNSAVED Unit form.
     * Property-related values come from the existing database.
     */
    private RentPredictionRequestDTO buildPredictionRequest(
            RentPredictionPreviewRequestDTO previewRequest,
            Floor floor,
            Building building,
            Property property,
            PropertyAddress address,
            List<PropertyAmenity> propertyAmenities) {

        Integer propertyAgeYears =
                calculatePropertyAge(property.getYearBuilt());

        int amenityCount =
                propertyAmenities == null
                        ? 0
                        : propertyAmenities.size();

        RentPredictionRequestDTO request =
                new RentPredictionRequestDTO();

        // 1. city
        request.setCity(
                address.getCity());

        // 2. area_locality
        request.setArea_locality(
                address.getArea());

        // 3. area_type
        request.setArea_type(
                mapAreaTypeForM1(
                        address.getAreaType()));

        // 4. size_sqft
        request.setSize_sqft(
                previewRequest.getArea());

        // 5. bedrooms_bhk
        request.setBedrooms_bhk(
                previewRequest.getBedrooms());

        // 6. bathrooms
        request.setBathrooms(
                previewRequest.getBathrooms());

        // 7. floor
        request.setFloor(
                floor.getFloorNumber());

        // 8. total_floors
        request.setTotal_floors(
                building.getTotalFloors());

        // 9. furnishing_status
        request.setFurnishing_status(
                mapFurnishingStatusForM1(
                        property.getFurnishingStatus()));

        // 10. parking_available
        request.setParking_available(
                property.getParkingAvailable());

        // 11. property_age_years
        request.setProperty_age_years(
                propertyAgeYears);

        // 12. amenity_count
        request.setAmenity_count(
                amenityCount);

        // 13. amenity_parking
        request.setAmenity_parking(
                hasAmenity(
                        propertyAmenities,
                        "parking"));

        // 14. amenity_lift
        request.setAmenity_lift(
                hasAmenity(
                        propertyAmenities,
                        "lift"));

        // 15. amenity_gym
        request.setAmenity_gym(
                hasAmenity(
                        propertyAmenities,
                        "gym"));

        // 16. amenity_security
        request.setAmenity_security(
                hasAmenity(
                        propertyAmenities,
                        "security"));

        // 17. amenity_power_backup
        request.setAmenity_power_backup(
                hasAmenity(
                        propertyAmenities,
                        "power backup")
                        || hasAmenity(
                                propertyAmenities,
                                "powerbackup")
                        || hasAmenity(
                                propertyAmenities,
                                "generator"));

        // 18. amenity_air_conditioning
        request.setAmenity_air_conditioning(
                hasAmenity(
                        propertyAmenities,
                        "air conditioning")
                        || hasAmenity(
                                propertyAmenities,
                                "air-conditioning")
                        || hasAmenity(
                                propertyAmenities,
                                "ac"));

        // 19. amenity_wifi
        request.setAmenity_wifi(
                hasAmenity(
                        propertyAmenities,
                        "wifi")
                        || hasAmenity(
                                propertyAmenities,
                                "wi-fi")
                        || hasAmenity(
                                propertyAmenities,
                                "internet"));

        // 20. amenity_garden
        request.setAmenity_garden(
                hasAmenity(
                        propertyAmenities,
                        "garden")
                        || hasAmenity(
                                propertyAmenities,
                                "park"));

        // 21. latitude
        request.setLatitude(
                address.getLatitude().doubleValue());

        // 22. longitude
        request.setLongitude(
                address.getLongitude().doubleValue());

        // 23. property_type
        request.setProperty_type(
                mapPropertyTypeForM1(
                        property.getPropertyType()));

        return request;
    }

    /**
     * Maps backend AreaType to M1 values.
     */
    private String mapAreaTypeForM1(
            AreaType areaType) {

        if (areaType == null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Property area type is required for rent prediction");
        }

        return switch (areaType) {

            case SUPER_BUILT_UP_AREA ->
                    "Super Area";

            case BUILT_UP_AREA ->
                    "Built Area";

            case CARPET_AREA ->
                    "Carpet Area";

            case PLOT_AREA ->
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "PLOT_AREA is not supported by the M1 rent prediction model");
        };
    }

    /**
     * Maps backend FurnishingStatus to M1 values.
     */
    private String mapFurnishingStatusForM1(
            FurnishingStatus furnishingStatus) {

        if (furnishingStatus == null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Property furnishingStatus is required for rent prediction");
        }

        return switch (furnishingStatus) {

            case UNFURNISHED ->
                    "Unfurnished";

            case SEMI_FURNISHED ->
                    "Semi-Furnished";

            case FULLY_FURNISHED ->
                    "Furnished";
        };
    }

    /**
     * Maps backend PropertyType to M1 values.
     */
    private String mapPropertyTypeForM1(
            PropertyType propertyType) {

        if (propertyType == null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Property type is required for rent prediction");
        }

        return switch (propertyType) {

            case APARTMENT ->
                    "APARTMENT";

            case HOUSE ->
                    "HOUSE";

            case PG ->
                    "PG";

            case VILLA ->
                    "VILLA";

            case HOSTEL ->
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "HOSTEL is not supported by the M1 rent prediction model");

            case COMMERCIAL ->
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "COMMERCIAL is not supported by the M1 rent prediction model");
        };
    }

    /**
     * Calculates current property age.
     */
    private Integer calculatePropertyAge(
            Integer yearBuilt) {

        if (yearBuilt == null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Property yearBuilt is required for rent prediction");
        }

        int currentYear =
                Year.now().getValue();

        int age =
                currentYear - yearBuilt;

        if (age < 0) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Property yearBuilt cannot be greater than the current year");
        }

        return age;
    }

    /**
     * Checks whether the property has an amenity.
     */
    private boolean hasAmenity(
            List<PropertyAmenity> propertyAmenities,
            String keyword) {

        if (propertyAmenities == null
                || propertyAmenities.isEmpty()) {

            return false;
        }

        String normalizedKeyword =
                normalize(keyword);

        for (PropertyAmenity propertyAmenity :
                propertyAmenities) {

            if (propertyAmenity == null
                    || propertyAmenity.getAmenity() == null) {

                continue;
            }

            Amenity amenity =
                    propertyAmenity.getAmenity();

            if (amenity.getAmenityName() == null) {

                continue;
            }

            String amenityName =
                    normalize(
                            amenity.getAmenityName());

            if (amenityName.contains(
                    normalizedKeyword)) {

                return true;
            }
        }

        return false;
    }

    private String normalize(
            String value) {

        if (value == null) {
            return "";
        }

        return value
                .toLowerCase(Locale.ROOT)
                .replace("-", " ")
                .replace("_", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    /**
     * Validates all data required to construct
     * the 23-field M1 request.
     */
    private void validateRequiredData(
            RentPredictionPreviewRequestDTO previewRequest,
            Floor floor,
            Building building,
            Property property,
            PropertyAddress address) {

        // 1. city
        if (address.getCity() == null
                || address.getCity().isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Property city is required for rent prediction");
        }

        // 2. area_locality
        if (address.getArea() == null
                || address.getArea().isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Property area/locality is required for rent prediction");
        }

        // 3. area_type
        if (address.getAreaType() == null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Property area type is required for rent prediction");
        }

        if (address.getAreaType()
                == AreaType.PLOT_AREA) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "PLOT_AREA is not supported by the M1 rent prediction model");
        }

        // 4. size_sqft
        if (previewRequest.getArea() == null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Unit area is required for rent prediction");
        }

        // 5. bedrooms_bhk
        if (previewRequest.getBedrooms() == null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Unit bedrooms are required for rent prediction");
        }

        // 6. bathrooms
        if (previewRequest.getBathrooms() == null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Unit bathrooms are required for rent prediction");
        }

        // 7. floor
        if (floor.getFloorNumber() == null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Floor number is required for rent prediction");
        }

        // 8. total_floors
        if (building.getTotalFloors() == null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Building totalFloors is required for rent prediction");
        }

        // 9. furnishing_status
        if (property.getFurnishingStatus() == null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Property furnishingStatus is required for rent prediction");
        }

        // 10. parking_available
        if (property.getParkingAvailable() == null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Property parkingAvailable is required for rent prediction");
        }

        // 11. property_age_years
        if (property.getYearBuilt() == null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Property yearBuilt is required for rent prediction");
        }

        // 21. latitude
        if (address.getLatitude() == null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Property latitude is required for rent prediction");
        }

        // 22. longitude
        if (address.getLongitude() == null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Property longitude is required for rent prediction");
        }

        // 23. property_type
        if (property.getPropertyType() == null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Property type is required for rent prediction");
        }

        if (property.getPropertyType()
                == PropertyType.HOSTEL) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "HOSTEL is not supported by the M1 rent prediction model");
        }

        if (property.getPropertyType()
                == PropertyType.COMMERCIAL) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "COMMERCIAL is not supported by the M1 rent prediction model");
        }
    }

    /**
     * Reads predictedRent from FastAPI response.
     */
    private BigDecimal extractPredictedRent(
            Map<String, Object> modelResponse) {

        if (modelResponse == null
                || modelResponse.isEmpty()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "FastAPI rent prediction service returned an empty response");
        }

        Object value =
                modelResponse.get("predictedRent");

        if (value == null) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "FastAPI response does not contain 'predictedRent'");
        }

        try {

            if (value instanceof Number number) {

                return BigDecimal.valueOf(
                        number.doubleValue());
            }

            return new BigDecimal(
                    value.toString());

        } catch (NumberFormatException e) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "Invalid predictedRent returned by FastAPI",
                    e);
        }
    }
}