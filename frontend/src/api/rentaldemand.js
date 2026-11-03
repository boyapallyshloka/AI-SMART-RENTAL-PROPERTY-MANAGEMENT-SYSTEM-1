import axiosClient from './axiosClient'

/** Request the backend M3 forecast for a city, locality, and observation month. */
export const predictRentalDemand = async ({ city, area, year, month }) => {
  return axiosClient.post('/ai/rental-demand/predict', {
    city,
    area,
    year: Number(year),
    month: Number(month),
  })
}
