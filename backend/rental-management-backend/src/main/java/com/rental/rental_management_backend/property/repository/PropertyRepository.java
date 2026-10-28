package com.rental.rental_management_backend.property.repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import com.rental.rental_management_backend.property.dto.PropertyCardResponse;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;

import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.property.entity.Property;
import com.rental.rental_management_backend.property.entity.PropertyManager;
import com.rental.rental_management_backend.property.enums.FurnishingStatus;
import com.rental.rental_management_backend.property.enums.PropertyStatus;
import com.rental.rental_management_backend.property.enums.PropertyType;

public interface PropertyRepository extends JpaRepository<Property, Long> {

    // M3 Rental Demand Prediction: direct-rental House/Villa inventory.
    @Query("""
        SELECT COUNT(p)
        FROM Property p
        JOIN PropertyAddress pa
            ON pa.property = p
        WHERE LOWER(pa.city) = LOWER(:city)
          AND LOWER(pa.area) = LOWER(:area)
          AND p.propertyType IN (
              com.rental.rental_management_backend.property.enums.PropertyType.HOUSE,
              com.rental.rental_management_backend.property.enums.PropertyType.VILLA
          )
          AND p.status IN (
              com.rental.rental_management_backend.property.enums.PropertyStatus.AVAILABLE,
              com.rental.rental_management_backend.property.enums.PropertyStatus.OCCUPIED
          )
        """)
    long countDirectRentalPropertiesForRentalDemand(
            @Param("city") String city,
            @Param("area") String area);

    @Query("""
        SELECT COUNT(p)
        FROM Property p
        JOIN PropertyAddress pa
            ON pa.property = p
        WHERE LOWER(pa.city) = LOWER(:city)
          AND LOWER(pa.area) = LOWER(:area)
          AND p.propertyType IN (
              com.rental.rental_management_backend.property.enums.PropertyType.HOUSE,
              com.rental.rental_management_backend.property.enums.PropertyType.VILLA
          )
          AND p.status = :status
        """)
    long countDirectRentalPropertiesByStatusForRentalDemand(
            @Param("city") String city,
            @Param("area") String area,
            @Param("status") PropertyStatus status);

    @Query("""
        SELECT AVG(p.monthlyRent)
        FROM Property p
        JOIN PropertyAddress pa
            ON pa.property = p
        WHERE LOWER(pa.city) = LOWER(:city)
          AND LOWER(pa.area) = LOWER(:area)
          AND p.propertyType IN (
              com.rental.rental_management_backend.property.enums.PropertyType.HOUSE,
              com.rental.rental_management_backend.property.enums.PropertyType.VILLA
          )
          AND p.status IN (
              com.rental.rental_management_backend.property.enums.PropertyStatus.AVAILABLE,
              com.rental.rental_management_backend.property.enums.PropertyStatus.OCCUPIED
          )
        """)
    BigDecimal averageDirectRentalMonthlyRentForRentalDemand(
            @Param("city") String city,
            @Param("area") String area);

    @Query("""
        SELECT COUNT(p.monthlyRent)
        FROM Property p
        JOIN PropertyAddress pa
            ON pa.property = p
        WHERE LOWER(pa.city) = LOWER(:city)
          AND LOWER(pa.area) = LOWER(:area)
          AND p.propertyType IN (
              com.rental.rental_management_backend.property.enums.PropertyType.HOUSE,
              com.rental.rental_management_backend.property.enums.PropertyType.VILLA
          )
          AND p.status IN (
              com.rental.rental_management_backend.property.enums.PropertyStatus.AVAILABLE,
              com.rental.rental_management_backend.property.enums.PropertyStatus.OCCUPIED
          )
        """)
    long countPricedDirectRentalPropertiesForRentalDemand(
            @Param("city") String city,
            @Param("area") String area);

