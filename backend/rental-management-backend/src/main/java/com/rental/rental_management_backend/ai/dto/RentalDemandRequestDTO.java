
package com.rental.rental_management_backend.ai.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class RentalDemandRequestDTO {

    private String city;

    @JsonProperty("area_locality")
    private String areaLocality;

    private Integer month;

    @JsonProperty("property_count")
    private Integer propertyCount;

    @JsonProperty("application_count")
    private Integer applicationCount;

    @JsonProperty("agreement_start_count")
    private Integer agreementStartCount;

    @JsonProperty("average_monthly_rent")
    private Double averageMonthlyRent;

    @JsonProperty("demand_lag_1_month")
    private Integer demandLag1Month;

    @JsonProperty("demand_lag_2_month")
    private Integer demandLag2Month;

    @JsonProperty("demand_growth_1_month")
    private Double demandGrowth1Month;

    @JsonProperty("occupancy_rate")
    private Double occupancyRate;

    @JsonProperty("vacancy_rate")
    private Double vacancyRate;

    @JsonProperty("available_unit_count")
    private Integer availableUnitCount;

    public RentalDemandRequestDTO() {
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

    public Integer getMonth() {
        return month;
    }

    public void setMonth(Integer month) {
        this.month = month;
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
