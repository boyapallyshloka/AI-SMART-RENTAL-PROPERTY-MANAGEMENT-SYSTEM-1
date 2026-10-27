package com.rental.rental_management_backend.ai.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class RentalDemandResponseDTO {

    private String city;

    @JsonProperty("area_locality")
    private String areaLocality;

    private String modelVersion;

    private String demandLevel;

    private Integer month;

    private Integer year;

    @JsonProperty("property_count")
    private Integer propertyCount;

    private String modelVersion;

    public RentalDemandResponseDTO() {
    }


    public String getCity() {
        return city;
    }

    public void setCity(String city) {
        this.city = city;
    }


    public String getAreaLocality() {
        return areaLocality;
    }

    public void setAreaLocality(String areaLocality) {
        this.areaLocality = areaLocality;
    }


    public String getModelVersion() {
        return modelVersion;
    }

    public void setModelVersion(String modelVersion) {
        this.modelVersion = modelVersion;
    }


    public String getDemandLevel() {
        return demandLevel;
    }

    public void setDemandLevel(String demandLevel) {
        this.demandLevel = demandLevel;
    }


    public Integer getMonth() {
        return month;
    }

    public void setMonth(Integer month) {
        this.month = month;
    }


    public Integer getYear() {
        return year;
    }

    public void setYear(Integer year) {
        this.year = year;
    }


    public Integer getPropertyCount() {
        return propertyCount;
    }

    public void setPropertyCount(Integer propertyCount) {
        this.propertyCount = propertyCount;
    }


    public Integer getApplicationCount() {
        return applicationCount;
    }

    public void setApplicationCount(Integer applicationCount) {
        this.applicationCount = applicationCount;
    }


    public Integer getAgreementStartCount() {
        return agreementStartCount;
    }

    public void setAgreementStartCount(Integer agreementStartCount) {
        this.agreementStartCount = agreementStartCount;
    }


    public Double getAverageMonthlyRent() {
        return averageMonthlyRent;
    }

    public void setAverageMonthlyRent(Double averageMonthlyRent) {
        this.averageMonthlyRent = averageMonthlyRent;
    }


    public Integer getDemandLag1Month() {
        return demandLag1Month;
    }

    public void setDemandLag1Month(Integer demandLag1Month) {
        this.demandLag1Month = demandLag1Month;
    }


    public Integer getDemandLag2Month() {
        return demandLag2Month;
    }

    public void setDemandLag2Month(Integer demandLag2Month) {
        this.demandLag2Month = demandLag2Month;
    }


    public Double getDemandGrowth1Month() {
        return demandGrowth1Month;
    }

    public void setDemandGrowth1Month(Double demandGrowth1Month) {
        this.demandGrowth1Month = demandGrowth1Month;
    }


    public Double getOccupancyRate() {
        return occupancyRate;
    }

    public void setOccupancyRate(Double occupancyRate) {
        this.occupancyRate = occupancyRate;
    }


    public Double getVacancyRate() {
        return vacancyRate;
    }

    public void setVacancyRate(Double vacancyRate) {
        this.vacancyRate = vacancyRate;
    }


    public Integer getAvailableUnitCount() {
        return availableUnitCount;
    }

    public void setAvailableUnitCount(Integer availableUnitCount) {
        this.availableUnitCount = availableUnitCount;
    }
}