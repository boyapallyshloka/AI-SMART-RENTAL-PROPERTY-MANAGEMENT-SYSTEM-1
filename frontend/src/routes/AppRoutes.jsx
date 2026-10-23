import React from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Auth Pages
import LoginPage from '../pages/auth/LoginPage'
import RegisterPage from '../pages/auth/RegisterPage'
import VerifyEmailPage from '../pages/auth/VerifyEmailPage'
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage'
import ResetPasswordPage from '../pages/auth/ResetPasswordPage'

// Owner & Manager Dashboard Pages
import OwnerDashboardPage from '../pages/owner/OwnerDashboardPage'
import PropertiesPage from '../pages/owner/PropertiesPage'
import AddPropertyPage from '../pages/owner/AddPropertyPage'
import PropertyDetailsPage from '../pages/owner/PropertyDetailsPage'
import EditPropertyPage from '../pages/owner/EditPropertyPage'
import BuildingsPage from '../pages/owner/BuildingsPage'
import AddBuildingPage from '../pages/owner/AddBuildingPage'
import BuildingDetailsPage from '../pages/owner/BuildingDetailsPage'
import FloorDetailsPage from '../pages/owner/FloorDetailsPage'
import AddUnitPage from '../pages/owner/AddUnitPage'
import UnitDetailsPage from '../pages/owner/UnitDetailsPage'
import ApplicationsPage from '../pages/owner/ApplicationsPage'
import ApplicationDetailsPage from '../pages/owner/ApplicationDetailsPage'
import PaymentsPage from '../pages/owner/PaymentsPage'
import PaymentDetailsPage from '../pages/owner/PaymentDetailsPage'
import MaintenancePage from '../pages/owner/MaintenancePage'
import MaintenanceDetailsPage from '../pages/owner/MaintenanceDetailsPage'
import ReportsPage from '../pages/owner/ReportsPage'
import AIInsightsPage from '../pages/owner/AIInsightsPage'
import AgreementsPage from '../pages/owner/AgreementsPage'
import CreateAgreementPage from '../pages/owner/CreateAgreementPage'
import OwnerProfilePage from '../pages/owner/OwnerProfilePage'

// Tenant Dashboard Pages
import TenantDashboardPage from '../pages/tenant/TenantDashboardPage'
import TenantApplicationsPage from '../pages/tenant/TenantApplicationsPage'
import SubmitApplicationPage from '../pages/tenant/SubmitApplicationPage'
import TenantAgreementPage from '../pages/tenant/TenantAgreementPage'
import TenantPaymentsPage from '../pages/tenant/TenantPaymentsPage'
import TenantMaintenancePage from '../pages/tenant/TenantMaintenancePage'
import CreateMaintenanceRequestPage from '../pages/tenant/CreateMaintenanceRequestPage'
import FindPropertiesPage from '../pages/tenant/FindPropertiesPage'
import PropertySearchPage from '../pages/tenant/PropertySearchPage'
import TenantPropertyDetailsPage from '../pages/tenant/PropertyDetailsPage'
import TenantApplicationDetailsPage from '../pages/tenant/TenantApplicationDetailsPage'

// Manager Dashboard Pages
import ManagerDashboardPage from '../pages/manager/ManagerDashboardPage'
import ManagerPropertiesPage from '../pages/manager/ManagerPropertiesPage'
import ManagerPropertyDetailsPage from '../pages/manager/ManagerPropertyDetailsPage'
import ManagerBuildingDetailsPage from '../pages/manager/ManagerBuildingDetailsPage'
import ManagerApplicationsPage from '../pages/manager/ManagerApplicationsPage'
import ManagerApplicationDetailsPage from '../pages/manager/ManagerApplicationDetailsPage'
import ManagerMaintenancePage from '../pages/manager/ManagerMaintenancePage'
import ManagerTechniciansPage from '../pages/manager/ManagerTechniciansPage'
import ManagerInspectionsPage from '../pages/manager/ManagerInspectionsPage'
import ManagerProfilePage from '../pages/manager/ManagerProfilePage'

// Admin Dashboard Pages
import AdminDashboardPage from '../pages/admin/AdminDashboardPage'
import UserManagementPage from '../pages/admin/UserManagementPage'
import OwnerVerificationPage from '../pages/admin/OwnerVerificationPage'
import TenantDocumentReviewPage from '../pages/admin/TenantDocumentReviewPage'
import AuditLogsPage from '../pages/admin/AuditLogsPage'
import AIMonitoringPage from '../pages/admin/AIMonitoringPage'
import SystemSettingsPage from '../pages/admin/SystemSettingsPage'
import AdminReportsPage from '../pages/admin/AdminReportsPage'
import PropertyApprovalPage from '../pages/admin/PropertyApprovalPage'

// UI Showcase Page

// Legal & Informational Pages
import PrivacyPolicyPage from '../pages/legal/PrivacyPolicyPage'
import TermsAndConditionsPage from '../pages/legal/TermsAndConditionsPage'
import ContactPage from '../pages/ContactPage'

