import axiosClient from './axiosClient.js'

/**
 * Property Image API Service (Spring Boot Integration)
 * Controller: PropertyImageController (/api/property-images)
 * Role: PROPERTY_OWNER
 */

export const ALLOWED_IMAGE_FIELDS = ['file', 'imageType', 'isPrimary']

/**
 * Constructs multipart FormData containing ONLY backend-supported image fields:
 * - file (File or Blob)
 * - imageType (String, optional)
 * - isPrimary (Boolean, optional)
 *
 * Strictly omits propertyId, imageId, propertyName, createdAt, updatedAt,
 * imageUrl, ownerId, and any unrelated fields.
 */
export const buildImageFormData = (data = {}) => {
  const FormDataClass = globalThis?.FormData
  if (typeof FormDataClass !== 'function') {
    throw new Error('This browser does not support multipart form uploads.')
  }

  const isFormDataInstance = data instanceof FormDataClass

  if (isFormDataInstance) {
    if (typeof data.has === 'function') {
      const sanitized = new FormDataClass()
      if (data.has('file') && data.get('file')) {
        sanitized.append('file', data.get('file'))
      }
      if (data.has('imageType') && data.get('imageType') != null) {
        sanitized.append('imageType', String(data.get('imageType')).trim())
      }
      if (
        data.has('isPrimary') &&
        data.get('isPrimary') !== null &&
        data.get('isPrimary') !== undefined
      ) {
        sanitized.append('isPrimary', data.get('isPrimary'))
      }
      return sanitized
    }
    return data
  }

  const fd = new FormDataClass()
  if (data.file) {
    fd.append('file', data.file)
  }
  if (data.imageType != null && String(data.imageType).trim() !== '') {
    fd.append('imageType', String(data.imageType).trim())
  }
  if (data.isPrimary !== undefined && data.isPrimary !== null) {
    fd.append('isPrimary', Boolean(data.isPrimary))
  }

  return fd
}

/**
 * Upload an image for a property using FormData (multipart/form-data)
 * POST /api/property-images/{propertyId}
 * Note: propertyId belongs in URL, not FormData.
 * Content-Type is not manually set; browser/axios sets multipart boundary.
 *
 * @param {number|string} propertyId
 * @param {FormData|Object} payload - FormData or { file, imageType, isPrimary }
 */
export const uploadImage = async (propertyId, payload) => {
  const formData = buildImageFormData(payload)
  return axiosClient.post(`/property-images/${propertyId}`, formData)
}

// GET /api/property-images/property/{propertyId}
export const getImagesByProperty = async (propertyId) => {
  return axiosClient.get(`/property-images/property/${propertyId}`)
}

// GET /api/property-images/{imageId}
export const getImageById = async (imageId) => {
  return axiosClient.get(`/property-images/${imageId}`)
}

/**
 * Update an existing image using FormData (multipart/form-data)
 * PUT /api/property-images/{imageId}
 *
 * @param {number|string} imageId
 * @param {FormData|Object} payload - FormData or { file, imageType, isPrimary }
 */
export const updateImage = async (imageId, payload) => {
  const formData = buildImageFormData(payload)
  return axiosClient.put(`/property-images/${imageId}`, formData)
}

// DELETE /api/property-images/{imageId}
export const deleteImage = async (imageId) => {
  return axiosClient.delete(`/property-images/${imageId}`)
}

