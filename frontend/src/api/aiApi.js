import axiosClient from './axiosClient'

/**
 * AI decision-support and predictive analytics API service.
 */

/**
 * Predict rental demand for a locality and month.
 * Backend: POST /api/ai/rental-demand/predict
 * Body: { city, area, year, month }
 */
export const predictRentalDemand = ({ city, area, year, month }) =>
  axiosClient.post('/ai/rental-demand/predict', {
    city: String(city || '').trim(),
    area: String(area || '').trim(),
    year: Number(year),
    month: Number(month),
  })

/**
 * AI Property Recommendation Module (M2)
 * Spring Boot Endpoint: GET /api/ai/recommendations
 *
 * Communicates ONLY with Spring Boot (which orchestrates with the AI/ML service).
 * Request: GET /ai/recommendations?tenantId={tenantId}&topN={topN}&currentLatitude=...&currentLongitude=...&currentAddress=...
 *
 * @param {number|string} tenantId - Authenticated tenant ID (Long)
 * @param {number} [topN=5] - Number of recommendations to retrieve
 * @param {Object} [locationContext={}] - Optional tenant location context
 * @param {number} [locationContext.currentLatitude] - Optional latitude
 * @param {number} [locationContext.currentLongitude] - Optional longitude
 * @param {string} [locationContext.currentAddress] - Optional address
 * @returns {Promise<Object>} M2RecommendationResponse { success, tenantId, recommendations, count, modelVersion }
 */
export const getPropertyRecommendations = async (
  tenantId,
  topN = 5,
  locationContext = {}
) => {
  if (!tenantId) {
    throw new Error('A valid tenantId is required to retrieve property recommendations.')
  }

  const params = {
    tenantId,
    topN,
  }

  if (locationContext?.currentLatitude != null && !isNaN(Number(locationContext.currentLatitude))) {
    params.currentLatitude = Number(locationContext.currentLatitude)
  }

  if (locationContext?.currentLongitude != null && !isNaN(Number(locationContext.currentLongitude))) {
    params.currentLongitude = Number(locationContext.currentLongitude)
  }

  if (
    typeof locationContext?.currentAddress === 'string' &&
    locationContext.currentAddress.trim() !== ''
  ) {
    params.currentAddress = locationContext.currentAddress.trim()
  }

  return await axiosClient.get('/ai/recommendations', {
    params,
    timeout: 60000,
  })
}

/**
 * AI Rent Prediction Module (M1)
 * Spring Boot Endpoint: POST /api/ai/rent-prediction/predict-unit
 *
 * Request body:
 * {
 *   floorId: number,
 *   area: number,
 *   bedrooms: number,
 *   bathrooms: number
 * }
 *
 * Note: Amenities are NOT sent from the frontend because Spring Boot automatically
 * loads and enriches them from the saved property in the database.
 * For the M1 model schema, area, bedrooms, and bathrooms must be strictly greater than 0.
 *
 * @param {Object} data
 * @param {number} data.floorId - Associated floor ID (Long, positive)
 * @param {number} data.area - Unit area in sqft (Double, strictly > 0)
 * @param {number} data.bedrooms - Number of bedrooms (Integer, strictly > 0)
 * @param {number} data.bathrooms - Number of bathrooms (Integer/Double, strictly > 0)
 * @returns {Promise<Object>} { predictedRent: number }
 */
export const predictUnitRent = async ({ floorId, area, bedrooms, bathrooms }) => {
  return await axiosClient.post(
    '/ai/rent-prediction/predict-unit',
    {
      floorId: Number(floorId),
      area: Number(area),
      bedrooms: Number(bedrooms),
      bathrooms: Number(bathrooms),
    },
    {
      timeout: 60000,
    }
  )
}

export const predictRent = predictUnitRent


