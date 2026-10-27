import axiosClient from './axiosClient.js'
import { getFloorsByBuilding } from './floorApi.js'
import { getPublicProperties, getPublicPropertyDetails } from './propertyApi.js'
import { resolveTenantRentalContext } from '../utils/tenantRentalHelper.js'

/**
 * Unit API Service Layer (Spring Boot Integration)
 * Controller: UnitController (/api/units)
 * Role: PROPERTY_OWNER, PROPERTY_MANAGER
 */

export const ALLOWED_UNIT_FIELDS = [
  'unitNumber',
  'unitType',
  'area',
  'bedrooms',
  'bathrooms',
  'monthlyRent',
  'securityDeposit',
  'status',
  'description',
  'floorId',
]

/**
 * Canonical Unit Enums matching backend UnitType & UnitStatus.
 * Defined as iterable arrays with named properties for backward compatibility
 * with existing UI components calling .map() while supporting object key access.
 */
export const UNIT_TYPES = Object.assign(['APARTMENT', 'ROOM'], {
  APARTMENT: 'APARTMENT',
  ROOM: 'ROOM',
})

export const UNIT_STATUSES = Object.assign(
  ['VACANT', 'OCCUPIED', 'RESERVED', 'MAINTENANCE'],
  {
    VACANT: 'VACANT',
    OCCUPIED: 'OCCUPIED',
    RESERVED: 'RESERVED',
    MAINTENANCE: 'MAINTENANCE',
  }
)

export const CANONICAL_UNIT_TYPES = {
  APARTMENT: 'APARTMENT',
  ROOM: 'ROOM',
}

export const CANONICAL_UNIT_STATUSES = {
  VACANT: 'VACANT',
  OCCUPIED: 'OCCUPIED',
  RESERVED: 'RESERVED',
  MAINTENANCE: 'MAINTENANCE',
}

/**
 * Formats and sanitizes UnitRequest payload matching Spring Boot DTO constraints:
 * - unitNumber: String (@NotBlank)
 * - unitType: UnitType (@NotNull: APARTMENT | ROOM)
 * - area: Double (@PositiveOrZero)
 * - bedrooms: Integer (@PositiveOrZero)
 * - bathrooms: Integer (@PositiveOrZero)
 * - monthlyRent: BigDecimal (@NotNull, @DecimalMin(0.0))
 * - securityDeposit: BigDecimal (@NotNull, @DecimalMin(0.0))
 * - status: UnitStatus (VACANT | OCCUPIED | RESERVED | MAINTENANCE)
 * - description: String
 * - floorId: Long (@NotNull)
 *
 * Strictly ensures:
 * - Normalizes frontend field aliases (number -> unitNumber, type -> unitType, rent -> monthlyRent, deposit -> securityDeposit)
 * - Normalizes nested floor data (floor.id / floor.floorId -> floorId)
 * - Ensures numeric values for area, bedrooms, bathrooms, monthlyRent, securityDeposit, floorId (preserving valid 0)
 * - Does NOT convert invalid numbers into NaN
 * - Strictly strips response and UI fields (unitId, id, floor, floorName, floorNumber, building, buildingId, buildingName, property, propertyId, propertyName, ownerId, createdAt, updatedAt, etc.)
 */
