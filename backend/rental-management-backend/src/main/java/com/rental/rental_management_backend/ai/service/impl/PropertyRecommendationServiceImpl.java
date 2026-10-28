package com.rental.rental_management_backend.ai.service.impl;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.ai.client.M2RecommendationClient;
import com.rental.rental_management_backend.ai.dto.AvailableUnitResponse;
import com.rental.rental_management_backend.ai.dto.M2RecommendationItem;
import com.rental.rental_management_backend.ai.dto.M2RecommendationRequest;
import com.rental.rental_management_backend.ai.dto.M2RecommendationResponse;
import com.rental.rental_management_backend.ai.service.PropertyRecommendationService;
import com.rental.rental_management_backend.property.dto.PropertyCardResponse;
import com.rental.rental_management_backend.property.entity.Unit;
import com.rental.rental_management_backend.property.enums.UnitStatus;
import com.rental.rental_management_backend.property.repository.PropertyRepository;
import com.rental.rental_management_backend.property.repository.UnitRepository;
import com.rental.rental_management_backend.s3.service.S3Service;
import com.rental.rental_management_backend.tenant.entity.Tenant;
import com.rental.rental_management_backend.tenant.repository.TenantRepository;

@Service
@Transactional(readOnly = true)
public class PropertyRecommendationServiceImpl
        implements PropertyRecommendationService {

    private final UserRepository userRepository;

    private final TenantRepository tenantRepository;

    private final M2RecommendationClient m2RecommendationClient;

    private final UnitRepository unitRepository;

    private final PropertyRepository propertyRepository;

    private final S3Service s3Service;

    private final ObjectMapper objectMapper;

    private final HttpClient httpClient;

    public PropertyRecommendationServiceImpl(

            UserRepository userRepository,

            TenantRepository tenantRepository,

            M2RecommendationClient m2RecommendationClient,

            UnitRepository unitRepository,

            PropertyRepository propertyRepository,

            S3Service s3Service,

            ObjectMapper objectMapper) {

        this.userRepository = userRepository;

        this.tenantRepository = tenantRepository;

        this.m2RecommendationClient = m2RecommendationClient;

        this.unitRepository = unitRepository;

        this.propertyRepository = propertyRepository;

        this.s3Service = s3Service;

        this.objectMapper = objectMapper;

        this.httpClient = HttpClient.newBuilder()

                .connectTimeout(Duration.ofSeconds(5))

                .build();
    }

    @Override
    public M2RecommendationResponse recommendProperties(

            Long tenantId,

            Integer topN,

            Double currentLatitude,

            Double currentLongitude,

            String currentAddress) {

        /*
         * ============================================================
         * 1. VERIFY AUTHENTICATED TENANT
         * ============================================================
         */

        Authentication authentication =
                SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication.getName() == null
                || authentication.getName().isBlank()) {
            throw new AccessDeniedException("Access denied");
        }

        User authenticatedUser = userRepository
                .findByEmail(authentication.getName())
                .orElseThrow(() -> new AccessDeniedException("Access denied"));
        Tenant authenticatedTenant = tenantRepository
                .findByUser(authenticatedUser)
                .orElseThrow(() -> new AccessDeniedException("Access denied"));

        if (tenantId == null
                || !authenticatedTenant.getTenantId().equals(tenantId)) {
            throw new AccessDeniedException("Access denied");
        }

        /*
         * ============================================================
         * 2. VALIDATE topN
         * ============================================================
         */

        if (topN == null || topN <= 0) {

            throw new IllegalArgumentException(
                    "topN must be greater than 0");
        }

        /*
         * ============================================================
         * 3. RESOLVE CURRENT LOCATION
         * ============================================================
         *
         * Priority:
         *
         * 1. Valid GPS coordinates
         * 2. Address geocoding if GPS is unavailable
         * 3. No coordinates if geocoding fails
         *
         * IMPORTANT:
         *
         * We never send a partial or invalid coordinate pair to M2.
         */

        Double validLatitude = null;

        Double validLongitude = null;

        /*
         * ------------------------------------------------------------
         * 3A. USE VALID GPS DIRECTLY
         * ------------------------------------------------------------
         */

        if (isValidLatitude(currentLatitude)
                && isValidLongitude(currentLongitude)) {

            validLatitude = currentLatitude;

            validLongitude = currentLongitude;
        }

        /*
         * ------------------------------------------------------------
         * 3B. GPS NOT AVAILABLE -> TRY ADDRESS GEOCODING
         * ------------------------------------------------------------
         */

        else if (currentAddress != null
                && !currentAddress.trim().isEmpty()) {

            try {

                double[] coordinates =
                        geocodeAddress(currentAddress.trim());

                if (coordinates != null
                        && isValidLatitude(coordinates[0])
                        && isValidLongitude(coordinates[1])) {

                    validLatitude = coordinates[0];

                    validLongitude = coordinates[1];
                }

            } catch (Exception ex) {

                /*
                 * Geocoding failure must NOT fail the recommendation.
                 *
                 * M2 can continue without distance calculation.
                 */

                validLatitude = null;

                validLongitude = null;
            }
        }

        /*
         * ============================================================
         * 4. CREATE M2 REQUEST
         * ============================================================
         *
         * IMPORTANT:
         *
         * We do NOT send tenant preferences.
         *
         * M2 reads the tenant's live preferences directly from Neon
         * using tenantId.
         *
         * currentLatitude/currentLongitude represent the current
         * request-time location.
         */

        M2RecommendationRequest request =
                new M2RecommendationRequest(

                        String.valueOf(tenantId),

                        // The M2 contract requires numeric topN; use its supported
                        // Integer ceiling so it does not truncate matching properties.
                        Integer.MAX_VALUE,

                        validLatitude,

                        validLongitude,

                        currentAddress
                );

        /*
         * ============================================================
         * 5. CALL M2 AI SERVICE
         * ============================================================
         */

        M2RecommendationResponse response =
                m2RecommendationClient.recommendProperties(request);

        /*
         * ============================================================
         * 6. HANDLE EMPTY M2 RESPONSE
         * ============================================================
         */

        if (response == null
                || response.getRecommendations() == null
                || response.getRecommendations().isEmpty()) {

            return response;
        }

        /*
         * ============================================================
         * 7. ENRICH ONLY M2-SELECTED UNITS
         * ============================================================
         *
         * IMPORTANT:
         *
         * We do NOT fetch every vacant unit.
         *
         * M2 has already selected the qualifying units.
         *
         * Spring Boot only revalidates those units against the
         * current database state.
         */

        List<M2RecommendationItem> validRecommendations =
                new ArrayList<>();

        for (M2RecommendationItem recommendation
                : response.getRecommendations()) {

            /*
             * --------------------------------------------------------
             * PROPERTY ID VALIDATION
             * --------------------------------------------------------
             */

            if (recommendation == null
                    || recommendation.getPropertyId() == null) {

                continue;
            }

            Long recommendedPropertyId;

            try {

                recommendedPropertyId =
                        Long.valueOf(
                                recommendation.getPropertyId());

            } catch (NumberFormatException ex) {

                continue;
            }

            /*
             * --------------------------------------------------------
             * LIGHTWEIGHT PROPERTY CARD
             * --------------------------------------------------------
             *
             * Get only the information required to display the
             * recommendation card.
             *
             * Full property details are NOT loaded here.
             *
             * Full details are loaded only when the tenant opens
             * the property using:
             *
             * GET /api/properties/public/{propertyId}
             */

            PropertyCardResponse propertyCard;

            try {

                propertyCard =
                        propertyRepository
                                .findPropertyCardById(
                                        recommendedPropertyId)
                                .orElse(null);

                if (propertyCard == null) {

                    continue;
                }

            } catch (Exception ex) {

                /*
                 * Property may no longer be available for public
                 * browsing.
                 *
                 * Do not return stale property information.
                 */

                continue;
            }

            propertyCard.setImageUrl(
                    toPresignedImageUrl(
                            propertyCard.getImageUrl()));

            recommendation.setPropertyCard(propertyCard);

            /*
             * --------------------------------------------------------
             * M2-SELECTED AVAILABLE UNITS
             * --------------------------------------------------------
             */

            List<AvailableUnitResponse> m2Units =
                    recommendation.getAvailableUnits();

            List<AvailableUnitResponse> currentAvailableUnits =
                    new ArrayList<>();

            /*
             * No units returned by M2 means this property cannot
             * be returned as a usable recommendation.
             */

            if (m2Units == null || m2Units.isEmpty()) {

                continue;
            }

            /*
             * Keep track of unit IDs returned by M2.
             */

            Set<Long> m2UnitIds = new HashSet<>();

            for (AvailableUnitResponse m2Unit : m2Units) {

                if (m2Unit == null
                        || m2Unit.getUnitId() == null) {

                    continue;
                }

                m2UnitIds.add(m2Unit.getUnitId());
            }

            /*
             * --------------------------------------------------------
             * REVALIDATE EACH M2 UNIT
             * --------------------------------------------------------
             *
             * Only units selected by M2 are checked.
             *
             * If a unit has become OCCUPIED after M2 generated
             * recommendations, it is removed.
             */

            for (Long unitId : m2UnitIds) {

                Unit unit;

                try {

                    unit = unitRepository.findById(unitId)
                            .orElse(null);

                } catch (Exception ex) {

                    continue;
                }

                if (unit == null) {

                    continue;
                }

                /*
                 * Unit must still be VACANT.
                 */

                if (unit.getStatus() != UnitStatus.VACANT) {

                    continue;
                }

                /*
                 * Verify that the unit still belongs to the
                 * property recommended by M2.
                 */

                if (unit.getFloor() == null
                        || unit.getFloor().getBuilding() == null
                        || unit.getFloor()
                                .getBuilding()
                                .getProperty() == null) {

                    continue;
                }

                Long actualPropertyId =
                        unit.getFloor()
                                .getBuilding()
                                .getProperty()
                                .getPropertyId();

                if (!recommendedPropertyId.equals(actualPropertyId)) {

                    continue;
                }

                /*
                 * Use CURRENT database values rather than stale
                 * values returned by M2.
                 */

                currentAvailableUnits.add(

                        new AvailableUnitResponse(

                                unit.getUnitId(),

                                unit.getMonthlyRent(),

                                unit.getBedrooms()

                        )
                );
            }

            /*
             * --------------------------------------------------------
             * REMOVE PROPERTY IF ALL M2 UNITS ARE UNAVAILABLE
             * --------------------------------------------------------
             */

            if (currentAvailableUnits.isEmpty()) {

                continue;
            }

            /*
             * Set only the currently valid M2-selected units.
             */

            recommendation.setAvailableUnits(
                    currentAvailableUnits);

            /*
             * Keep this property recommendation.
             */

            validRecommendations.add(recommendation);
        }

        /*
         * ============================================================
         * 8. REPLACE STALE RECOMMENDATIONS
         * ============================================================
         */

        response.setRecommendations(
                validRecommendations);

        /*
         * Count represents DISTINCT recommended properties.
         */

        response.setCount(
                validRecommendations.size());

        /*
         * ============================================================
         * 9. RETURN FINAL RESPONSE
         * ============================================================
         */

        return response;
    }

    /*
     * ================================================================
     * GPS VALIDATION
     * ================================================================
     */

    private boolean isValidLatitude(Double latitude) {

        return latitude != null

                && Double.isFinite(latitude)

                && latitude >= -90.0

                && latitude <= 90.0;
    }

    private boolean isValidLongitude(Double longitude) {

        return longitude != null

                && Double.isFinite(longitude)

                && longitude >= -180.0

                && longitude <= 180.0;
    }

    /*
     * ================================================================
     * ADDRESS -> COORDINATES
     * ================================================================
     *
     * Uses OpenStreetMap Nominatim for address resolution.
     *
     * If the address cannot be resolved, this method returns null.
     *
     * The recommendation flow continues without coordinates.
     *
     * M2 remains responsible for distance calculation.
     */

    private double[] geocodeAddress(String address)

            throws Exception {

        String encodedAddress =

                URLEncoder.encode(

                        address,

                        StandardCharsets.UTF_8);

        String url =

                "https://nominatim.openstreetmap.org/search"

                        + "?q=" + encodedAddress

                        + "&format=json"

                        + "&limit=1";

        HttpRequest request =

                HttpRequest.newBuilder()

                        .uri(URI.create(url))

                        .timeout(Duration.ofSeconds(5))

                        .header(

                                "User-Agent",

                                "AI-Smart-Rental-Property-Management-System")

                        .GET()

                        .build();

        HttpResponse<String> response =

                httpClient.send(

                        request,

                        HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {

            return null;
        }

        JsonNode root =

                objectMapper.readTree(

                        response.body());

        if (!root.isArray()

                || root.isEmpty()) {

            return null;
        }

        JsonNode firstResult =

                root.get(0);

        JsonNode latitudeNode =

                firstResult.get("lat");

        JsonNode longitudeNode =

                firstResult.get("lon");

        if (latitudeNode == null

                || longitudeNode == null) {

            return null;
        }

        double latitude =

                latitudeNode.asDouble();

        double longitude =

                longitudeNode.asDouble();

        if (!isValidLatitude(latitude)

                || !isValidLongitude(longitude)) {

            return null;
        }

        return new double[] {

                latitude,

                longitude

        };
    }

    private String toPresignedImageUrl(String imageUrl) {

        if (imageUrl == null
                || imageUrl.isBlank()
                || imageUrl.startsWith("http://")
                || imageUrl.startsWith("https://")
                || imageUrl.startsWith("/uploads/")) {

            return imageUrl;
        }

        return s3Service.generatePresignedUrl(imageUrl);
    }
}