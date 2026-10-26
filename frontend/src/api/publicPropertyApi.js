import {
  getPublicProperties as getProperties,
  searchPublicProperties as searchProperties,
  getPublicPropertyDetails as getPropertyDetails,
} from './propertyApi.js'

export const getPublicProperties = () => getProperties({ skipAuthToken: true })

export const searchPublicProperties = (filters) =>
  searchProperties(filters, { skipAuthToken: true })

export const getPublicPropertyDetails = (propertyId) =>
  getPropertyDetails(propertyId, { skipAuthToken: true })