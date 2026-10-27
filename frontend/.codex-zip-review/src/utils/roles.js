/**
 * Canonical user roles matching Spring Boot backend RoleType enum
 */
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  PROPERTY_OWNER: 'PROPERTY_OWNER',
  PROPERTY_MANAGER: 'PROPERTY_MANAGER',
  TENANT: 'TENANT',
}

/**
 * Normalizes any role input (legacy or backend) to the canonical Spring Boot role enum.
 * @param {string} role
 * @returns {string} Canonical role string
 */
export function normalizeRole(role) {
  if (!role) return ROLES.TENANT
  const r = String(role).toUpperCase().trim()
  if (r === 'SUPER_ADMIN' || r === 'ADMIN' || r === 'SUPERADMIN') return ROLES.SUPER_ADMIN
  if (r === 'PROPERTY_OWNER' || r === 'OWNER') return ROLES.PROPERTY_OWNER
  if (r === 'PROPERTY_MANAGER' || r === 'MANAGER') return ROLES.PROPERTY_MANAGER
  if (r === 'TENANT') return ROLES.TENANT
  return r
}

/**
 * Returns the human-readable label for a role.
 * @param {string} role
 * @returns {string}
 */
export function getRoleLabel(role) {
  const normalized = normalizeRole(role)
  switch (normalized) {
    case ROLES.SUPER_ADMIN:
      return 'Super Admin'
    case ROLES.PROPERTY_OWNER:
      return 'Property Owner'
    case ROLES.PROPERTY_MANAGER:
      return 'Property Manager'
    case ROLES.TENANT:
      return 'Verified Tenant'
    default:
      return 'User'
  }
}

/**
 * Returns portal title for sidebar / layout views.
 * Mapping:
 * SUPER_ADMIN → Admin Portal
 * PROPERTY_OWNER → Owner Portal
 * PROPERTY_MANAGER → Manager Portal
 * TENANT → Tenant Portal
 *
 * @param {string} role
 * @returns {string}
 */
export function getPortalName(role) {
  const normalized = normalizeRole(role)
  switch (normalized) {
    case ROLES.SUPER_ADMIN:
      return 'Admin Portal'
    case ROLES.PROPERTY_OWNER:
      return 'Owner Portal'
    case ROLES.PROPERTY_MANAGER:
      return 'Manager Portal'
    case ROLES.TENANT:
      return 'Tenant Portal'
    default:
      return `${role} Portal`
  }
}

/**
 * Returns the primary dashboard destination path for a given role.
 * Mapping:
 * SUPER_ADMIN → /admin/dashboard
 * PROPERTY_OWNER → /owner/dashboard
 * PROPERTY_MANAGER → /manager/dashboard
 * TENANT → /tenant/dashboard
 *
 * @param {string} role
 * @returns {string}
 */
export function getDashboardPath(role) {
  const normalized = normalizeRole(role)
  switch (normalized) {
    case ROLES.SUPER_ADMIN:
      return '/admin/dashboard'
    case ROLES.PROPERTY_OWNER:
      return '/owner/dashboard'
    case ROLES.PROPERTY_MANAGER:
      return '/manager/dashboard'
    case ROLES.TENANT:
      return '/tenant/dashboard'
    default:
      return '/tenant/dashboard'
  }
}

/**
 * Check if the role is SUPER_ADMIN
 * @param {string} role
 * @returns {boolean}
 */
export function isSuperAdmin(role) {
  return normalizeRole(role) === ROLES.SUPER_ADMIN
}

/**
 * Check if the role is PROPERTY_OWNER
 * @param {string} role
 * @returns {boolean}
 */
export function isPropertyOwner(role) {
  return normalizeRole(role) === ROLES.PROPERTY_OWNER
}

/**
 * Check if the role is PROPERTY_MANAGER
 * @param {string} role
 * @returns {boolean}
 */
export function isPropertyManager(role) {
  return normalizeRole(role) === ROLES.PROPERTY_MANAGER
}

/**
 * Check if the role is TENANT
 * @param {string} role
 * @returns {boolean}
 */
export function isTenant(role) {
  return normalizeRole(role) === ROLES.TENANT
}

/**
 * Check if the role is either PROPERTY_OWNER or PROPERTY_MANAGER
 * @param {string} role
 * @returns {boolean}
 */
export function isOwnerOrManager(role) {
  const n = normalizeRole(role)
  return n === ROLES.PROPERTY_OWNER || n === ROLES.PROPERTY_MANAGER
}
