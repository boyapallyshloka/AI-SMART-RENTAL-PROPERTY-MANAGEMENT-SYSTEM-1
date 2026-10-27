import axiosClient from './axiosClient.js'

/**
 * Fetch reports for the authenticated user's permitted property scope.
 * Backend: GET /api/reports-analytics?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * Supported roles: SUPER_ADMIN, PROPERTY_OWNER, PROPERTY_MANAGER.
 */
export const getReportsAnalytics = ({ startDate, endDate, signal } = {}) => {
  const params = {}
  if (startDate) params.startDate = startDate
  if (endDate) params.endDate = endDate

  return axiosClient.get('/reports-analytics', {
    params: Object.keys(params).length ? params : undefined,
    signal,
  })
}