// Route Guards
import ProtectedRoute from './ProtectedRoute'
import RoleRoute from './RoleRoute'
import { ROLES, getDashboardPath, isPropertyOwner, isPropertyManager, normalizeRole } from '../utils/roles'

/**
 * Root Redirector: Sends authenticated user to their role dashboard or /login
 */
function RootRedirect() {
  const { user, loading } = useAuth()

  if (loading) return null

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const destination = getDashboardPath(user.role)
  return <Navigate to={destination} replace />
}

/**
 * Guard specifically for Owner-only Building & Unit routes.
 * Ensures non-owners are redirected to their own role dashboard.
 */
function OwnerOnlyBuildingRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user && !isPropertyOwner(user.role)) {
    return <Navigate to={getDashboardPath(user.role)} replace />
  }
  return children
}

/**
 * Guard specifically for Owner-only Application routes.
 * If user is PROPERTY_MANAGER: immediately redirects to /manager/applications
 * If user is not PROPERTY_OWNER (and not SUPER_ADMIN): redirects to their role dashboard
 */
function OwnerOnlyApplicationRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />

  const role = normalizeRole(user.role)
  if (role === ROLES.PROPERTY_MANAGER) {
    return <Navigate to="/manager/applications" replace />
  }
  if (role !== ROLES.PROPERTY_OWNER && role !== ROLES.SUPER_ADMIN) {
    return <Navigate to={getDashboardPath(role)} replace />
  }
  return children
}

/**
 * Guard specifically for Owner-only Application Details routes.
 * If user is PROPERTY_MANAGER: immediately redirects to /manager/applications/:id
 * If user is not PROPERTY_OWNER (and not SUPER_ADMIN): redirects to their role dashboard
 */
