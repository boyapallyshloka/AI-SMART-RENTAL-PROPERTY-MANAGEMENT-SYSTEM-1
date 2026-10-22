package com.rental.rental_management_backend.property.serviceimpl;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Autowired;

import com.rental.rental_management_backend.exception.ResourceNotFoundException;
import com.rental.rental_management_backend.property.dto.AmenityResponse;
import com.rental.rental_management_backend.property.dto.BuildingDetailsResponse;
import com.rental.rental_management_backend.property.dto.BuildingResponse;
import com.rental.rental_management_backend.property.dto.FloorDetailsResponse;
import com.rental.rental_management_backend.property.dto.FloorResponse;
import com.rental.rental_management_backend.property.dto.PropertyAddressResponse;
import com.rental.rental_management_backend.property.dto.PropertyDetailsResponse;
import com.rental.rental_management_backend.property.dto.PropertyImageResponse;
import com.rental.rental_management_backend.property.dto.PropertyResponse;
import com.rental.rental_management_backend.property.dto.UnitResponse;
import com.rental.rental_management_backend.property.entity.Amenity;
import com.rental.rental_management_backend.property.entity.Building;
import com.rental.rental_management_backend.property.entity.Floor;
import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.entity.PropertyAddress;
import com.rental.rental_management_backend.property.entity.PropertyAmenity;
import com.rental.rental_management_backend.property.entity.PropertyImage;
import com.rental.rental_management_backend.property.entity.Unit;
import com.rental.rental_management_backend.property.enums.PropertyStatus;
import com.rental.rental_management_backend.property.repository.BuildingRepository;
import com.rental.rental_management_backend.property.repository.FloorRepository;
import com.rental.rental_management_backend.property.repository.PropertyAddressRepository;
import com.rental.rental_management_backend.property.repository.PropertyAmenityRepository;
import com.rental.rental_management_backend.property.repository.PropertyImageRepository;
import com.rental.rental_management_backend.property.repository.PropertyRepository;
import com.rental.rental_management_backend.property.repository.UnitRepository;
import com.rental.rental_management_backend.property.service.PropertyDetailsService;
import com.rental.rental_management_backend.property.service.PropertyService;
import com.rental.rental_management_backend.s3.service.S3Service;

@Service
public class PropertyDetailsServiceImpl implements PropertyDetailsService {

    private final PropertyService propertyService;

    private final PropertyRepository propertyRepository;

    private final PropertyAddressRepository propertyAddressRepository;

    private final BuildingRepository buildingRepository;

    private final FloorRepository floorRepository;

    private final UnitRepository unitRepository;

    private final PropertyAmenityRepository propertyAmenityRepository;

    private final PropertyImageRepository propertyImageRepository;

    private final S3Service s3Service;

    @Autowired
    public PropertyDetailsServiceImpl(

            PropertyService propertyService,

            PropertyRepository propertyRepository,

            PropertyAddressRepository propertyAddressRepository,

            BuildingRepository buildingRepository,

            FloorRepository floorRepository,

            UnitRepository unitRepository,

            PropertyAmenityRepository propertyAmenityRepository,

            PropertyImageRepository propertyImageRepository,

            @Autowired(required = false) S3Service s3Service) {

        this.propertyService = propertyService;

        this.propertyRepository = propertyRepository;

        this.propertyAddressRepository = propertyAddressRepository;

        this.buildingRepository = buildingRepository;

        this.floorRepository = floorRepository;

        this.unitRepository = unitRepository;

        this.propertyAmenityRepository = propertyAmenityRepository;

        this.propertyImageRepository = propertyImageRepository;

        this.s3Service = s3Service;

    }

    public PropertyDetailsServiceImpl(

            PropertyService propertyService,

            PropertyRepository propertyRepository,

            PropertyAddressRepository propertyAddressRepository,

            BuildingRepository buildingRepository,

            FloorRepository floorRepository,

            UnitRepository unitRepository,

            PropertyAmenityRepository propertyAmenityRepository,

            PropertyImageRepository propertyImageRepository) {

        this(
                propertyService,
                propertyRepository,
                propertyAddressRepository,
                buildingRepository,
                floorRepository,
                unitRepository,
                propertyAmenityRepository,
                propertyImageRepository,
                null);
    }

    @Override
    @Transactional(readOnly = true)
    public PropertyDetailsResponse getPropertyDetails(Long propertyId) {

        Authentication authentication =
                SecurityContextHolder.getContext().getAuthentication();

        boolean isTenant = authentication != null &&
                authentication.getAuthorities().stream()
                        .anyMatch(a ->
                                a.getAuthority().equals("ROLE_TENANT"));

        if (isTenant) {

            return getPropertyDetailsForTenant(propertyId);
        }

        return getPropertyDetailsForOwner(propertyId);
    }

