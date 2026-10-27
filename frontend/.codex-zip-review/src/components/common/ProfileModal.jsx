import React, { useState, useEffect } from 'react'
import { X, User, Shield, AlertCircle, RefreshCw, KeyRound, MapPin } from 'lucide-react'
import { Button, StatusBadge, Loader } from '../ui'
import { getMyProfile, mapBackendUserToUi } from '../../api/userApi'
import { getRoleLabel, isPropertyOwner, isPropertyManager } from '../../utils/roles'
import { useAuth } from '../../context/AuthContext'
import ChangePasswordForm from './ChangePasswordForm'
import { getMyOwnerProfile } from '../../api/ownerProfileApi'
import { getMyManagerProfile } from '../../api/managerProfileApi'
import OwnerProfileAddressForm from '../properties/OwnerProfileAddressForm'
import ManagerProfileAddressForm from '../properties/ManagerProfileAddressForm'

/**
 * ProfileModal Component
 * Displays authenticated user's profile and security settings (including Change Password)
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {'profile' | 'security' | 'address'} [props.initialTab='profile']
 */
export default function ProfileModal({ isOpen, onClose, initialTab = 'profile' }) {
  const auth = useAuth()
  const [profile, setProfile] = useState(null)
  const [ownerProfile, setOwnerProfile] = useState(null)
  const [managerProfile, setManagerProfile] = useState(null)
  const [loadingOwnerProfile, setLoadingOwnerProfile] = useState(false)
  const [loadingManagerProfile, setLoadingManagerProfile] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState(initialTab)

  const fetchProfile = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getMyProfile()
      const normalized = mapBackendUserToUi(data)
      setProfile(normalized)
    } catch (err) {
      console.error('Failed to fetch user profile:', err)
      const errorMsg =
        err?.message ||
        err?.data?.message ||
        'Unable to load profile from server. Please try again.'
      setError(errorMsg)

      // Gracefully fall back to session user so dialog remains useful
      if (auth?.user) {
        setProfile(mapBackendUserToUi(auth.user))
      }
    } finally {
      setLoading(false)
    }
  }

  const effectiveRole = profile?.role || auth?.user?.role
  const isOwner = isPropertyOwner(effectiveRole)
  const isManager = isPropertyManager(effectiveRole)

  const fetchOwnerAddress = async () => {
    setLoadingOwnerProfile(true)
    try {
      const data = await getMyOwnerProfile()
      setOwnerProfile(data)
    } catch (err) {
      console.warn('Failed to fetch owner profile in modal:', err)
    } finally {
      setLoadingOwnerProfile(false)
    }
  }

  const fetchManagerAddress = async () => {
    setLoadingManagerProfile(true)
    try {
      const data = await getMyManagerProfile()
      setManagerProfile(data)
    } catch (err) {
      console.warn('Failed to fetch manager profile in modal:', err)
    } finally {
      setLoadingManagerProfile(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab)
      fetchProfile()
      const role = auth?.user?.role || profile?.role
      if (isPropertyOwner(role)) {
        fetchOwnerAddress()
      } else if (isPropertyManager(role)) {
        fetchManagerAddress()
      }
    } else {
      setError(null)
    }
  }, [isOpen, initialTab])

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const displayUser = profile || (auth?.user ? mapBackendUserToUi(auth.user) : null)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl border border-[#D9E0E6] max-w-lg w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#D9E0E6]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#EAF2F7] border border-[#D9E0E6] flex items-center justify-center font-bold text-base text-[#315A7D] shrink-0">
              {displayUser?.avatarText ||
                displayUser?.name?.charAt(0) || <User className="w-5 h-5" />}
            </div>
            <div>
              <h3 id="profile-modal-title" className="text-base font-bold text-[#243447]">
                {activeTab === 'security' ? 'Change Password' : displayUser?.name || 'My Profile'}
              </h3>
              <p className="text-xs text-[#5B6875]">
                {displayUser?.id ? `User ID: #${displayUser.id}` : displayUser?.email || 'Authenticated Account'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#5B6875] hover:text-[#243447] p-1.5 rounded-md hover:bg-[#EAF2F7] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#D9E0E6] text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-[#315A7D] text-[#315A7D] bg-[#F7F8FA]'
                : 'border-transparent text-[#5B6875] hover:text-[#243447]'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile Overview</span>
          </button>
          {isOwner && (
            <button
              type="button"
              onClick={() => setActiveTab('address')}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                activeTab === 'address'
                  ? 'border-[#315A7D] text-[#315A7D] bg-[#F7F8FA]'
                  : 'border-transparent text-[#5B6875] hover:text-[#243447]'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Owner Address</span>
            </button>
          )}
          {isManager && (
            <button
              type="button"
              onClick={() => setActiveTab('address')}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                activeTab === 'address'
                  ? 'border-[#315A7D] text-[#315A7D] bg-[#F7F8FA]'
                  : 'border-transparent text-[#5B6875] hover:text-[#243447]'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Operational Address</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'security'
                ? 'border-[#315A7D] text-[#315A7D] bg-[#F7F8FA]'
                : 'border-transparent text-[#5B6875] hover:text-[#243447]'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Security & Password</span>
          </button>
        </div>

        {/* Tab 1: Profile Overview */}
        {activeTab === 'profile' && (
          <>
            {loading ? (
              <div className="py-10 flex justify-center">
                <Loader size="md" text="Loading profile details..." center />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Error Banner with Retry */}
                {error && (
                  <div className="p-3.5 rounded-lg bg-[#FDF2F2] border border-[#F8D7DA] text-xs text-[#B94A48] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                    <button
                      type="button"
                      onClick={fetchProfile}
                      className="inline-flex items-center gap-1 font-semibold text-[#B94A48] hover:underline shrink-0"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Retry</span>
                    </button>
                  </div>
                )}

                {/* Profile Information Grid */}
                {displayUser ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6] text-xs">
                    <div>
                      <span className="text-[11px] font-medium text-[#5B6875] block">First Name</span>
                      <strong className="text-xs text-[#243447] font-semibold">
                        {displayUser.firstName || '—'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[11px] font-medium text-[#5B6875] block">Last Name</span>
                      <strong className="text-xs text-[#243447] font-semibold">
                        {displayUser.lastName || '—'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[11px] font-medium text-[#5B6875] block">Email Address</span>
                      <strong className="text-xs text-[#243447] font-semibold break-all">
                        {displayUser.email || '—'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[11px] font-medium text-[#5B6875] block">Phone Number</span>
                      <strong className="text-xs text-[#243447] font-semibold">
                        {displayUser.phone || '—'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[11px] font-medium text-[#5B6875] block">Gender</span>
                      <strong className="text-xs text-[#243447] font-semibold capitalize">
                        {displayUser.gender ? String(displayUser.gender).toLowerCase() : '—'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[11px] font-medium text-[#5B6875] block">Account Role</span>
                      <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[11px] border font-medium bg-[#EAF2F7] text-[#315A7D] border-[#D9E0E6]">
                        <Shield className="w-3 h-3" />
                        <span>{getRoleLabel(displayUser.role)}</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] font-medium text-[#5B6875] block">Account Status</span>
                      <div className="mt-1">
                        <StatusBadge status={displayUser.status} size="sm" />
                      </div>
                    </div>
                    <div>
                      <span className="text-[11px] font-medium text-[#5B6875] block">Member Since</span>
                      <strong className="text-xs text-[#243447] font-semibold">
                        {displayUser.joinDate || '—'}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-[#5B6875]">
                    No profile information available.
                  </div>
                )}

                {/* Owner Registered Address Overview */}
                {isOwner && (
                  <div className="p-3.5 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6] flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-[#315A7D] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-[#243447] block">
                          Official Owner Postal Address
                        </span>
                        <span className="text-[11px] text-[#5B6875]">
                          {ownerProfile?.addressLine1
                            ? [
                                ownerProfile.addressLine1,
                                ownerProfile.area,
                                ownerProfile.city,
                                ownerProfile.state,
                                ownerProfile.pincode,
                              ]
                                .filter(Boolean)
                                .join(', ')
                            : 'No official address registered yet'}
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => setActiveTab('address')}
                    >
                      {ownerProfile?.addressLine1 ? 'Edit Address' : 'Set Address'}
                    </Button>
                  </div>
                )}

                {/* Manager Operational Address Overview */}
                {isManager && (
                  <div className="p-3.5 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6] flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-[#315A7D] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-[#243447] block">
                          Official Manager Operational Address
                        </span>
                        <span className="text-[11px] text-[#5B6875]">
                          {managerProfile?.addressLine1
                            ? [
                                managerProfile.addressLine1,
                                managerProfile.area,
                                managerProfile.city,
                                managerProfile.state,
                                managerProfile.pincode,
                              ]
                                .filter(Boolean)
                                .join(', ')
                            : 'No operational address registered yet'}
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => setActiveTab('address')}
                    >
                      {managerProfile?.addressLine1 ? 'Edit Address' : 'Set Address'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Tab 2: Security & Password */}
        {activeTab === 'security' && (
          <div className="space-y-4 pt-1">
            <div className="p-3 rounded-lg bg-[#EAF2F7] border border-[#D9E0E6] text-xs text-[#315A7D]">
              <p className="font-semibold">Update Account Password</p>
              <p className="text-[11px] text-[#5B6875] mt-0.5">
                Ensure your account stays secure by using a strong, unique password with at least 6 characters.
              </p>
            </div>

            <ChangePasswordForm />
          </div>
        )}

        {/* Tab 3: Address Form (Owner or Manager) */}
        {activeTab === 'address' && (
          <div className="space-y-4 pt-1">
            {isOwner && (
              loadingOwnerProfile ? (
                <div className="py-10 flex justify-center">
                  <Loader size="md" text="Loading owner address..." center />
                </div>
              ) : (
                <OwnerProfileAddressForm
                  initialData={ownerProfile}
                  onSaved={(updated) => setOwnerProfile(updated)}
                  isStandaloneCard={false}
                />
              )
            )}

            {isManager && (
              loadingManagerProfile ? (
                <div className="py-10 flex justify-center">
                  <Loader size="md" text="Loading manager address..." center />
                </div>
              ) : (
                <ManagerProfileAddressForm
                  initialData={managerProfile}
                  onSaved={(updated) => setManagerProfile(updated)}
                  isStandaloneCard={false}
                />
              )
            )}
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D9E0E6]">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