export const formatUnitRequest = (data = {}) => {
  const rawUnitNumber =
    data.unitNumber !== undefined ? data.unitNumber : data.number
  const unitNumber =
    rawUnitNumber != null && String(rawUnitNumber).trim() !== ''
      ? String(rawUnitNumber).trim()
      : undefined

  const rawUnitType =
    data.unitType !== undefined ? data.unitType : data.type
  const unitType =
    rawUnitType != null && String(rawUnitType).trim() !== ''
      ? String(rawUnitType).trim().toUpperCase()
      : undefined

  let area = undefined
  if (data.area !== undefined && data.area !== null && data.area !== '') {
    const num = Number(data.area)
    if (!Number.isNaN(num)) {
      area = num
    }
  }

  let bedrooms = undefined
  if (data.bedrooms !== undefined && data.bedrooms !== null && data.bedrooms !== '') {
    const num = Number(data.bedrooms)
    if (!Number.isNaN(num)) {
      bedrooms = num
    }
  }

  let bathrooms = undefined
  if (data.bathrooms !== undefined && data.bathrooms !== null && data.bathrooms !== '') {
    const num = Number(data.bathrooms)
    if (!Number.isNaN(num)) {
      bathrooms = num
    }
  }

  let monthlyRent = undefined
  const rawRent =
    data.monthlyRent !== undefined ? data.monthlyRent : data.rent
  if (rawRent !== undefined && rawRent !== null && rawRent !== '') {
    const num = Number(rawRent)
    if (!Number.isNaN(num)) {
      monthlyRent = num
    }
  }

  let securityDeposit = undefined
  const rawDeposit =
    data.securityDeposit !== undefined ? data.securityDeposit : data.deposit
  if (rawDeposit !== undefined && rawDeposit !== null && rawDeposit !== '') {
    const num = Number(rawDeposit)
    if (!Number.isNaN(num)) {
      securityDeposit = num
    }
  }

  const rawStatus = data.status
  const status =
    rawStatus != null && String(rawStatus).trim() !== ''
      ? String(rawStatus).trim().toUpperCase()
      : undefined

  const description =
    data.description !== undefined && data.description !== null
      ? String(data.description).trim()
      : undefined

  let floorId = undefined
  const rawFloorId =
    data.floorId !== undefined
      ? data.floorId
      : data.floor?.id !== undefined
      ? data.floor.id
      : data.floor?.floorId !== undefined
      ? data.floor.floorId
      : undefined
  if (rawFloorId !== undefined && rawFloorId !== null && rawFloorId !== '') {
    const num = Number(rawFloorId)
    if (!Number.isNaN(num)) {
      floorId = num
    }
  }

  const payload = {
    unitNumber,
    unitType,
    area,
    bedrooms,
    bathrooms,
    monthlyRent,
    securityDeposit,
    status,
    description,
    floorId,
  }

  // Explicitly remove forbidden response, entity, and UI fields
  delete payload.unitId
  delete payload.id
  delete payload.floor
  delete payload.floorName
  delete payload.floorNumber
  delete payload.building
  delete payload.buildingId
  delete payload.buildingName
  delete payload.property
  delete payload.propertyId
  delete payload.propertyName
  delete payload.ownerId
  delete payload.createdAt
  delete payload.updatedAt

  return Object.fromEntries(
    Object.entries(payload).filter(([_, v]) => v !== undefined)
  )
}

// POST /api/units
export const createUnit = async (unitData) => {
  const payload = formatUnitRequest(unitData)
  return axiosClient.post('/units', payload)
}

// GET /api/units/floor/{floorId}
export const getUnitsByFloor = async (floorId) => {
  return axiosClient.get(`/units/floor/${floorId}`)
}

// GET /api/units/{unitId}
export const getUnitById = async (unitId) => {
  return axiosClient.get(`/units/${unitId}`)
}

// PUT /api/units/{unitId}
export const updateUnit = async (unitId, unitData) => {
  const payload = formatUnitRequest(unitData)
  return axiosClient.put(`/units/${unitId}`, payload)
}

// DELETE /api/units/{unitId}
export const deleteUnit = async (unitId) => {
  return axiosClient.delete(`/units/${unitId}`)
}

// ============================================================================
// UI Compatibility Helpers (Powered by Real Backend APIs)
// ============================================================================