    @Override
    @Transactional(readOnly = true)
    public PropertyDetailsResponse getPublicPropertyDetails(Long propertyId) {

        return getPropertyDetailsForTenant(propertyId);
    }

    /**
     * OWNER FLOW:
     *
     * Reuses existing owner-scoped sub-services.
     */
    private PropertyDetailsResponse getPropertyDetailsForOwner(Long propertyId) {

        PropertyResponse property =
                propertyService.getMyPropertyById(propertyId);

        Property propertyEntity =
                propertyRepository.getReferenceById(propertyId);

        return buildPropertyDetailsResponse(propertyId, property, propertyEntity);
    }

    /**
     * TENANT FLOW:
     *
     * Exposes full property details only when the property is publicly
     * rentable. PUBLISHED is used by the publication-verification flow,
     * while AVAILABLE remains supported for existing listings.
     */
    private PropertyDetailsResponse getPropertyDetailsForTenant(
            Long propertyId) {

        Property property =
                propertyRepository.findDetailsById(propertyId)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Property not found with ID: "
                                                + propertyId));

        if (property.getStatus() != PropertyStatus.AVAILABLE
                && property.getStatus() != PropertyStatus.PUBLISHED) {

            throw new ResourceNotFoundException(
                    "Property not found or not available for browsing with ID: "
                            + propertyId);
        }

        PropertyResponse propertyResponse =
                convertPropertyToResponse(property);

        return buildPropertyDetailsResponse(
                propertyId,
                propertyResponse,
                property);
    }

    /**
     * MANAGER FLOW:
     *
     * The PropertyManagerService first verifies that the authenticated
     * manager is assigned to the requested property.
     *
     * This method builds the complete property hierarchy using
     * direct repository reads so that owner-only service validation
     * is not triggered.
     */
    @Override
    @Transactional(readOnly = true)
    public PropertyDetailsResponse getPropertyDetailsForManager(
            Long propertyId,
            PropertyResponse property) {

        /*
         * PROPERTY
         */
        Property propertyEntity =
                propertyRepository.findDetailsById(propertyId)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Property not found with ID: "
                                                + propertyId));

        /*
         * ADDRESS
         *
         * Direct repository access.
         * We intentionally do not call PropertyAddressService here
         * because that service is restricted to PROPERTY_OWNER.
         */
        return buildPropertyDetailsResponse(
                propertyId,
                property,
                propertyEntity);
    }

    private PropertyDetailsResponse buildPropertyDetailsResponse(
            Long propertyId,
            PropertyResponse propertyResponse,
            Property property) {

        PropertyAddressResponse address =
                propertyAddressRepository.findByProperty(property)
                        .map(this::convertAddressToResponse)
                        .orElse(null);

        List<BuildingDetailsResponse> buildings =
                buildBuildingDetails(buildingRepository.findByProperty(property));

        List<AmenityResponse> amenities =
                propertyAmenityRepository.findByProperty(property)
                        .stream()
                        .map(PropertyAmenity::getAmenity)
                        .filter(amenity -> amenity != null)
                        .map(this::convertAmenityToResponse)
                        .toList();

        List<PropertyImageResponse> images =
                propertyImageRepository.findByProperty(property)
                        .stream()
                        .map(this::convertImageToResponse)
                        .toList();

        return buildPropertyDetailsResponse(
                propertyId,
                propertyResponse,
                address,
                buildings,
                amenities,
                images);
    }

    private List<BuildingDetailsResponse> buildBuildingDetails(
            List<Building> buildingEntities) {

        if (buildingEntities.isEmpty()) {
            return new ArrayList<>();
        }

        List<Floor> floorEntities =
                floorRepository.findByBuildingIn(buildingEntities);

        Map<Long, List<Floor>> floorsByBuildingId =
                floorEntities.stream().collect(Collectors.groupingBy(
                        floor -> floor.getBuilding().getBuildingId(),
                        HashMap::new,
                        Collectors.toList()));

        List<Unit> unitEntities = floorEntities.isEmpty()
                ? List.of()
                : unitRepository.findByFloorIn(floorEntities);

        Map<Long, List<Unit>> unitsByFloorId =
                unitEntities.stream().collect(Collectors.groupingBy(
                        unit -> unit.getFloor().getFloorId(),
                        HashMap::new,
                        Collectors.toList()));

        List<BuildingDetailsResponse> buildings =
                new ArrayList<>(buildingEntities.size());

        for (Building building : buildingEntities) {
            List<Floor> floors = floorsByBuildingId.getOrDefault(
                    building.getBuildingId(),
                    List.of());

            List<FloorDetailsResponse> floorDetails =
                    new ArrayList<>(floors.size());

            for (Floor floor : floors) {
                List<UnitResponse> units =
                        unitsByFloorId.getOrDefault(
                                        floor.getFloorId(),
                                        List.of())
                                .stream()
                                .map(this::convertUnitToResponse)
                                .toList();

                FloorDetailsResponse response = new FloorDetailsResponse();
                response.setFloor(convertFloorToResponse(floor));
                response.setUnits(units);
                floorDetails.add(response);
            }

            BuildingDetailsResponse response =
                    new BuildingDetailsResponse();
            response.setBuilding(convertBuildingToResponse(building));
            response.setFloors(floorDetails);
            buildings.add(response);
        }

        return buildings;
    }

    /**
     * Common method used to build the final PropertyDetailsResponse.
     */
    private PropertyDetailsResponse buildPropertyDetailsResponse(

            Long propertyId,

            PropertyResponse property,

            PropertyAddressResponse address,

            List<BuildingDetailsResponse> buildings,

            List<AmenityResponse> amenities,

            List<PropertyImageResponse> images) {

        PropertyDetailsResponse response =
                new PropertyDetailsResponse();

        response.setProperty(property);

        response.setAddress(address);

        response.setBuildings(
                buildings != null
                        ? buildings
                        : new ArrayList<>());

        response.setAmenities(
                amenities != null
                        ? amenities
                        : new ArrayList<>());

        response.setImages(
                images != null
                        ? images
                        : new ArrayList<>());

        return response;
    }

    private PropertyResponse convertPropertyToResponse(
            Property property) {

        PropertyResponse response =
                new PropertyResponse();

        response.setPropertyId(
                property.getPropertyId());

        response.setPropertyName(
                property.getPropertyName());

        response.setPropertyType(
                property.getPropertyType());

        response.setMonthlyRent(property.getMonthlyRent());

        response.setSecurityDeposit(property.getSecurityDeposit());

        response.setDescription(
                property.getDescription());

        response.setTotalArea(
                property.getTotalArea());

        response.setFurnishingStatus(
                property.getFurnishingStatus());

        response.setParkingAvailable(
                property.getParkingAvailable());

        response.setYearBuilt(
                property.getYearBuilt());

        response.setStatus(
                property.getStatus());

        /*
         * OWNER
         */
        if (property.getOwner() != null) {

            response.setOwnerId(
                    property.getOwner().getId());

            response.setOwnerName(
                    property.getOwner().getFirstName()
                            + " "
                            + property.getOwner().getLastName());
        }

        /*
         * PROPERTY MANAGER
         *
         * Property -> PropertyManager -> User
         */
        if (property.getPropertyManager() != null) {

            response.setPropertyManagerId(
                    property.getPropertyManager()
                            .getPropertyManagerId());

            if (property.getPropertyManager().getUser() != null) {

                response.setManagerName(
                        property.getPropertyManager()
                                .getUser()
                                .getFirstName()
                                + " "
                                + property.getPropertyManager()
                                        .getUser()
                                        .getLastName());

                response.setManagerEmail(
                        property.getPropertyManager()
                                .getUser()
                                .getEmail());

                response.setManagerPhone(
                        property.getPropertyManager()
                                .getUser()
                                .getPhone());
            }
        }

        response.setCreatedAt(
                property.getCreatedAt());

        response.setUpdatedAt(
                property.getUpdatedAt());

        return response;
    }

    private PropertyAddressResponse convertAddressToResponse(
            PropertyAddress address) {

        PropertyAddressResponse response =
                new PropertyAddressResponse();

        response.setAddressId(
                address.getAddressId());

        response.setPropertyId(
                address.getProperty() != null
                        ? address.getProperty().getPropertyId()
                        : null);

        response.setAddressLine1(
                address.getAddressLine1());

        response.setAddressLine2(
                address.getAddressLine2());

        response.setArea(
                address.getArea());

        response.setAreaType(
                address.getAreaType());

        response.setCity(
                address.getCity());

        response.setState(
                address.getState());

        response.setCountry(
                address.getCountry());

        response.setPincode(
                address.getPincode());

        response.setLatitude(
                address.getLatitude());

        response.setLongitude(
                address.getLongitude());

        response.setCreatedAt(
                address.getCreatedAt());

        response.setUpdatedAt(
                address.getUpdatedAt());

        return response;
    }

    private BuildingResponse convertBuildingToResponse(
            Building building) {

        Property property =
                building.getProperty();

        return new BuildingResponse(

                building.getBuildingId(),

                building.getBuildingName(),

                building.getDescription(),

                building.getTotalFloors(),

                property != null
                        ? property.getPropertyId()
                        : null,

                property != null
                        ? property.getPropertyName()
                        : null,

                building.getCreatedAt(),

                building.getUpdatedAt());
    }

    private FloorResponse convertFloorToResponse(
            Floor floor) {

        Building building =
                floor.getBuilding();

        Property property =
                building != null
                        ? building.getProperty()
                        : null;

        return new FloorResponse(

                floor.getFloorId(),

                floor.getFloorName(),

                floor.getFloorNumber(),

                building != null
                        ? building.getBuildingId()
                        : null,

                building != null
                        ? building.getBuildingName()
                        : null,

                property != null
                        ? property.getPropertyId()
                        : null,

                property != null
                        ? property.getPropertyName()
                        : null,

                floor.getCreatedAt(),

                floor.getUpdatedAt());
    }

    private UnitResponse convertUnitToResponse(
            Unit unit) {

        Floor floor =
                unit.getFloor();

        Building building =
                floor != null
                        ? floor.getBuilding()
                        : null;

        Property property =
                building != null
                        ? building.getProperty()
                        : null;

        UnitResponse response =
                new UnitResponse();

        response.setUnitId(
                unit.getUnitId());

        response.setUnitNumber(
                unit.getUnitNumber());

        response.setUnitType(
                unit.getUnitType());

        response.setArea(
                unit.getArea());

        response.setBedrooms(
                unit.getBedrooms());

        response.setBathrooms(
                unit.getBathrooms());

        response.setMonthlyRent(
                unit.getMonthlyRent());

        response.setSecurityDeposit(
                unit.getSecurityDeposit());

        response.setStatus(
                unit.getStatus());

        response.setDescription(
                unit.getDescription());

        response.setFloorId(
                floor != null
                        ? floor.getFloorId()
                        : null);

        response.setFloorName(
                floor != null
                        ? floor.getFloorName()
                        : null);

        response.setFloorNumber(
                floor != null
                        ? floor.getFloorNumber()
                        : null);

        response.setBuildingId(
                building != null
                        ? building.getBuildingId()
                        : null);

        response.setBuildingName(
                building != null
                        ? building.getBuildingName()
                        : null);

        response.setPropertyId(
                property != null
                        ? property.getPropertyId()
                        : null);

        response.setPropertyName(
                property != null
                        ? property.getPropertyName()
                        : null);

        response.setCreatedAt(
                unit.getCreatedAt());

        response.setUpdatedAt(
                unit.getUpdatedAt());

        return response;
    }

    private AmenityResponse convertAmenityToResponse(
            Amenity amenity) {

        AmenityResponse response =
                new AmenityResponse();

        response.setAmenityId(
                amenity.getAmenityId());

        response.setAmenityName(
                amenity.getAmenityName());

        response.setDescription(
                amenity.getDescription());

        return response;
    }

    private PropertyImageResponse convertImageToResponse(
            PropertyImage image) {

        Property property =
                image.getProperty();

        PropertyImageResponse response =
                new PropertyImageResponse();

        response.setImageId(
                image.getImageId());

        String rawUrl = image.getImageUrl();
        if (rawUrl == null || rawUrl.isBlank()) {
            response.setImageUrl(null);
        } else if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
            response.setImageUrl(rawUrl);
        } else if (rawUrl.startsWith("/uploads/")) {
            response.setImageUrl(rawUrl);
        } else if (s3Service != null) {
            try {
                response.setImageUrl(s3Service.generatePresignedUrl(rawUrl));
            } catch (Exception ex) {
                response.setImageUrl(rawUrl);
            }
        } else {
            response.setImageUrl(rawUrl);
        }

        response.setImageType(
                image.getImageType());

        response.setIsPrimary(
                image.getIsPrimary());

        response.setPropertyId(
                property != null
                        ? property.getPropertyId()
                        : null);

        response.setPropertyName(
                property != null
                        ? property.getPropertyName()
                        : null);

        response.setCreatedAt(
                image.getCreatedAt());

        response.setUpdatedAt(
                image.getUpdatedAt());

        return response;
    }
}