function OwnerOnlyApplicationDetailsRoute({ children }) {
  const { user, loading } = useAuth()
  const { id } = useParams()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />

  const role = normalizeRole(user.role)
  if (role === ROLES.PROPERTY_MANAGER) {
    return <Navigate to={id ? `/manager/applications/${id}` : '/manager/applications'} replace />
  }
  if (role !== ROLES.PROPERTY_OWNER && role !== ROLES.SUPER_ADMIN) {
    return <Navigate to={getDashboardPath(role)} replace />
  }
  return children
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Root entry */}
      <Route path="/" element={<RootRedirect />} />

      {/* Public Auth Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

      {/* Standalone UI Component Showcase */}

      {/* Public Legal & Informational Routes */}
      <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
      <Route path="/terms-and-conditions" element={<TermsAndConditionsPage />} />
      <Route path="/privacy" element={<Navigate to="/privacy-policy" replace />} />
      <Route path="/terms" element={<Navigate to="/terms-and-conditions" replace />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/support" element={<Navigate to="/contact" replace />} />

      {/* Protected Owner Routes */}
      <Route
        path="/owner/*"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRole={[ROLES.PROPERTY_OWNER]}>
              <Routes>
                <Route path="dashboard" element={<OwnerDashboardPage />} />
                <Route path="properties" element={<PropertiesPage />} />
                <Route path="properties/add" element={<AddPropertyPage />} />
                <Route path="properties/:id" element={<PropertyDetailsPage />} />
                <Route path="properties/:id/edit" element={<EditPropertyPage />} />
                <Route
                  path="properties/:propertyId/buildings/new"
                  element={
                    <OwnerOnlyBuildingRoute>
                      <AddBuildingPage />
                    </OwnerOnlyBuildingRoute>
                  }
                />
                <Route path="buildings" element={<BuildingsPage />} />
                <Route
                  path="buildings/new"
                  element={
                    <OwnerOnlyBuildingRoute>
                      <AddBuildingPage />
                    </OwnerOnlyBuildingRoute>
                  }
                />
                <Route path="buildings/:buildingId" element={<BuildingDetailsPage />} />
                <Route
                  path="buildings/:buildingId/edit"
                  element={
                    <OwnerOnlyBuildingRoute>
                      <AddBuildingPage />
                    </OwnerOnlyBuildingRoute>
                  }
                />
                <Route path="buildings/:buildingId/floors/:floorId" element={<FloorDetailsPage />} />
                <Route
                  path="buildings/:buildingId/floors/:floorId/units/new"
                  element={
                    <OwnerOnlyBuildingRoute>
                      <AddUnitPage />
                    </OwnerOnlyBuildingRoute>
                  }
                />
                <Route
                  path="units/add"
                  element={
                    <OwnerOnlyBuildingRoute>
                      <AddUnitPage />
                    </OwnerOnlyBuildingRoute>
                  }
                />
                <Route path="units/:unitId" element={<UnitDetailsPage />} />
                <Route
                  path="units/:unitId/edit"
                  element={
                    <OwnerOnlyBuildingRoute>
                      <AddUnitPage />
                    </OwnerOnlyBuildingRoute>
                  }
                />
                <Route
                  path="applications"
                  element={
                    <OwnerOnlyApplicationRoute>
                      <ApplicationsPage />
                    </OwnerOnlyApplicationRoute>
                  }
                />
                <Route
                  path="applications/:id"
                  element={
                    <OwnerOnlyApplicationDetailsRoute>
                      <ApplicationDetailsPage />
                    </OwnerOnlyApplicationDetailsRoute>
                  }
                />
                <Route path="payments" element={<PaymentsPage />} />
                <Route path="payments/:id" element={<PaymentDetailsPage />} />
                <Route path="maintenance" element={<MaintenancePage />} />
                <Route path="maintenance/:id" element={<MaintenanceDetailsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="ai-insights" element={<AIInsightsPage />} />
                <Route path="agreements" element={<AgreementsPage />} />
                <Route path="agreements/new" element={<CreateAgreementPage />} />
                <Route path="profile" element={<OwnerProfilePage />} />
                <Route path="*" element={<Navigate to="/owner/dashboard" replace />} />
              </Routes>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      {/* Protected Tenant Routes */}
      <Route
        path="/tenant/*"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRole={[ROLES.TENANT]}>
              <Routes>
                <Route path="dashboard" element={<TenantDashboardPage />} />
                <Route path="buildings" element={<BuildingsPage />} />
                <Route path="my-rental" element={<Navigate to="/tenant/buildings" replace />} />
                <Route path="buildings/:buildingId" element={<BuildingDetailsPage />} />
                <Route path="buildings/:buildingId/floors/:floorId" element={<FloorDetailsPage />} />
                <Route path="units/:unitId" element={<UnitDetailsPage />} />
                <Route path="properties" element={<PropertySearchPage />} />
                <Route path="properties/:id" element={<TenantPropertyDetailsPage />} />
                <Route path="find-properties" element={<PropertySearchPage />} />
                <Route path="browse" element={<Navigate to="/tenant/properties" replace />} />
                <Route path="applications" element={<TenantApplicationsPage />} />
                <Route path="applications/:id" element={<TenantApplicationDetailsPage />} />
                <Route path="applications/new" element={<SubmitApplicationPage />} />
                <Route path="agreement" element={<TenantAgreementPage />} />
                <Route path="payments" element={<TenantPaymentsPage />} />
                <Route path="maintenance" element={<TenantMaintenancePage />} />
                <Route path="maintenance/new" element={<CreateMaintenanceRequestPage />} />
                <Route path="preferences" element={<Navigate to="/tenant/find-properties" replace />} />
                <Route path="*" element={<Navigate to="/tenant/dashboard" replace />} />
              </Routes>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      {/* Protected Admin Routes */}
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRole={[ROLES.SUPER_ADMIN]}>
              <Routes>
                <Route path="dashboard" element={<AdminDashboardPage />} />
                <Route path="users" element={<UserManagementPage />} />
                <Route path="owner-verification" element={<OwnerVerificationPage />} />
                <Route path="property-approvals" element={<PropertyApprovalPage />} />
                <Route path="tenant-document-review" element={<TenantDocumentReviewPage />} />
                <Route path="reports" element={<AdminReportsPage />} />
                <Route path="audit-logs" element={<AuditLogsPage />} />
                <Route path="ai-monitoring" element={<AIMonitoringPage />} />
                <Route path="system-settings" element={<SystemSettingsPage />} />
                <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
              </Routes>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      {/* Protected Manager Routes */}
      <Route
        path="/manager/*"
        element={
          <ProtectedRoute>
            <RoleRoute allowedRole={[ROLES.PROPERTY_MANAGER]}>
              <Routes>
                <Route path="dashboard" element={<ManagerDashboardPage />} />
                <Route path="properties" element={<ManagerPropertiesPage />} />
                <Route path="properties/:propertyId" element={<ManagerPropertyDetailsPage />} />
                <Route path="properties/:propertyId/buildings/:buildingId" element={<ManagerBuildingDetailsPage />} />
                <Route path="applications" element={<ManagerApplicationsPage />} />
                <Route path="applications/:id" element={<ManagerApplicationDetailsPage />} />
                <Route path="maintenance" element={<ManagerMaintenancePage />} />
                <Route path="maintenance/technicians" element={<ManagerTechniciansPage />} />
                <Route path="inspections" element={<ManagerInspectionsPage />} />
                <Route path="agreements" element={<AgreementsPage />} />
                <Route path="agreements/new" element={<CreateAgreementPage />} />
                <Route path="payments" element={<PaymentsPage />} />
                <Route path="payments/:id" element={<PaymentDetailsPage />} />
                <Route path="reports" element={<ReportsPage role={ROLES.PROPERTY_MANAGER} />} />
                <Route path="profile" element={<ManagerProfilePage />} />
                <Route path="*" element={<Navigate to="/manager/dashboard" replace />} />
              </Routes>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      {/* Fallback route */}
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  )
}
