import React, { useCallback, useEffect, useState } from 'react'
import { Calendar, KeyRound, Mail, Phone, Shield, User } from 'lucide-react'
import { getMyProfile, mapBackendUserToUi } from '../../api/userApi'
import ChangePasswordForm from '../../components/common/ChangePasswordForm'
import SelfServiceAccountSection from '../../components/common/SelfServiceAccountSection'
import DashboardLayout from '../../layouts/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import { Button, Loader, StatusBadge } from '../../components/ui'

export default function TenantAccountPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  const [profile, setProfile] = useState(() =>
    user ? mapBackendUserToUi(user) : null
  )
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const fetchProfile = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      const data = await getMyProfile()
      setProfile(mapBackendUserToUi(data))
    } catch (err) {
      setLoadError(
        err?.response?.data?.message ||
          err?.message ||
          'Unable to load your profile. Please try again.'
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const details = [
    { label: 'First Name', value: profile?.firstName, icon: User },
    { label: 'Last Name', value: profile?.lastName, icon: User },
    { label: 'Email Address', value: profile?.email, icon: Mail },
    { label: 'Phone Number', value: profile?.phone, icon: Phone },
    {
      label: 'Gender',
      value: profile?.gender
        ? String(profile.gender).toLowerCase().replaceAll('_', ' ')
        : '',
      icon: User,
    },
    { label: 'Account Role', value: profile?.roleLabel || 'Tenant', icon: Shield },
    {
      label: 'Member Since',
      value: profile?.joinDate
        ? new Date(profile.joinDate).toLocaleDateString()
        : '',
      icon: Calendar,
    },
  ]

  return (
    <DashboardLayout
      defaultRole="tenant"
      activeItem="account"
      pageTitle="My Account"
    >
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        <section className="bg-white rounded-2xl border border-[#E3E8DF] p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#EDF4ED] border border-[#E3E8DF] flex items-center justify-center text-lg font-bold text-[#3F7D58]">
                {profile?.avatarText || profile?.name?.slice(0, 2)?.toUpperCase() || 'U'}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-[#111820]">
                    {profile?.name || 'My Account'}
                  </h1>
                  {profile?.status && <StatusBadge status={profile.status} size="sm" />}
                </div>
                <p className="mt-1 text-sm text-[#5B6875]">{profile?.email || ''}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={fetchProfile} disabled={isLoading}>
              Refresh profile
            </Button>
          </div>
        </section>

        <div className="flex border-b border-[#E3E8DF] text-sm font-semibold gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-[#3F7D58] text-[#3F7D58] bg-white rounded-t-lg'
                : 'border-transparent text-[#5B6875] hover:text-[#111820]'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Profile Overview</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors ${
              activeTab === 'security'
                ? 'border-[#3F7D58] text-[#3F7D58] bg-white rounded-t-lg'
                : 'border-transparent text-[#5B6875] hover:text-[#111820]'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Security & Password</span>
          </button>
        </div>

        {activeTab === 'profile' ? (
          <section className="bg-white rounded-2xl border border-[#E3E8DF] p-6 shadow-xs">
            {isLoading ? (
              <Loader size="md" text="Loading your profile..." center />
            ) : loadError && !profile ? (
              <div className="space-y-3 text-center">
                <p role="alert" className="text-sm text-[#B94A48]">{loadError}</p>
                <Button variant="outline" size="sm" onClick={fetchProfile}>Try again</Button>
              </div>
            ) : (
              <>
                {loadError && (
                  <p role="status" className="mb-4 text-xs text-[#8A5B16]">
                    Could not refresh profile details. Showing saved account information.
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {details.map(({ label, value, icon: Icon }) => (
                    <div key={label} className="rounded-lg bg-[#F7F7F1] border border-[#E3E8DF] p-4">
                      <span className="flex items-center gap-2 text-xs font-medium text-[#5B6875]">
                        <Icon className="w-3.5 h-3.5 text-[#3F7D58]" />
                        {label}
                      </span>
                      <strong className="mt-1 block text-sm font-semibold text-[#111820] capitalize break-words">
                        {value || '—'}
                      </strong>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        ) : (
          <div className="space-y-6">
            <section className="bg-white rounded-2xl border border-[#E3E8DF] p-6 shadow-xs space-y-4">
              <div className="border-b border-[#E3E8DF] pb-3">
                <h2 className="text-base font-bold text-[#111820] flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#3F7D58]" />
                  <span>Account Password & Credentials</span>
                </h2>
                <p className="text-xs text-[#5B6875] mt-1">
                  Keep your account secure with a strong, unique password.
                </p>
              </div>
              <ChangePasswordForm />
            </section>
            <SelfServiceAccountSection />
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
