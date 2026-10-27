import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import DashboardLayout from '../../layouts/DashboardLayout'
import { ROLES, getRoleLabel } from '../../utils/roles'
import { getMyManagerProfile } from '../../api/managerProfileApi'
import ManagerProfileAddressForm from '../../components/properties/ManagerProfileAddressForm'
import ChangePasswordForm from '../../components/common/ChangePasswordForm'
import { Button, StatusBadge, Loader } from '../../components/ui'
import {
  User,
  Shield,
  MapPin,
  Mail,
  Phone,
  Calendar,
  AlertCircle,
  RefreshCw,
  KeyRound,
  Building2,
} from 'lucide-react'

/**
 * Property Manager Profile Page
 * 
 * Integrated with authenticated Spring Boot endpoints:
 * - GET /api/manager-profile/me (Profile & Address details)
 * - PUT /api/manager-profile/me (Update Profile & Address details)
 * - GET /api/location/pincode/{pincode} (Address auto-fill)
 * 
 * Scoped strictly to PROPERTY_MANAGER role.
 */
export default function ManagerProfilePage() {
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState('profile')
  const [profileData, setProfileData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const fetchProfile = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const data = await getMyManagerProfile()
      setProfileData(data)
    } catch (err) {
      console.error('Failed to load manager profile:', err)
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Unable to load property manager profile. Please check your connection and try again.'
      setLoadError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const fullName =
    [profileData?.firstName, profileData?.lastName].filter(Boolean).join(' ') ||
    user?.name ||
    'Property Manager'

  const userEmail = profileData?.email || user?.email || '—'
  const userPhone = profileData?.phone || user?.phone || '—'
  const userGender = profileData?.gender
    ? String(profileData.gender).toLowerCase()
    : '—'
  const userStatus = profileData?.status || user?.status || null

  return (
    <DashboardLayout
      defaultRole={ROLES.PROPERTY_MANAGER}
      activeItem="profile"
      pageTitle="Manager Profile"
    >
      <div className="space-y-6 pb-12 max-w-5xl mx-auto">
        {/* Profile Hero Header Card */}
        <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              {/* Profile Avatar / Image */}
              <div className="relative w-16 h-16 rounded-2xl bg-[#EAF2F7] border-2 border-[#D9E0E6] flex items-center justify-center font-bold text-xl text-[#315A7D] shrink-0 overflow-hidden shadow-2xs">
                {profileData?.profileImage ? (
                  <img
                    src={profileData.profileImage}
                    alt={fullName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none'
                    }}
                  />
                ) : (
                  <span>
                    {fullName.charAt(0) || <User className="w-8 h-8" />}
                  </span>
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-serif text-xl sm:text-2xl font-bold text-[#243447]">
                    {fullName}
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EAF2F7] text-[#315A7D] border border-[#D9E0E6]">
                    <Shield className="w-3.5 h-3.5" />
                    <span>{getRoleLabel(ROLES.PROPERTY_MANAGER)}</span>
                  </span>
                  <StatusBadge status={userStatus} size="sm" />
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-[#5B6875]">
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-[#315A7D]" />
                    <strong className="font-medium text-[#243447]">{userEmail}</strong>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-[#315A7D]" />
                    <strong className="font-medium text-[#243447]">{userPhone}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchProfile}
                disabled={isLoading}
                leftIcon={
                  isLoading ? <Loader size="xs" /> : <RefreshCw className="w-3.5 h-3.5" />
                }
              >
                Refresh
              </Button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-[#D9E0E6] text-xs">
            <div className="flex items-center gap-2.5 text-[#5B6875]">
              <Mail className="w-4 h-4 text-[#315A7D] shrink-0" />
              <div className="truncate">
                <span className="block text-[10px] uppercase font-semibold text-[#5B6875]">
                  Email Address
                </span>
                <span className="font-semibold text-[#243447] truncate block">
                  {userEmail}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-[#5B6875]">
              <Phone className="w-4 h-4 text-[#315A7D] shrink-0" />
              <div>
                <span className="block text-[10px] uppercase font-semibold text-[#5B6875]">
                  Phone
                </span>
                <span className="font-semibold text-[#243447]">{userPhone}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-[#5B6875]">
              <Shield className="w-4 h-4 text-[#315A7D] shrink-0" />
              <div>
                <span className="block text-[10px] uppercase font-semibold text-[#5B6875]">
                  Account Role
                </span>
                <span className="font-semibold text-[#315A7D]">PROPERTY_MANAGER</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-[#5B6875]">
              <Calendar className="w-4 h-4 text-[#315A7D] shrink-0" />
              <div>
                <span className="block text-[10px] uppercase font-semibold text-[#5B6875]">
                  Member Since
                </span>
                <span className="font-semibold text-[#243447]">
                  {profileData?.createdAt
                    ? new Date(profileData.createdAt).toLocaleDateString()
                    : 'Active'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#D9E0E6] text-sm font-semibold gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'profile'
                ? 'border-[#315A7D] text-[#315A7D] bg-white rounded-t-lg'
                : 'border-transparent text-[#5B6875] hover:text-[#243447]'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Profile & Address</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'security'
                ? 'border-[#315A7D] text-[#315A7D] bg-white rounded-t-lg'
                : 'border-transparent text-[#5B6875] hover:text-[#243447]'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Security & Password</span>
          </button>
        </div>

        {/* Tab 1: Profile & Address Content */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {isLoading ? (
              <div className="py-16 flex flex-col items-center justify-center bg-white rounded-2xl border border-[#D9E0E6]">
                <Loader size="md" text="Loading manager profile and address..." center />
              </div>
            ) : loadError ? (
              <div className="p-6 rounded-2xl bg-white border border-[#D9E0E6] text-center space-y-3">
                <AlertCircle className="w-8 h-8 text-[#B94A48] mx-auto" />
                <p className="text-sm font-semibold text-[#243447]">
                  Unable to load manager profile
                </p>
                <p className="text-xs text-[#5B6875] max-w-md mx-auto">{loadError}</p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={fetchProfile}
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Try Again
                </Button>
              </div>
            ) : (
              <>
                {/* Account Details Read-Only Summary Card */}
                <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs space-y-4">
                  <div className="border-b border-[#D9E0E6] pb-3">
                    <h2 className="text-sm font-bold text-[#243447] flex items-center gap-2">
                      <User className="w-4 h-4 text-[#315A7D]" />
                      <span>Account Information</span>
                    </h2>
                    <p className="text-xs text-[#5B6875] mt-0.5">
                      Core profile details assigned to your system account.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                    <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6]">
                      <span className="text-[11px] font-medium text-[#5B6875] block">First Name</span>
                      <strong className="text-xs text-[#243447] font-semibold">
                        {profileData?.firstName || '—'}
                      </strong>
                    </div>

                    <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6]">
                      <span className="text-[11px] font-medium text-[#5B6875] block">Last Name</span>
                      <strong className="text-xs text-[#243447] font-semibold">
                        {profileData?.lastName || '—'}
                      </strong>
                    </div>

                    <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6]">
                      <span className="text-[11px] font-medium text-[#5B6875] block">Email Address</span>
                      <strong className="text-xs text-[#243447] font-semibold break-all">
                        {userEmail}
                      </strong>
                    </div>

                    <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6]">
                      <span className="text-[11px] font-medium text-[#5B6875] block">Phone Number</span>
                      <strong className="text-xs text-[#243447] font-semibold">
                        {userPhone}
                      </strong>
                    </div>

                    <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6]">
                      <span className="text-[11px] font-medium text-[#5B6875] block">Gender</span>
                      <strong className="text-xs text-[#243447] font-semibold capitalize">
                        {userGender}
                      </strong>
                    </div>

                    <div className="p-3 rounded-xl bg-[#F7F8FA] border border-[#D9E0E6]">
                      <span className="text-[11px] font-medium text-[#5B6875] block">Assigned Role</span>
                      <div className="flex items-center gap-1 text-[#315A7D] font-semibold mt-0.5">
                        <Shield className="w-3.5 h-3.5" />
                        <span>PROPERTY_MANAGER</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Manager Operational Address Form with Location Lookup */}
                <ManagerProfileAddressForm
                  initialData={profileData}
                  onSaved={(updated) => setProfileData(updated)}
                  isStandaloneCard={true}
                />

                {/* Audit Information */}
                {profileData?.createdAt && (
                  <div className="flex flex-wrap items-center justify-between text-[11px] text-[#5B6875] px-2">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#315A7D]" />
                      Profile Created: {new Date(profileData.createdAt).toLocaleDateString()}
                    </span>
                    {profileData?.updatedAt && (
                      <span>
                        Last Updated: {new Date(profileData.updatedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab 2: Security & Password Content */}
        {activeTab === 'security' && (
          <div className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs space-y-4">
            <div className="border-b border-[#D9E0E6] pb-3">
              <h2 className="text-base font-bold text-[#243447] flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#315A7D]" />
                <span>Account Password & Credentials</span>
              </h2>
              <p className="text-xs text-[#5B6875] mt-0.5">
                Ensure your manager account remains secure with strong authentication credentials.
              </p>
            </div>

            <ChangePasswordForm />
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
