import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Loader from '../components/ui/Loader'
import { ROLES, normalizeRole, getDashboardPath } from '../utils/roles'

/**
 * Route wrapper that enforces role-based access using Spring Boot backend roles
 * Allows managers to access owner routes per requirements
 * @param {Object} props
 * @param {string | string[]} props.allowedRole
 * @param {React.ReactNode} [props.children]
 */
export default function RoleRoute({ allowedRole, children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader size="lg" text="Checking permissions..." center />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const allowedList = (Array.isArray(allowedRole) ? allowedRole : [allowedRole]).map(normalizeRole)
  const canonicalUserRole = normalizeRole(user.role)

  const isAllowed = allowedList.includes(canonicalUserRole)

  if (!isAllowed) {
    // Redirect unauthorized user to their respective valid dashboard
    const fallbackPath = getDashboardPath(canonicalUserRole)
    return <Navigate to={fallbackPath} replace />
  }

  return children ? children : <Outlet />
}