    @EntityGraph(attributePaths = {"owner", "propertyManager.user"})
    @Query("SELECT p FROM Property p WHERE p.propertyId = :propertyId")
    Optional<Property> findDetailsById(
            @Param("propertyId") Long propertyId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Property p WHERE p.propertyId = :propertyId")
    Optional<Property> findByPropertyIdForUpdate(
            @Param("propertyId") Long propertyId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        SELECT p
        FROM Property p
        WHERE p.propertyId = :propertyId
          AND p.owner = :owner
        """)
    Optional<Property> findByPropertyIdAndOwnerForUpdate(
            @Param("propertyId") Long propertyId,
            @Param("owner") User owner);

    @EntityGraph(attributePaths = {"owner", "propertyManager.user"})
    List<Property> findByOwner(User owner);

    @EntityGraph(attributePaths = {"owner", "propertyManager.user"})
    Optional<Property> findByPropertyIdAndOwner(
            Long propertyId,
            User owner
    );

    @EntityGraph(attributePaths = {"owner", "propertyManager.user"})
    @Query("""
        SELECT p
        FROM Property p
        WHERE p.propertyId = :propertyId
          AND p.owner.email = :ownerEmail
          AND p.owner.role = :ownerRole
        """)
    Optional<Property> findOwnedPropertyByIdAndOwnerEmail(
            @Param("propertyId") Long propertyId,
            @Param("ownerEmail") String ownerEmail,
            @Param("ownerRole") RoleType ownerRole);

    @EntityGraph(attributePaths = {"owner", "propertyManager.user"})
    List<Property> findByStatus(PropertyStatus status);

    @EntityGraph(attributePaths = {"owner", "propertyManager.user"})
    List<Property> findByStatusAndSubmittedForApprovalTrue(PropertyStatus status);

    @EntityGraph(attributePaths = {"owner", "propertyManager.user"})
    List<Property> findByStatusIn(List<PropertyStatus> statuses);

    @EntityGraph(attributePaths = {"owner", "propertyManager.user"})
    List<Property> findByPropertyManager(PropertyManager propertyManager);

    // Get all properties assigned using PropertyManager ID
    @EntityGraph(attributePaths = {"owner", "propertyManager.user"})
    List<Property> findByPropertyManager_PropertyManagerId(
            Long propertyManagerId
    );

    /*
     * Tenant property search/filter
     *
     * Searches only AVAILABLE properties.
     *
     * Property-level filters:
     * - property name
     * - area
     * - city
     * - state
     * - address
     * - property type
     * - furnishing status
     * - parking
     *
     * Unit-level filters:
     * - minimum rent
     * - maximum rent
     * - bedrooms
     *
     * All unit-level filters are applied
     * to the SAME vacant unit.
     */
    @Query("""
        SELECT DISTINCT
            p AS property,
            COALESCE(
                (
                    SELECT primaryImage.imageUrl
                    FROM PropertyImage primaryImage
                    WHERE primaryImage.property = p
                      AND primaryImage.imageId = (
                          SELECT MIN(primaryImageId.imageId)
                          FROM PropertyImage primaryImageId
                          WHERE primaryImageId.property = p
                            AND primaryImageId.isPrimary = true
                      )
                ),
                (
                    SELECT fallbackImage.imageUrl
                    FROM PropertyImage fallbackImage
                    WHERE fallbackImage.property = p
                      AND fallbackImage.imageId = (
                          SELECT MIN(fallbackImageId.imageId)
                          FROM PropertyImage fallbackImageId
                          WHERE fallbackImageId.property = p
                      )
                )
            ) AS imageUrl
        FROM Property p
        WHERE p.status = :status

        AND (
            COALESCE(:searchQuery, '') = ''
            OR LOWER(p.propertyName)
                LIKE LOWER(CONCAT('%', COALESCE(:searchQuery, ''), '%'))

            OR EXISTS (
                SELECT a.addressId
                FROM PropertyAddress a
                WHERE a.property = p
                AND (
                    LOWER(a.area)
                        LIKE LOWER(CONCAT('%', COALESCE(:searchQuery, ''), '%'))

                    OR LOWER(a.city)
                        LIKE LOWER(CONCAT('%', COALESCE(:searchQuery, ''), '%'))

                    OR LOWER(a.state)
                        LIKE LOWER(CONCAT('%', COALESCE(:searchQuery, ''), '%'))

                    OR LOWER(a.addressLine1)
                        LIKE LOWER(CONCAT('%', COALESCE(:searchQuery, ''), '%'))
                )
            )
        )

        AND (
            COALESCE(:city, '') = ''
            OR EXISTS (
                SELECT a2.addressId
                FROM PropertyAddress a2
                WHERE a2.property = p
                AND LOWER(a2.city) = LOWER(COALESCE(:city, ''))
            )
        )

        AND (
            :propertyType IS NULL
            OR p.propertyType = :propertyType
        )

        AND (
            :furnishingStatus IS NULL
            OR p.furnishingStatus = :furnishingStatus
        )

        AND (
            :parkingAvailable IS NULL
            OR p.parkingAvailable = :parkingAvailable
        )

        AND (
            :minRent IS NULL
            AND :maxRent IS NULL
            AND :bedrooms IS NULL

            OR (
                p.propertyType IN (
                    com.rental.rental_management_backend.property.enums.PropertyType.HOUSE,
                    com.rental.rental_management_backend.property.enums.PropertyType.VILLA
                )
                AND :bedrooms IS NULL
                AND (
                    :minRent IS NULL
                    OR p.monthlyRent >= :minRent
                )
                AND (
                    :maxRent IS NULL
                    OR p.monthlyRent <= :maxRent
                )
            )

            OR (
                p.propertyType NOT IN (
                    com.rental.rental_management_backend.property.enums.PropertyType.HOUSE,
                    com.rental.rental_management_backend.property.enums.PropertyType.VILLA
                )
                AND EXISTS (
                SELECT u.unitId
                FROM Unit u
                JOIN u.floor f
                JOIN f.building b

                WHERE b.property = p

                AND u.status =
                    com.rental.rental_management_backend.property.enums.UnitStatus.VACANT

                AND (
                    :minRent IS NULL
                    OR u.monthlyRent >= :minRent
                )

                AND (
                    :maxRent IS NULL
                    OR u.monthlyRent <= :maxRent
                )

                AND (
                    :bedrooms IS NULL
                    OR u.bedrooms = :bedrooms
                )
                )
            )
        )
        """)
    @EntityGraph(attributePaths = {"owner", "propertyManager.user"})
    List<PublicPropertySearchResult> searchAvailableProperties(

            @Param("status")
            PropertyStatus status,

            @Param("searchQuery")
            String searchQuery,

            @Param("city")
            String city,

            @Param("propertyType")
            PropertyType propertyType,

            @Param("furnishingStatus")
            FurnishingStatus furnishingStatus,

            @Param("parkingAvailable")
            Boolean parkingAvailable,

            @Param("minRent")
            Double minRent,

            @Param("maxRent")
            Double maxRent,

            @Param("bedrooms")
            Integer bedrooms
    );

    interface PublicPropertySearchResult {
        Property getProperty();

        String getImageUrl();
    }

    @Query("""
    SELECT new com.rental.rental_management_backend.property.dto.PropertyCardResponse(
        p.propertyId,
        p.propertyName,
        CAST(p.propertyType AS string),
        CAST(p.status AS string),
        p.totalArea,
        p.bedrooms,
        p.yearBuilt,
        (SELECT CONCAT(CONCAT(propertyAddress.area, ', '), propertyAddress.city)
         FROM PropertyAddress propertyAddress
         WHERE propertyAddress.property = p),
        COALESCE(
            (SELECT primaryImage.imageUrl
             FROM PropertyImage primaryImage
             WHERE primaryImage.property = p
               AND primaryImage.imageId = (
                   SELECT MIN(primaryImageId.imageId)
                   FROM PropertyImage primaryImageId
                   WHERE primaryImageId.property = p
                     AND primaryImageId.isPrimary = true
               )),
            (SELECT fallbackImage.imageUrl
             FROM PropertyImage fallbackImage
             WHERE fallbackImage.property = p
               AND fallbackImage.imageId = (
                   SELECT MIN(fallbackImageId.imageId)
                   FROM PropertyImage fallbackImageId
                   WHERE fallbackImageId.property = p
               ))
        ),
        false,
        p.monthlyRent,
        p.securityDeposit
    )
    FROM Property p
    WHERE p.status = :status
    """)
    List<PropertyCardResponse> findAvailablePropertyCards(
            @Param("status") PropertyStatus status);

    /*
     * Lightweight property card lookup for M2 recommendations.
     *
     * This returns only the information required for the
     * recommendation card.
     *
     * Full property details are loaded only when the tenant
     * opens the property using:
     *
     * GET /api/properties/public/{propertyId}
     */
    @Query("""
        SELECT new com.rental.rental_management_backend.property.dto.PropertyCardResponse(
            p.propertyId,
            p.propertyName,
            CAST(p.propertyType AS string),
            CAST(p.status AS string),
            p.totalArea,
            p.bedrooms,
            p.yearBuilt,
            (
                SELECT CONCAT(CONCAT(a.addressLine1, ', '), a.city)
                FROM PropertyAddress a
                WHERE a.property = p
            ),
            COALESCE(
                (
                    SELECT primaryImage.imageUrl
                    FROM PropertyImage primaryImage
                    WHERE primaryImage.property = p
                      AND primaryImage.imageId = (
                          SELECT MIN(primaryImageId.imageId)
                          FROM PropertyImage primaryImageId
                          WHERE primaryImageId.property = p
                            AND primaryImageId.isPrimary = true
                      )
                ),
                (
                    SELECT fallbackImage.imageUrl
                    FROM PropertyImage fallbackImage
                    WHERE fallbackImage.property = p
                      AND fallbackImage.imageId = (
                          SELECT MIN(fallbackImageId.imageId)
                          FROM PropertyImage fallbackImageId
                          WHERE fallbackImageId.property = p
                            AND fallbackImage.imageId = (
                                SELECT MIN(fallbackImageId2.imageId)
                                FROM PropertyImage fallbackImageId2
                                WHERE fallbackImageId2.property = p
                            )
                      )
                )
            ),
            false,
            p.monthlyRent,
            p.securityDeposit
        )
        FROM Property p
        WHERE p.propertyId = :propertyId
        """)
    Optional<PropertyCardResponse> findPropertyCardById(
            @Param("propertyId") Long propertyId);
}
