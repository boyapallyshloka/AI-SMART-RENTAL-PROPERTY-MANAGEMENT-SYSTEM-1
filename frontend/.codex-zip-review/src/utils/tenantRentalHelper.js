import { getMyAgreements } from '../api/agreementApi'
import { getMyApplications } from '../api/applicationApi'
import { getPropertyDetails } from '../api/propertyApi'

let cachedRentalContext = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 10000 // 10 seconds cache to optimize drill-down

const optionalNumber = (value) => {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export const clearTenantRentalCache = () => {
  cachedRentalContext = null
  cacheTimestamp = 0
}

/**
 * Resolves the authenticated tenant's real rental context:
 * 1. Concurrently fetches tenant's agreements and applications
 * 2. Identifies active agreement or approved application to get unitId & propertyId
 * 3. Fetches authorized property details (GET /api/owner/properties/{id}/details)
 * 4. Extracts nested buildings, floors, and units
 */
export const resolveTenantRentalContext = async ({ forceRefresh = false } = {}) => {
  const now = Date.now()
  if (!forceRefresh && cachedRentalContext && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedRentalContext
  }

  // 1. Fetch agreements and applications
  const [agreementsRes, appsRes] = await Promise.allSettled([
    getMyAgreements(),
    getMyApplications(),
  ])

  if (agreementsRes.status === 'rejected' && appsRes.status === 'rejected') {
    const err = agreementsRes.reason || appsRes.reason
    throw err
  }

  const rawAgreements =
    agreementsRes.status === 'fulfilled'
      ? Array.isArray(agreementsRes.value)
        ? agreementsRes.value
        : agreementsRes.value?.data || []
      : []

  const rawApps =
    appsRes.status === 'fulfilled'
      ? Array.isArray(appsRes.value)
        ? appsRes.value
        : appsRes.value?.data || []
      : []

  const appMap = new Map()
  rawApps.forEach((a) => {
    if (a && a.applicationId) {
      appMap.set(Number(a.applicationId), a)
    }
  })

  // Prioritize ACTIVE agreement, then any agreement
  const activeAgreement =
    rawAgreements.find(
      (a) => String(a.status || '').toUpperCase() === 'ACTIVE'
    ) || rawAgreements[0] || null

  let matchedApp = activeAgreement?.applicationId
    ? appMap.get(Number(activeAgreement.applicationId))
    : null

  // If no agreement or no matched app, check for an APPROVED application
  if (!activeAgreement && !matchedApp) {
    matchedApp =
      rawApps.find(
        (a) => String(a.status || '').toUpperCase() === 'APPROVED'
      ) || null
  }

  // Resolve propertyId
  let resolvedPropertyId =
    matchedApp?.propertyId || activeAgreement?.propertyId || null

  if (!resolvedPropertyId) {
    // No active rental or property associated with tenant
    cachedRentalContext = null
    cacheTimestamp = now
    return null
  }

  // 2. Fetch authorized property details & nested buildings/floors/units
  let propertyDetails = null
  try {
    const propRes = await getPropertyDetails(resolvedPropertyId)
    propertyDetails = propRes?.data || propRes
  } catch (propErr) {
    console.error(`Could not fetch details for property ${resolvedPropertyId}:`, propErr)
    throw propErr
  }

  const propObj =
    propertyDetails?.property ||
    (propertyDetails?.propertyName ? propertyDetails : null) ||
    {}
  const addrObj = propertyDetails?.address || null

  const rawBuildings = Array.isArray(propertyDetails?.buildings)
    ? propertyDetails.buildings
    : []

  const allUnits = []
  const mappedBuildings = rawBuildings.map((item) => {
    const b = item.building || item
    const rawFloors = item.floors || []

    const mappedFloors = rawFloors.map((fItem) => {
      const f = fItem.floor || fItem
      const rawUnits = fItem.units || []

      const mappedUnits = rawUnits.map((u) => {
        const mappedUnit = {
          ...u,
          id: u.unitId ?? u.id,
          unitId: u.unitId ?? u.id,
          unitNumber: u.unitNumber ?? u.number ?? '',
          unitType: u.unitType ?? u.type ?? null,
          status: u.status ?? null,
          monthlyRent: optionalNumber(u.monthlyRent ?? u.rentAmount ?? u.rent),
          securityDeposit: optionalNumber(u.securityDeposit ?? u.deposit),
          area: optionalNumber(u.area),
          bedrooms: optionalNumber(u.bedrooms),
          bathrooms: optionalNumber(u.bathrooms),
          description: u.description ?? '',
          floorId: f.floorId ?? f.id,
          floorName: f.floorName ?? f.name,
          floorNumber: f.floorNumber ?? f.number ?? null,
          buildingId: b.buildingId ?? b.id,
          buildingName: b.buildingName ?? b.name,
          propertyId: resolvedPropertyId,
          propertyName: propObj.propertyName || propObj.name || matchedApp?.propertyName || null,
          floor: {
            floorId: f.floorId ?? f.id,
            floorName: f.floorName ?? f.name,
            floorNumber: f.floorNumber ?? f.number ?? null,
            building: {
              buildingId: b.buildingId ?? b.id,
              buildingName: b.buildingName ?? b.name,
              property: propObj,
            },
          },
        }
        allUnits.push(mappedUnit)
        return mappedUnit
      })

      return {
        ...f,
        id: f.floorId ?? f.id,
        floorId: f.floorId ?? f.id,
        name: f.floorName ?? f.name,
        floorName: f.floorName ?? f.name,
        floorNumber: f.floorNumber ?? f.number ?? null,
        buildingId: b.buildingId ?? b.id,
        buildingName: b.buildingName ?? b.name,
        propertyId: resolvedPropertyId,
        propertyName: propObj.propertyName || propObj.name || matchedApp?.propertyName || null,
        units: mappedUnits,
      }
    })

    const calculatedUnits = mappedFloors.reduce(
      (acc, f) => acc + (f.units?.length || 0),
      0
    )

    return {
      ...b,
      id: b.buildingId ?? b.id,
      buildingId: b.buildingId ?? b.id,
      buildingName: b.buildingName ?? b.name,
      totalFloors: b.totalFloors ?? mappedFloors.length,
      totalUnits: b.totalUnits ?? calculatedUnits,
      description: b.description || '',
      propertyId: resolvedPropertyId,
      propertyName: propObj.propertyName || propObj.name || matchedApp?.propertyName || null,
      property: propObj,
      floors: mappedFloors,
    }
  })

  // Current leased unit identifier
  const resolvedUnitId = activeAgreement?.unitId || matchedApp?.unitId || null
  const currentUnit = allUnits.find((u) => String(u.unitId) === String(resolvedUnitId)) || null

  const currentBuilding =
    mappedBuildings.find(
      (b) =>
        (matchedApp?.buildingId && String(b.buildingId) === String(matchedApp.buildingId)) ||
        (currentUnit?.buildingId && String(b.buildingId) === String(currentUnit.buildingId))
    ) || null

  const formattedAddress = addrObj
    ? [addrObj.street, addrObj.city, addrObj.state, addrObj.postalCode]
        .filter(Boolean)
        .join(', ')
    : ''

  const myRental = {
    propertyId: resolvedPropertyId,
    property: {
      id: resolvedPropertyId,
      propertyId: resolvedPropertyId,
      name: propObj.propertyName || propObj.name || matchedApp?.propertyName || null,
      propertyName: propObj.propertyName || propObj.name || matchedApp?.propertyName || null,
      type: propObj.propertyType || propObj.type || null,
      description: propObj.description || '',
      address: addrObj?.street || '',
      city: addrObj?.city || '',
      state: addrObj?.state || '',
      postalCode: addrObj?.postalCode || '',
      country: addrObj?.country || '',
      formattedAddress,
    },
    address: addrObj,
    formattedAddress,
    leaseSummary: {
      unitId: resolvedUnitId,
      unitNumber:
        currentUnit?.unitNumber ||
        (matchedApp?.unitNumber ? String(matchedApp.unitNumber) : null) ||
        (resolvedUnitId ? String(resolvedUnitId) : null),
      status: activeAgreement?.status
        ? `${activeAgreement.status} Lease`
        : matchedApp?.status
        ? `${matchedApp.status} Application`
        : null,
      startDate: activeAgreement?.startDate || null,
      endDate: activeAgreement?.endDate || null,
      monthlyRent: activeAgreement?.monthlyRent || matchedApp?.monthlyRent || currentUnit?.monthlyRent || null,
      securityDeposit: activeAgreement?.securityDeposit || matchedApp?.securityDeposit || currentUnit?.securityDeposit || null,
    },
    currentUnitId: resolvedUnitId,
    currentUnit,
    currentBuilding,
    buildings: mappedBuildings,
  }

  const contextResult = {
    propertyId: resolvedPropertyId,
    propertyDetails,
    property: myRental.property,
    address: addrObj,
    formattedAddress,
    myRental,
    buildings: mappedBuildings,
    allUnits,
    activeAgreement,
    matchedApp,
    currentUnitId: resolvedUnitId,
    currentBuilding,
  }

  cachedRentalContext = contextResult
  cacheTimestamp = now
  return contextResult
}

/**
 * Helper to fetch building details for a tenant from their real rental property
 */
export const getTenantBuildingDetails = async (buildingId, options = {}) => {
  const context = await resolveTenantRentalContext(options)
  if (!context) {
    return { building: null, floors: [], floorUnitsMap: {}, myRental: null }
  }

  const building = context.buildings.find(
    (b) => String(b.buildingId) === String(buildingId)
  )

  if (!building) {
    return { building: null, floors: [], floorUnitsMap: {}, myRental: context.myRental }
  }

  const floors = building.floors || []
  const floorUnitsMap = {}
  floors.forEach((f) => {
    floorUnitsMap[f.floorId] = f.units || []
  })

  return {
    building,
    floors,
    floorUnitsMap,
    property: context.property,
    address: context.address,
    myRental: context.myRental,
  }
}

/**
 * Helper to fetch floor details for a tenant from their real rental property
 */
export const getTenantFloorDetails = async (buildingId, floorId, options = {}) => {
  const context = await resolveTenantRentalContext(options)
  if (!context) {
    return { floor: null, building: null, units: [], myRental: null }
  }

  const building = context.buildings.find(
    (b) => String(b.buildingId) === String(buildingId)
  )

  if (!building) {
    return { floor: null, building: null, units: [], myRental: context.myRental }
  }

  const floor = (building.floors || []).find(
    (f) => String(f.floorId) === String(floorId)
  )

  if (!floor) {
    return { floor: null, building, units: [], myRental: context.myRental }
  }

  return {
    floor,
    building,
    units: floor.units || [],
    property: context.property,
    address: context.address,
    myRental: context.myRental,
  }
}

/**
 * Helper to fetch unit details for a tenant from their real rental property
 */
export const getTenantUnitDetails = async (unitId, options = {}) => {
  const context = await resolveTenantRentalContext(options)
  if (!context) {
    return { unit: null, myRental: null, isCurrentRentedUnit: false }
  }

  const unit = context.allUnits.find(
    (u) => String(u.unitId) === String(unitId)
  )

  if (!unit) {
    return { unit: null, myRental: context.myRental, isCurrentRentedUnit: false }
  }

  const isCurrentRentedUnit =
    String(unit.unitId) === String(context.currentUnitId)

  return {
    unit,
    myRental: context.myRental,
    isCurrentRentedUnit,
  }
}
