package com.rental.rental_management_backend.property.repository;



import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.rental.rental_management_backend.property.entity.Floor;
import com.rental.rental_management_backend.property.entity.Unit;
import com.rental.rental_management_backend.property.enums.UnitStatus;

public interface UnitRepository extends JpaRepository<Unit, Long> {

    @EntityGraph(attributePaths = {
            "floor",
            "floor.building",
            "floor.building.property"
    })
    List<Unit> findByFloor(Floor floor);

    @EntityGraph(attributePaths = {
            "floor",
            "floor.building",
            "floor.building.property",
            "floor.building.property.owner",
            "floor.building.property.propertyManager.user"
    })
    Optional<Unit> findUnitWithAccessDetailsByUnitId(Long unitId);

    @EntityGraph(attributePaths = {
            "floor",
            "floor.building",
            "floor.building.property"
    })
    List<Unit> findByFloorIn(List<Floor> floors);

    boolean existsByFloorAndUnitNumber(
            Floor floor,
            String unitNumber);

    boolean existsByFloorAndUnitNumberAndUnitIdNot(
            Floor floor,
            String unitNumber,
            Long unitId);

    List<Unit> findByFloorAndStatus(
            Floor floor,
            UnitStatus status);

    List<Unit> findByStatus(UnitStatus status);

    @Query("""
        SELECT u
        FROM Unit u
        JOIN FETCH u.floor f
        JOIN FETCH f.building b
        JOIN FETCH b.property p
        WHERE b.property.propertyId IN :propertyIds
          AND u.status = :status
        """)
    List<Unit> findByPropertyIdsAndStatus(
            @Param("propertyIds") List<Long> propertyIds,
            @Param("status") UnitStatus status);
 
 // M3 Rental Demand Prediction

    @Query("""
        SELECT COUNT(u)
        FROM Unit u
        JOIN u.floor f
        JOIN f.building b
        JOIN PropertyAddress pa
            ON pa.property = b.property
        WHERE LOWER(pa.city) = LOWER(:city)
          AND LOWER(pa.area) = LOWER(:area)
        """)
    long countUnitsForRentalDemand(
            @Param("city") String city,
            @Param("area") String area);


    @Query("""
        SELECT COUNT(u)
        FROM Unit u
        JOIN u.floor f
        JOIN f.building b
        JOIN PropertyAddress pa
            ON pa.property = b.property
        WHERE LOWER(pa.city) = LOWER(:city)
          AND LOWER(pa.area) = LOWER(:area)
          AND u.status = :status
        """)
    long countUnitsByStatusForRentalDemand(
            @Param("city") String city,
            @Param("area") String area,
            @Param("status") UnitStatus status);


    @Query("""
        SELECT AVG(u.monthlyRent)
        FROM Unit u
        JOIN u.floor f
        JOIN f.building b
        JOIN PropertyAddress pa
            ON pa.property = b.property
        WHERE LOWER(pa.city) = LOWER(:city)
          AND LOWER(pa.area) = LOWER(:area)
        """)
    BigDecimal averageMonthlyRentForRentalDemand(
            @Param("city") String city,
            @Param("area") String area);
}
