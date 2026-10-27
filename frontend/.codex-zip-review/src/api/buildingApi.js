import axiosClient from './axiosClient.js'
import { getManagerAssignedProperties } from './propertyApi.js'
import { resolveTenantRentalContext } from '../utils/tenantRentalHelper.js'

/**
 * Building API Service Layer (Spring Boot Integration)
 * Controller: BuildingController (/api/buildings)
 * Role: PROPERTY_OWNER, PROPERTY_MANAGER
 */

export const ALLOWED_BUILDING_FIELDS = [
  'buildingName',
  'totalFloors',
  'description',
  'propertyId',
]

/**
 * Formats and sanitizes BuildingRequest payload matching Spring Boot DTO constraints:
 * - buildingName: String (@NotBlank)
 * - totalFloors: Integer (@PositiveOrZero, optional)
 * - description: String (optional)
 * - propertyId: Long (@NotNull)
 *
 * Strictly ensures:
 * - propertyId remains a flat number (never a nested property object)
 * - buildingId is strictly omitted from request bodies
 * - response and UI metadata (propertyName, createdAt, updatedAt, ownerId, totalUnits, etc.) are omitted
 * - numeric fields preserve actual numeric values without inventing arbitrary defaults
 */
export const formatBuildingRequest = (data = {}) => {
  const buildingName =
    data.buildingName != null
      ? String(data.buildingName).trim()
      : data.name != null
      ? String(data.name).trim()
      : undefined

  const rawFloors = data.totalFloors !== undefined ? data.totalFloors : data.floors
  const totalFloors =
    rawFloors !== undefined && rawFloors !== null && rawFloors !== ''
      ? Number(rawFloors)
      : undefined

  const description =
    data.description != null && String(data.description).trim() !== ''
      ? String(data.description).trim()
      : undefined

  const rawPropertyId =
    data.propertyId !== undefined
      ? data.propertyId
      : data.property?.id !== undefined
      ? data.property.id
      : data.property?.propertyId !== undefined
      ? data.property.propertyId
      : undefined

  const propertyId =
    rawPropertyId !== undefined && rawPropertyId !== null && rawPropertyId !== ''
      ? Number(rawPropertyId)
      : undefined

  const payload = {
    buildingName: buildingName || undefined,
    totalFloors,
    description,
    propertyId,
  }

  // Strictly exclude UI, entity, and response-only fields
  delete payload.buildingId
  delete payload.id
  delete payload.totalUnits
  delete payload.propertyName
  delete payload.createdAt
  delete payload.updatedAt
  delete payload.ownerId
  delete payload.property

  return Object.fromEntries(
    Object.entries(payload).filter(([_, v]) => v !== undefined)
  )
}

// POST /api/buildings
export const createBuilding = async (buildingData) => {
  const payload = formatBuildingRequest(buildingData)
  return axiosClient.post('/buildings', payload)
}

// GET /api/buildings/property/{propertyId}
export const getBuildingsByProperty = async (propertyId) => {
  return axiosClient.get(`/buildings/property/${propertyId}`)
}

// GET /api/buildings/{buildingId}
export const getBuildingById = async (buildingId) => {
  return axiosClient.get(`/buildings/${buildingId}`)
}

// PUT /api/buildings/{buildingId}
export const updateBuilding = async (buildingId, buildingData) => {
  const payload = formatBuildingRequest(buildingData)
  return axiosClient.put(`/buildings/${buildingId}`, payload)
}

// DELETE /api/buildings/{buildingId}
export const deleteBuilding = async (buildingId) => {
  return axiosClient.delete(`/buildings/${buildingId}`)
}

// ============================================================================
// UI Compatibility Helpers (Powered by Real Backend APIs)
// ============================================================================

export const getAllBuildings = async () => {
  return []
}

export const getBuildingsForManager = async () => {
  const propsRes = await getManagerAssignedProperties()
  const propList = Array.isArray(propsRes?.data)
    ? propsRes.data
    : Array.isArray(propsRes)
    ? propsRes
    : []

  const buildingArrays = await Promise.all(
    propList.map(async (p) => {
      try {
        const bRes = await getBuildingsByProperty(p.propertyId || p.id)
        const list = Array.isArray(bRes?.data)
          ? bRes.data
          : Array.isArray(bRes)
          ? bRes
          : []
        return list.map((b) => ({
          ...b,
          propertyName: p.propertyName || p.name,
          propertyId: p.propertyId || p.id,
        }))
      } catch (err) {
        return []
      }
    })
  )
  return buildingArrays.flat()
}

export const getBuildingByIdForManager = async (buildingId) => {
  return getBuildingById(buildingId)
}

export const getBuildingsForTenant = async (user) => {
  const context = await resolveTenantRentalContext()
  return context?.buildings || []
}

export const getTenantRentalContext = async (user) => {
  return resolveTenantRentalContext()
}

export const getBuildingByIdForTenant = async (buildingId) => {
  const context = await resolveTenantRentalContext()
  return (
    (context?.buildings || []).find(
      (b) => String(b.buildingId || b.id) === String(buildingId)
    ) || null
  )
}
