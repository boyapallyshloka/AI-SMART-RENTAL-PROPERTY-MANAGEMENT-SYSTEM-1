import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getManagerAssignedProperties } from '../../api/propertyApi'
import { getApplicationsForProperty } from '../../api/applicationApi'
import { getMaintenanceRequests } from '../../api/maintenanceApi'
import DashboardLayout from '../../layouts/DashboardLayout'
import { ROLES } from '../../utils/roles'
import { Button } from '../../components/ui'
import {
  Building2,
  FileCheck,
  Wrench,
  ArrowRight,
} from 'lucide-react'
import ownerHeroBg from '../../assets/owner-hero-bg.jpg'

export default function ManagerDashboardPage() {
  const { user } = useAuth()
  const displayName = user?.name || user?.fullName || user?.username || 'Property Manager'

  const [properties, setProperties] = useState([])
  useEffect(() => {
    const loadProperties = async () => {
      try {
        const response = await getManagerAssignedProperties()
        const list = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
          ? response.data
          : []
        setProperties(list)
      } catch (err) {
        console.error('Failed to load manager assigned properties:', err)
      }
    }
    loadProperties()
  }, [])

  const [applications, setApplications] = useState([])
  useEffect(() => {
    const loadApplications = async () => {
      try {
        const results = await Promise.all(
          properties.map((property) =>
            getApplicationsForProperty(property.propertyId || property.id)
          )
        )
        const allApplications = results.flat()
        setApplications(allApplications)
      } catch (err) {
        console.error('Failed to load manager applications:', err)
      }
    }

    if (properties.length > 0) {
      loadApplications()
    }
  }, [properties])

  const [maintenanceRequests, setMaintenanceRequests] = useState([])
  useEffect(() => {
    const loadRequests = async () => {
      try {
        const response = await getMaintenanceRequests()
        const list = Array.isArray(response)
          ? response
          : Array.isArray(response?.data)
          ? response.data
          : []
        setMaintenanceRequests(list)
      } catch (err) {
        console.error('Failed to load maintenance requests:', err)
      }
    }
    loadRequests()
  }, [])

  return (
    <DashboardLayout
      defaultRole={ROLES.PROPERTY_MANAGER}
      activeItem="dashboard"
      pageTitle="Manager Dashboard"
    >
      <div className="space-y-6">
        {/* Hero / Header Section with Residential Community Framing */}
        <div
          className="relative overflow-hidden rounded-2xl border border-[#D9E2EC] shadow-xs bg-cover bg-center min-h-[140px] sm:min-h-[170px] flex items-center"
          style={{ backgroundImage: `url(${ownerHeroBg})` }}
        >
          {/* Soft luminous gradient overlay to ensure contrast and highlight the center sky while framing side buildings */}
          <div className="absolute inset-0 bg-gradient-to-r from-white/92 via-white/75 to-white/92 backdrop-blur-[0.5px]" />

          <div className="relative z-10 px-6 sm:px-10 py-8 max-w-3xl">
            <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#1B2B4A]">
              Welcome back, {displayName}!
            </h1>
          </div>
        </div>

        {/* Operational Scope Overview */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#1B2B4A]">
              Manager Overview
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Operational summary across your assigned portfolios and tenant requests
            </p>
          </div>
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Assigned Properties Card */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B6875]">
                Assigned Properties
              </span>
              <div className="w-9 h-9 rounded-xl border border-[#D9E2EC] bg-[#EBF2F7] flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-[#315A7D]" />
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1B2B4A] font-sans">
                {properties.length} {properties.length === 1 ? 'Property' : 'Properties'}
              </p>
              <p className="text-xs text-[#64748B] mt-1 font-medium">
                View and manage your assigned properties
              </p>
            </div>
            <div className="pt-3 border-t border-[#EDF2F7]">
              <Link to="/manager/properties" className="block">
                <Button size="sm" variant="outline" className="w-full justify-between rounded-xl" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                  View Properties
                </Button>
              </Link>
            </div>
          </div>

          {/* Applications Card */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B6875]">
                Applications
              </span>
              <div className="w-9 h-9 rounded-xl border border-[#D9E2EC] bg-[#EBF2F7] flex items-center justify-center shrink-0">
                <FileCheck className="w-5 h-5 text-[#315A7D]" />
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1B2B4A] font-sans">
                {applications.length} {applications.length === 1 ? 'Application' : 'Applications'}
              </p>
              <p className="text-xs text-[#64748B] mt-1 font-medium">
                Review tenant applications
              </p>
            </div>
            <div className="pt-3 border-t border-[#EDF2F7]">
              <Link to="/manager/applications" className="block">
                <Button size="sm" variant="outline" className="w-full justify-between rounded-xl" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                  Review Applications
                </Button>
              </Link>
            </div>
          </div>

          {/* Maintenance Card */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 shadow-xs hover:shadow-sm transition-all duration-200 flex flex-col justify-between space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B6875]">
                Maintenance &amp; Service
              </span>
              <div className="w-9 h-9 rounded-xl border border-[#FAD7B2] bg-[#FEF6EC] flex items-center justify-center shrink-0">
                <Wrench className="w-5 h-5 text-[#B7791F]" />
              </div>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1B2B4A] font-sans">
                {maintenanceRequests.length} {maintenanceRequests.length === 1 ? 'Request' : 'Requests'}
              </p>
              <p className="text-xs text-[#64748B] mt-1 font-medium">
                Manage maintenance requests
              </p>
            </div>
            <div className="pt-3 border-t border-[#EDF2F7]">
              <Link to="/manager/maintenance" className="block">
                <Button size="sm" variant="outline" className="w-full justify-between rounded-xl" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                  Manage Maintenance
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

