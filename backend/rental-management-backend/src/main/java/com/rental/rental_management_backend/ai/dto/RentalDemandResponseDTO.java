
package com.rental.rental_management_backend.ai.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class RentalDemandResponseDTO {

    private Boolean success;

    private Double prediction;

    private Integer predictedDemandCount;

    private String demandUnit;

    private String forecastPeriod;

    private String city;

    private String areaLocality;

    private Integer month;

    private Integer year;

    private String demandLevel;

    private String modelVersion;
    private String demandLevel;
private Integer month;
private Integer year;
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

    public RentalDemandResponseDTO() {
    }

    public Boolean getSuccess() {
        return success;
    }

    public void setSuccess(Boolean success) {
        this.success = success;
    }

    public Double getPrediction() {
        return prediction;
    }

    public void setPrediction(Double prediction) {
        this.prediction = prediction;
    }

    public Integer getPredictedDemandCount() {
        return predictedDemandCount;
    }

    public void setPredictedDemandCount(Integer predictedDemandCount) {
        this.predictedDemandCount = predictedDemandCount;
    }

    public String getDemandUnit() {
        return demandUnit;
    }

    public void setDemandUnit(String demandUnit) {
        this.demandUnit = demandUnit;
    }

    public String getForecastPeriod() {
        return forecastPeriod;
    }

    public void setForecastPeriod(String forecastPeriod) {
        this.forecastPeriod = forecastPeriod;
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

    public Integer getYear() {
        return year;
    }

    public void setYear(Integer year) {
        this.year = year;
    }

    public String getDemandLevel() {
        return demandLevel;
    }

    public void setDemandLevel(String demandLevel) {
        this.demandLevel = demandLevel;
    }

    public String getModelVersion() {
        return modelVersion;
    }

    public void setModelVersion(String modelVersion) {
        this.modelVersion = modelVersion;
    }
}
