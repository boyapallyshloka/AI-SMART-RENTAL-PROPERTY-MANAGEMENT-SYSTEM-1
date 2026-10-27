import axiosClient from './axiosClient.js'
import { resolveTenantRentalContext } from '../utils/tenantRentalHelper.js'

/**
 * Floor API Service Layer (Spring Boot Integration)
 * Controller: FloorController (/api/floors)
 * Role: PROPERTY_OWNER, PROPERTY_MANAGER
 */

export const ALLOWED_FLOOR_FIELDS = [
  'floorName',
  'floorNumber',
  'buildingId',
]

/**
 * Formats and sanitizes FloorRequest payload matching Spring Boot DTO constraints:
 * - floorName: String (@NotBlank)
 * - floorNumber: Integer (@NotNull, @PositiveOrZero)
 * - buildingId: Long (@NotNull)
 *
 * Strictly ensures:
 * - Normalizes frontend field aliases (name/floor -> floorName, number -> floorNumber)
 * - Normalizes nested building data (building.id / building.buildingId -> buildingId)
 * - Ensures numeric values for floorNumber and buildingId (preserving valid 0)
 * - Does NOT convert invalid numbers into NaN
 * - Strictly strips response and UI fields (floorId, id, building, buildingName, propertyId, propertyName, createdAt, updatedAt, ownerId, etc.)
 */
export const formatFloorRequest = (data = {}) => {
  const rawName =
    data.floorName !== undefined
      ? data.floorName
      : data.name !== undefined
      ? data.name
      : data.floor !== undefined
      ? data.floor
      : undefined

  const floorName =
    rawName != null && String(rawName).trim() !== ''
      ? String(rawName).trim()
      : undefined

  let floorNumber = undefined
  const rawFloorNumber =
    data.floorNumber !== undefined ? data.floorNumber : data.number
  if (
    rawFloorNumber !== undefined &&
    rawFloorNumber !== null &&
    rawFloorNumber !== ''
  ) {
    const num = Number(rawFloorNumber)
    if (!Number.isNaN(num)) {
      floorNumber = num
    }
  }

  let buildingId = undefined
  const rawBuildingId =
    data.buildingId !== undefined
      ? data.buildingId
      : data.building?.id !== undefined
      ? data.building.id
      : data.building?.buildingId !== undefined
      ? data.building.buildingId
      : undefined
  if (
    rawBuildingId !== undefined &&
    rawBuildingId !== null &&
    rawBuildingId !== ''
  ) {
    const bId = Number(rawBuildingId)
    if (!Number.isNaN(bId)) {
      buildingId = bId
    }
  }

  const payload = {
    floorName,
    floorNumber,
    buildingId,
  }

  // Explicitly remove forbidden response and UI fields
  delete payload.floorId
  delete payload.id
  delete payload.building
  delete payload.buildingName
  delete payload.propertyId
  delete payload.propertyName
  delete payload.createdAt
  delete payload.updatedAt
  delete payload.ownerId

  return Object.fromEntries(
    Object.entries(payload).filter(([_, v]) => v !== undefined)
  )
}

// POST /api/floors
export const createFloor = async (floorData) => {
  const payload = formatFloorRequest(floorData)
  return axiosClient.post('/floors', payload)
}

// GET /api/floors/building/{buildingId}
export const getFloorsByBuilding = async (buildingId) => {
  return axiosClient.get(`/floors/building/${buildingId}`)
}

// GET /api/floors/{floorId}
export const getFloorById = async (floorId) => {
  return axiosClient.get(`/floors/${floorId}`)
}

// PUT /api/floors/{floorId}
export const updateFloor = async (floorId, floorData) => {
  const payload = formatFloorRequest(floorData)
  return axiosClient.put(`/floors/${floorId}`, payload)
}

// DELETE /api/floors/{floorId}
export const deleteFloor = async (floorId) => {
  return axiosClient.delete(`/floors/${floorId}`)
}

// ============================================================================
// UI Compatibility Helpers (Powered by Real Backend APIs)
// ============================================================================

export const getAllFloors = async () => {
  return []
}

export const getFloorsForManager = async (buildingId) => {
  return getFloorsByBuilding(buildingId)
}

export const getFloorByIdForManager = async (floorId) => {
  return getFloorById(floorId)
}

export const getFloorsForTenant = async (buildingId) => {
  const context = await resolveTenantRentalContext()
  const bld = (context?.buildings || []).find(
    (b) => String(b.buildingId || b.id) === String(buildingId)
  )
  return bld?.floors || []
}

export const getFloorByIdForTenant = async (floorId) => {
  const context = await resolveTenantRentalContext()
  for (const b of context?.buildings || []) {
    const f = (b.floors || []).find(
      (fl) => String(fl.floorId || fl.id) === String(floorId)
    )
    if (f) return f
  }
  return null
}
