import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import DashboardLayout from '../../layouts/DashboardLayout'
import { ROLES, getRoleLabel } from '../../utils/roles'
import { getMyOwnerProfile } from '../../api/ownerProfileApi'
import OwnerProfileAddressForm from '../../components/properties/OwnerProfileAddressForm'
import ChangePasswordForm from '../../components/common/ChangePasswordForm'
import SelfServiceAccountSection from '../../components/common/SelfServiceAccountSection'
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
  CheckCircle2,
} from 'lucide-react'

/**
 * Property Owner Profile Page
 * 
 * Integrated with authenticated Spring Boot endpoints:
 * - GET /api/owner-profile/me (Profile & Address details)
 * - PUT /api/owner-profile/me (Update Profile & Address details)
 * - GET /api/location/pincode/{pincode} (Address auto-fill)
 * 
 * Scoped strictly to PROPERTY_OWNER role.
 */
export default function OwnerProfilePage() {
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState('profile')
  const [profileData, setProfileData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const fetchProfile = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const data = await getMyOwnerProfile()
      setProfileData(data)
    } catch (err) {
      console.error('Failed to load owner profile:', err)
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Unable to load property owner profile. Please check your connection and try again.'
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
    'Property Owner'

  const userEmail = profileData?.email || user?.email || '—'
  const userPhone = profileData?.phone || user?.phone || '—'
  const userGender = profileData?.gender
    ? String(profileData.gender).toLowerCase()
    : '—'
  const userStatus = profileData?.status || user?.status || null

  return (
    <DashboardLayout
      defaultRole={ROLES.PROPERTY_OWNER}
      activeItem="profile"
      pageTitle="My Account"
    >
      <div className="space-y-6 pb-12 max-w-5xl mx-auto">
        {/* Profile Hero Header Card */}
        <div className="bg-white rounded-2xl border border-[#E3E8DF] p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              {/* Profile Avatar */}
              <div className="relative w-16 h-16 rounded-2xl bg-[#EDF4ED] border-2 border-[#E3E8DF] flex items-center justify-center font-bold text-xl text-[#3F7D58] shrink-0 overflow-hidden shadow-2xs">
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
                  <span>{fullName.charAt(0) || <User className="w-8 h-8" />}</span>
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold text-[#243447]">{fullName}</h1>
                  <StatusBadge status={userStatus} size="sm" />
                </div>
                <p className="text-xs text-[#5B6875] mt-1 flex items-center gap-1.5">
                  <span className="font-medium text-[#3F7D58]">Verified Owner</span>
                  <span>•</span>
                  <span>{userEmail}</span>
                </p>
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-[#E3E8DF] text-xs">
            <div className="flex items-center gap-2.5 text-[#5B6875]">
              <Mail className="w-4 h-4 text-[#3F7D58] shrink-0" />
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
              <Phone className="w-4 h-4 text-[#3F7D58] shrink-0" />
              <div>
                <span className="block text-[10px] uppercase font-semibold text-[#5B6875]">
                  Phone
                </span>
                <span className="font-semibold text-[#243447]">{userPhone}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-[#5B6875]">
              <Shield className="w-4 h-4 text-[#3F7D58] shrink-0" />
              <div>
                <span className="block text-[10px] uppercase font-semibold text-[#5B6875]">
                  Account Role
                </span>
                <span className="font-semibold text-[#3F7D58]">PROPERTY_OWNER</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-[#5B6875]">
              <Calendar className="w-4 h-4 text-[#3F7D58] shrink-0" />
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
        <div className="flex border-b border-[#E3E8DF] text-sm font-semibold gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'profile'
                ? 'border-[#3F7D58] text-[#3F7D58] bg-white rounded-t-lg'
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
                ? 'border-[#3F7D58] text-[#3F7D58] bg-white rounded-t-lg'
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
              <div className="py-16 flex flex-col items-center justify-center bg-white rounded-2xl border border-[#E3E8DF]">
                <Loader size="md" text="Loading owner profile and address..." center />
              </div>
            ) : loadError ? (
              <div className="p-6 rounded-2xl bg-white border border-[#E3E8DF] text-center space-y-3">
                <AlertCircle className="w-8 h-8 text-[#B94A48] mx-auto" />
                <p className="text-sm font-semibold text-[#243447]">
                  Unable to load owner profile
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
              <OwnerProfileAddressForm
                initialData={profileData}
                onSaved={(updated) => setProfileData(updated)}
                isStandaloneCard={true}
              />
            )}
          </div>
        )}

        {/* Tab 2: Security & Password Content */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-[#E3E8DF] p-6 shadow-xs space-y-4">
              <div className="border-b border-[#E3E8DF] pb-3">
                <h2 className="text-base font-bold text-[#243447] flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#3F7D58]" />
                  <span>Account Password & Credentials</span>
                </h2>
                <p className="text-xs text-[#5B6875] mt-0.5">
                  Ensure your owner account remains secure with strong authentication credentials.
                </p>
              </div>

              <ChangePasswordForm />
            </div>
            <SelfServiceAccountSection />
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