export const getUnitsByBuilding = async (buildingId) => {
  const fRes = await getFloorsByBuilding(buildingId)
  const flrs = Array.isArray(fRes?.data) ? fRes.data : Array.isArray(fRes) ? fRes : []
  const unitArrays = await Promise.all(
    flrs.map(async (f) => {
      try {
        const uRes = await getUnitsByFloor(f.floorId || f.id)
        return Array.isArray(uRes?.data) ? uRes.data : Array.isArray(uRes) ? uRes : []
      } catch (e) {
        return []
      }
    })
  )
  return unitArrays.flat()
}

export const getAllUnits = async () => {
  return []
}

export const getUnitsForManager = async (floorId) => {
  return getUnitsByFloor(floorId)
}

export const getUnitByIdForManager = async (unitId) => {
  return getUnitById(unitId)
}

export const getUnitsForTenant = async (floorId) => {
  const context = await resolveTenantRentalContext()
  for (const b of context?.buildings || []) {
    for (const f of b.floors || []) {
      if (String(f.floorId || f.id) === String(floorId)) {
        return f.units || []
      }
    }
  }
  return []
}

export const getUnitByIdForTenant = async (unitId) => {
  const context = await resolveTenantRentalContext()
  for (const b of context?.buildings || []) {
    for (const f of b.floors || []) {
      for (const u of f.units || []) {
        if (String(u.unitId || u.id) === String(unitId)) {
          return u
        }
      }
    }
  }
  return null
}

export const getAvailableUnits = async (user) => {
  try {
    const props = await getPublicProperties()
    const propList = Array.isArray(props) ? props : []
    const unitLists = await Promise.all(
      propList.map(async (p) => {
        try {
          const details = await getPublicPropertyDetails(p.propertyId || p.id)
          const data = details?.data || details
          const units = []
          if (Array.isArray(data?.buildings)) {
            for (const b of data.buildings) {
              if (Array.isArray(b?.floors)) {
                for (const f of b.floors) {
                  if (Array.isArray(f?.units)) {
                    for (const u of f.units) {
                      if (String(u.status || '').toUpperCase() === 'VACANT') {
                        units.push({
                          ...u,
                          unitId: u.unitId ?? u.id,
                          id: u.unitId ?? u.id,
                          unitNumber: u.unitNumber ?? u.number,
                          unitType: u.unitType ?? u.type ?? null,
                          monthlyRent: u.monthlyRent ?? u.rent ?? null,
                          securityDeposit: u.securityDeposit ?? u.deposit ?? null,
                          area: u.area ?? null,
                          bedrooms: u.bedrooms ?? null,
                          bathrooms: u.bathrooms ?? null,
                          status: 'VACANT',
                          floor: {
                            floorId: f.floorId ?? f.id,
                            id: f.floorId ?? f.id,
                            floorName: f.floorName ?? f.name,
                            floorNumber: f.floorNumber ?? f.number,
                            building: {
                              buildingId: b.buildingId ?? b.id,
                              id: b.buildingId ?? b.id,
                              buildingName: b.buildingName ?? b.name,
                              property: {
                                propertyId: p.propertyId || p.id,
                                id: p.propertyId || p.id,
                                name: p.propertyName || p.name,
                                propertyName: p.propertyName || p.name,
                                address: p.address,
                                city: p.city,
                              },
                            },
                          },
                        })
                      }
                    }
                  }
                }
              }
            }
          }
          return units
        } catch (e) {
          return []
        }
      })
    )
    return unitLists.flat()
  } catch (err) {
    console.error('Error fetching available units:', err)
    return []
  }
}

export const getAvailableProperties = async (user) => {
  try {
    const props = await getPublicProperties()
    const propList = Array.isArray(props) ? props : []
    return propList.map((p) => ({
      property: {
        id: p.propertyId || p.id,
        propertyId: p.propertyId || p.id,
        name: p.propertyName || p.name,
        propertyName: p.propertyName || p.name,
        address: p.address,
        city: p.city,
        type: p.propertyType || p.type,
      },
    }))
  } catch (err) {
    console.error('Error fetching available properties:', err)
    return []
  }
}
