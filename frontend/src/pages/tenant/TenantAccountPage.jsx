import React from 'react'
import { useAuth } from '../../context/AuthContext'
import DashboardLayout from '../../layouts/DashboardLayout'
import SelfServiceAccountSection from '../../components/common/SelfServiceAccountSection'

export default function TenantAccountPage() {
  const { user } = useAuth()

  return (
    <DashboardLayout
      defaultRole="tenant"
      activeItem="account"
      pageTitle="My Account"
    >
      <div className="max-w-3xl mx-auto space-y-6">
        <section className="bg-white rounded-2xl border border-[#D9E0E6] p-6 shadow-xs">
          <h1 className="text-lg font-bold text-[#243447]">Account details</h1>
          <p className="mt-2 text-sm text-[#5B6875]">{user?.name || 'Tenant'}</p>
          <p className="text-sm text-[#5B6875]">{user?.email || ''}</p>
        </section>
        <SelfServiceAccountSection />
      </div>
    </DashboardLayout>
  )
}
