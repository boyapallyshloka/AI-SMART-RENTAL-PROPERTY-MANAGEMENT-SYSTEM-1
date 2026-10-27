import React, { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '../../layouts/DashboardLayout'
import {
  getAllUsers,
  getUserById,
  getUserByEmail,
  updateUser,
  deleteUser,
  getUsersByRole,
  getUsersByStatus,
  getUsersByRoleAndStatus,
  updateUserStatus,
  mapBackendUserToUi,
  ROLES,
  USER_STATUSES,
  GENDERS,
} from '../../api/userApi'
import {
  Input,
  Select,
  StatusBadge,
  EmptyState,
  Loader,
  Button,
} from '../../components/ui'
import DeleteConfirmModal from '../../components/common/DeleteConfirmModal'
import {
  Users,
  Search,
  RotateCcw,
  Shield,
  Building2,
  User,
  Briefcase,
  CheckCircle2,
  Clock,
  Eye,
  Pencil,
  Trash2,
  X,
  AlertCircle,
  Save,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'

const ROLE_OPTIONS = [
  { value: 'ALL', label: 'All Roles' },
  { value: ROLES.SUPER_ADMIN, label: 'Super Admin' },
  { value: ROLES.PROPERTY_OWNER, label: 'Property Owner' },
  { value: ROLES.PROPERTY_MANAGER, label: 'Property Manager' },
  { value: ROLES.TENANT, label: 'Tenant' },
]

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: USER_STATUSES.ACTIVE, label: 'Active' },
  { value: USER_STATUSES.INACTIVE, label: 'Inactive' },
  { value: USER_STATUSES.BLOCKED, label: 'Blocked' },
  { value: USER_STATUSES.PENDING, label: 'Pending' },
]

const GENDER_OPTIONS = [
  { value: GENDERS.MALE, label: 'Male' },
  { value: GENDERS.FEMALE, label: 'Female' },
  { value: GENDERS.OTHER, label: 'Other' },
  { value: GENDERS.PREFER_NOT_TO_SAY, label: 'Prefer not to say' },
]

export default function UserManagementPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Modals state
  // 1. Details modal
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState('')

  // 2. Edit modal
  const [editUserModalData, setEditUserModalData] = useState(null)
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)
  const [editFormErrors, setEditFormErrors] = useState({})
  const [editError, setEditError] = useState('')

  // 3. Status change modal
  const [statusModalData, setStatusModalData] = useState(null)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [statusError, setStatusError] = useState('')

  // 4. Delete modal
  const [userToDelete, setUserToDelete] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Fetch users based on current filters and search query
  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      let data
      const queryTrimmed = searchQuery.trim()
      const isEmailQuery = queryTrimmed.includes('@')

      if (isEmailQuery) {
        // Flow 3: Email search
        try {
          const res = await getUserByEmail(queryTrimmed)
          const userObj = res?.data || res
          data = userObj && userObj.id ? [userObj] : []
        } catch (err) {
          if (err?.isNotFound || err?.status === 404) {
            data = []
          } else {
            throw err
          }
        }
      } else if (roleFilter !== 'ALL' && statusFilter !== 'ALL') {
        // Flow 6: Combined role + status filter
        data = await getUsersByRoleAndStatus(roleFilter, statusFilter)
      } else if (roleFilter !== 'ALL') {
        // Flow 4: Role filter
        data = await getUsersByRole(roleFilter)
      } else if (statusFilter !== 'ALL') {
        // Flow 5: Status filter
        data = await getUsersByStatus(statusFilter)
      } else {
        // Flow 1: User list
        data = await getAllUsers()
      }

      const list = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []
      setUsers(list.map(mapBackendUserToUi).filter(Boolean))
    } catch (err) {
      console.error('Failed to load users:', err)
      setError(err?.message || 'Failed to load user directory. Please try again.')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [roleFilter, statusFilter, searchQuery])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  // Client-side text filtering for non-email search query (e.g. name or phone)
  const filteredUsers = users.filter((u) => {
    const query = searchQuery.toLowerCase().trim()
    if (!query || query.includes('@')) return true

    const matchesName = u.name && u.name.toLowerCase().includes(query)
    const matchesEmail = u.email && u.email.toLowerCase().includes(query)
    const matchesPhone = u.phone && u.phone.toLowerCase().includes(query)

    return matchesName || matchesEmail || matchesPhone
  })

  const hasActiveFilters =
    searchQuery !== '' || roleFilter !== 'ALL' || statusFilter !== 'ALL'

  const resetFilters = () => {
    setSearchQuery('')
    setRoleFilter('ALL')
    setStatusFilter('ALL')
  }

  // Flow 2: View User Details
  const handleViewDetails = async (userId) => {
    setIsDetailsOpen(true)
    setIsLoadingDetails(true)
    setDetailsError('')
    try {
      const res = await getUserById(userId)
      const u = res?.data || res
      setSelectedUser(mapBackendUserToUi(u))
    } catch (err) {
      console.error('Failed to load user details:', err)
      setDetailsError(err?.message || 'Failed to load user details.')
    } finally {
      setIsLoadingDetails(false)
    }
  }

  // Flow 7: Edit User
  const handleOpenEdit = (user) => {
    setEditUserModalData({
      id: user.id,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phone: user.phone || '',
      gender: user.gender || GENDERS.PREFER_NOT_TO_SAY,
    })
    setEditFormErrors({})
    setEditError('')
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!editUserModalData) return

    const errors = {}
    if (!editUserModalData.firstName?.trim()) {
      errors.firstName = 'First name is required'
    }
    if (!editUserModalData.lastName?.trim()) {
      errors.lastName = 'Last name is required'
    }
    if (!editUserModalData.email?.trim()) {
      errors.email = 'Email address is required'
    } else if (!/\S+@\S+\.\S+/.test(editUserModalData.email)) {
      errors.email = 'Please enter a valid email address'
    }

    if (Object.keys(errors).length > 0) {
      setEditFormErrors(errors)
      return
    }

    setIsSubmittingEdit(true)
    setEditError('')
    try {
      const payload = {
        firstName: editUserModalData.firstName,
        lastName: editUserModalData.lastName,
        email: editUserModalData.email,
        phone: editUserModalData.phone,
        gender: editUserModalData.gender,
      }
      const res = await updateUser(editUserModalData.id, payload)
      const updated = mapBackendUserToUi(res?.data || res)

      setUsers((prev) =>
        prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u))
      )
      setToast('User profile updated successfully.')
      setEditUserModalData(null)
      if (selectedUser && selectedUser.id === updated.id) {
        setSelectedUser(updated)
      }
    } catch (err) {
      console.error('Failed to update user:', err)
      setEditError(err?.message || 'Failed to update user.')
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  // Flow 8: Change User Status
  const handleOpenStatusModal = (user) => {
    setStatusModalData({
      id: user.id,
      name: user.name,
      email: user.email,
      newStatus: user.status || USER_STATUSES.ACTIVE,
    })
    setStatusError('')
  }

  const handleStatusSubmit = async (e) => {
    e.preventDefault()
    if (!statusModalData) return

    setIsUpdatingStatus(true)
    setStatusError('')
    try {
      const res = await updateUserStatus(statusModalData.id, statusModalData.newStatus)
      const updated = mapBackendUserToUi(res?.data || res)

      setUsers((prev) =>
        prev.map((u) =>
          u.id === statusModalData.id
            ? {
                ...u,
                status: statusModalData.newStatus,
                accountStatus: statusModalData.newStatus,
                ...(updated || {}),
              }
            : u
        )
      )
      setToast(`Account status updated to ${statusModalData.newStatus}.`)
      setStatusModalData(null)
      if (selectedUser && selectedUser.id === statusModalData.id) {
        setSelectedUser((prev) =>
          prev
            ? {
                ...prev,
                status: statusModalData.newStatus,
                accountStatus: statusModalData.newStatus,
              }
            : prev
        )
      }
    } catch (err) {
      console.error('Failed to update status:', err)
      setStatusError(err?.message || 'Failed to update user status.')
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  // Flow 9: Delete User
  const handleOpenDelete = (user) => {
    setUserToDelete(user)
    setDeleteError('')
  }

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return
    setIsDeleting(true)
    setDeleteError('')
    try {
      await deleteUser(userToDelete.id)
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id))
      setToast('User deleted successfully.')
      setUserToDelete(null)
      if (selectedUser && selectedUser.id === userToDelete.id) {
        setIsDetailsOpen(false)
        setSelectedUser(null)
      }
    } catch (err) {
      console.error('Failed to delete user:', err)
      setDeleteError(err?.message || 'Failed to delete user.')
    } finally {
      setIsDeleting(false)
    }
  }

  const getRoleIcon = (role) => {
    switch (role?.toUpperCase()) {
      case 'PROPERTY_OWNER':
      case 'OWNER':
        return <Building2 className="w-3.5 h-3.5 text-[#3F7D58]" />
      case 'TENANT':
        return <User className="w-3.5 h-3.5 text-[#315A7D]" />
      case 'PROPERTY_MANAGER':
      case 'MANAGER':
        return <Briefcase className="w-3.5 h-3.5 text-[#5B6875]" />
      case 'SUPER_ADMIN':
      case 'SUPERADMIN':
      case 'ADMIN':
        return <Shield className="w-3.5 h-3.5 text-[#315A7D]" />
      default:
        return <User className="w-3.5 h-3.5 text-[#5B6875]" />
    }
  }

  const getRoleBadgeClass = (role) => {
    switch (role?.toUpperCase()) {
      case 'PROPERTY_OWNER':
      case 'OWNER':
        return 'bg-[#EDF7EE] text-[#2A583B] border-[#C6DEC8]'
      case 'TENANT':
        return 'bg-[#EAF2F7] text-[#274B68] border-[#D9E0E6]'
      case 'PROPERTY_MANAGER':
      case 'MANAGER':
        return 'bg-[#F0F4F7] text-[#5B6875] border-[#D9E0E6]'
      case 'SUPER_ADMIN':
      case 'SUPERADMIN':
      case 'ADMIN':
        return 'bg-[#EAF2F7] text-[#315A7D] border-[#D9E0E6]'
      default:
        return 'bg-[#F0F4F7] text-[#5B6875] border-[#D9E0E6]'
    }
  }

  return (
    <DashboardLayout
      defaultRole="SUPER_ADMIN"
      activeItem="users"
      pageTitle="User Management"
    >
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#243447]">
              User Directory & Accounts
            </h1>
            <p className="text-xs sm:text-sm text-[#5B6875] mt-1">
              Browse, inspect, edit, and manage accounts for owners, tenants, property managers, and administrators
            </p>
          </div>
        </div>

        {/* Feedback Alert Banners */}
        {toast && (
          <div className="p-3.5 rounded-lg bg-[#EDF7EE] border border-[#C6DEC8] flex items-center justify-between text-xs text-[#2A583B] animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#3F7D58] shrink-0" />
              <span>{toast}</span>
            </div>
            <button
              type="button"
              onClick={() => setToast('')}
              className="text-[#2A583B] hover:opacity-75 p-1"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-[#FDF2F2] border border-[#F8D7DA] flex items-center justify-between gap-3 text-xs text-[#B94A48] animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={loadUsers}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Search, Role, and Status Filter Bar */}
        <div className="bg-white rounded-lg border border-[#D9E0E6] p-4 sm:p-5 shadow-2xs space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-5">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  loadUsers()
                }}
              >
                <Input
                  placeholder="Search by name or email (e.g. user@example.com)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="w-4 h-4 text-[#5B6875]" />}
                />
              </form>
            </div>

            <div className="sm:col-span-3">
              <Select
                options={ROLE_OPTIONS}
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              />
            </div>

            <div className="sm:col-span-3">
              <Select
                options={STATUS_OPTIONS}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            </div>

            <div className="sm:col-span-1 flex items-center gap-1.5 justify-end">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  title="Reset filters"
                  aria-label="Reset filters"
                  className="p-2 rounded-md border border-[#D9E0E6] text-[#5B6875] hover:text-[#243447] hover:bg-[#EAF2F7] transition-colors shrink-0"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={loadUsers}
                title="Refresh user list"
                aria-label="Refresh user list"
                disabled={loading}
                className="p-2 rounded-md border border-[#D9E0E6] text-[#5B6875] hover:text-[#315A7D] hover:bg-[#EAF2F7] transition-colors shrink-0 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-[#5B6875] pt-1 border-t border-[#D9E0E6]">
            <span>
              Showing{' '}
              <strong className="text-[#243447]">
                {filteredUsers.length}
              </strong>{' '}
              of {users.length} loaded users
            </span>
            {hasActiveFilters && (
              <span className="text-[#315A7D] font-semibold">
                Filters active
              </span>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="bg-white rounded-lg border border-[#D9E0E6] p-12 shadow-2xs flex justify-center">
            <Loader text="Loading user directory from server..." size="md" center />
          </div>
        ) : filteredUsers.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-lg border border-[#D9E0E6] p-8 shadow-2xs">
            <EmptyState
              icon={<Users className="w-8 h-8" />}
              title="No users match your criteria"
              message="Try adjusting your search query or switching role/status filters to view more accounts."
            />
          </div>
        ) : (
          /* Responsive Table */
          <div className="bg-white rounded-lg border border-[#D9E0E6] shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#D9E0E6] bg-[#F7F8FA] text-[11px] font-bold uppercase tracking-wider text-[#5B6875]">
                    <th className="py-3 pl-6 pr-4">User Name</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Account Status</th>
                    <th className="py-3 px-4">Verification</th>
                    <th className="py-3 px-4">Join Date</th>
                    <th className="py-3 pl-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D9E0E6] text-sm bg-white">
                  {filteredUsers.map((u) => (
                    <tr
                      key={u.id}
                      className="hover:bg-[#F7F8FA] transition-colors"
                    >
                      {/* Name */}
                      <td className="py-3.5 pl-6 pr-4 font-semibold text-[#243447] min-w-[180px]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#EAF2F7] border border-[#D9E0E6] flex items-center justify-center font-bold text-xs text-[#315A7D] shrink-0">
                            {u.name?.charAt(0) || 'U'}
                          </div>
                          <span className="truncate">{u.name}</span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 text-xs font-mono text-[#5B6875] whitespace-nowrap">
                        {u.email}
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs border font-medium ${getRoleBadgeClass(
                            u.role
                          )}`}
                        >
                          {getRoleIcon(u.role)}
                          <span>{u.role}</span>
                        </span>
                      </td>

                      {/* Account Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge status={u.status} size="sm" />
                      </td>

                      {/* Verification Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border ${
                            u.verificationStatus === 'Verified'
                              ? 'text-[#2A583B] bg-[#EDF7EE] border-[#C6DEC8]'
                              : 'text-[#8A5B16] bg-[#FEF7EC] border-[#F4E2B6]'
                          }`}
                        >
                          {u.verificationStatus === 'Verified' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#3F7D58]" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-[#B7791F]" />
                          )}
                          <span>{u.verificationStatus}</span>
                        </span>
                      </td>

                      {/* Join Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-[#5B6875] font-mono">
                        {u.joinDate}
                      </td>

                      {/* Actions Column */}
                      <td className="py-3.5 pl-4 pr-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleViewDetails(u.id)}
                            title="View User Details"
                            aria-label={`View details for ${u.name}`}
                            className="p-1.5 rounded-md text-[#5B6875] hover:text-[#315A7D] hover:bg-[#EAF2F7] transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(u)}
                            title="Edit User Profile"
                            aria-label={`Edit profile for ${u.name}`}
                            className="p-1.5 rounded-md text-[#5B6875] hover:text-[#243447] hover:bg-[#EAF2F7] transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenStatusModal(u)}
                            title="Update Account Status"
                            aria-label={`Update account status for ${u.name}`}
                            className="p-1.5 rounded-md text-[#5B6875] hover:text-[#3F7D58] hover:bg-[#EDF7EE] transition-colors"
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(u)}
                            title="Delete User Account"
                            aria-label={`Delete account for ${u.name}`}
                            className="p-1.5 rounded-md text-[#5B6875] hover:text-[#B94A48] hover:bg-[#FDF2F2] transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal 1: User Details */}
        {isDetailsOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-in fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-details-title"
          >
            <div className="bg-white rounded-xl border border-[#D9E0E6] max-w-lg w-full p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-[#D9E0E6]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#EAF2F7] border border-[#D9E0E6] flex items-center justify-center font-bold text-sm text-[#315A7D]">
                    {selectedUser?.name?.charAt(0) || <User className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 id="user-details-title" className="text-base font-bold text-[#243447]">
                      {selectedUser?.name || 'User Profile'}
                    </h3>
                    <p className="text-xs text-[#5B6875]">User ID: #{selectedUser?.id}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDetailsOpen(false)}
                  className="text-[#5B6875] hover:text-[#243447] p-1 rounded-md"
                  aria-label="Close user details modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isLoadingDetails ? (
                <div className="py-8 flex justify-center">
                  <Loader size="md" text="Loading user details..." center />
                </div>
              ) : detailsError ? (
                <div className="p-3 rounded-lg bg-[#FDF2F2] border border-[#F8D7DA] text-xs text-[#B94A48]">
                  {detailsError}
                </div>
              ) : selectedUser ? (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3 p-3.5 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6]">
                    <div>
                      <span className="text-[#5B6875] block">First Name</span>
                      <strong className="text-[#243447] font-semibold">{selectedUser.firstName || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-[#5B6875] block">Last Name</span>
                      <strong className="text-[#243447] font-semibold">{selectedUser.lastName || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-[#5B6875] block">Email Address</span>
                      <strong className="text-[#243447] font-semibold break-all">{selectedUser.email || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-[#5B6875] block">Phone Number</span>
                      <strong className="text-[#243447] font-semibold">{selectedUser.phone || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-[#5B6875] block">Gender</span>
                      <strong className="text-[#243447] font-semibold">{selectedUser.gender || '—'}</strong>
                    </div>
                    <div>
                      <span className="text-[#5B6875] block">Account Role</span>
                      <span className={`inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded text-[11px] border font-medium ${getRoleBadgeClass(selectedUser.role)}`}>
                        {getRoleIcon(selectedUser.role)}
                        <span>{selectedUser.role}</span>
                      </span>
                    </div>
                    <div>
                      <span className="text-[#5B6875] block">Account Status</span>
                      <div className="mt-0.5">
                        <StatusBadge status={selectedUser.status} size="sm" />
                      </div>
                    </div>
                    <div>
                      <span className="text-[#5B6875] block">Registration Date</span>
                      <strong className="text-[#243447] font-semibold">{selectedUser.joinDate || '—'}</strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#D9E0E6]">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsDetailsOpen(false)
                        handleOpenEdit(selectedUser)
                      }}
                      leftIcon={<Pencil className="w-3.5 h-3.5" />}
                    >
                      Edit User
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsDetailsOpen(false)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Modal 2: Edit User Profile */}
        {editUserModalData && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-in fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-user-title"
          >
            <div className="bg-white rounded-xl border border-[#D9E0E6] max-w-md w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-2 border-b border-[#D9E0E6]">
                <h3 id="edit-user-title" className="text-base font-bold text-[#243447]">
                  Edit User Profile
                </h3>
                <button
                  type="button"
                  onClick={() => !isSubmittingEdit && setEditUserModalData(null)}
                  disabled={isSubmittingEdit}
                  className="text-[#5B6875] hover:text-[#243447] p-1 rounded-md"
                  aria-label="Close edit user modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {editError && (
                <div className="p-3 rounded-lg bg-[#FDF2F2] border border-[#F8D7DA] text-xs text-[#B94A48]">
                  {editError}
                </div>
              )}

              <form onSubmit={handleEditSubmit} className="space-y-3.5">
                <Input
                  label="First Name"
                  value={editUserModalData.firstName}
                  onChange={(e) =>
                    setEditUserModalData((prev) => ({ ...prev, firstName: e.target.value }))
                  }
                  error={editFormErrors.firstName}
                  disabled={isSubmittingEdit}
                  required
                />

                <Input
                  label="Last Name"
                  value={editUserModalData.lastName}
                  onChange={(e) =>
                    setEditUserModalData((prev) => ({ ...prev, lastName: e.target.value }))
                  }
                  error={editFormErrors.lastName}
                  disabled={isSubmittingEdit}
                  required
                />

                <Input
                  label="Email Address"
                  type="email"
                  value={editUserModalData.email}
                  onChange={(e) =>
                    setEditUserModalData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  error={editFormErrors.email}
                  disabled={isSubmittingEdit}
                  required
                />

                <Input
                  label="Phone Number"
                  value={editUserModalData.phone}
                  onChange={(e) =>
                    setEditUserModalData((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  error={editFormErrors.phone}
                  disabled={isSubmittingEdit}
                />

                <Select
                  label="Gender"
                  options={GENDER_OPTIONS}
                  value={editUserModalData.gender}
                  onChange={(e) =>
                    setEditUserModalData((prev) => ({ ...prev, gender: e.target.value }))
                  }
                  disabled={isSubmittingEdit}
                />

                <div className="pt-3 border-t border-[#D9E0E6] flex items-center justify-end gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditUserModalData(null)}
                    disabled={isSubmittingEdit}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isSubmittingEdit}
                    leftIcon={<Save className="w-3.5 h-3.5" />}
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 3: Update Account Status */}
        {statusModalData && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-in fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-status-title"
          >
            <div className="bg-white rounded-xl border border-[#D9E0E6] max-w-md w-full p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#D9E0E6]">
                <h3 id="change-status-title" className="text-base font-bold text-[#243447]">
                  Update User Account Status
                </h3>
                <button
                  type="button"
                  onClick={() => !isUpdatingStatus && setStatusModalData(null)}
                  disabled={isUpdatingStatus}
                  className="text-[#5B6875] hover:text-[#243447] p-1 rounded-md"
                  aria-label="Close status modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-[#5B6875]">
                Update account status for{' '}
                <strong className="text-[#243447]">{statusModalData.name}</strong> ({statusModalData.email}):
              </p>

              {statusError && (
                <div className="p-3 rounded-lg bg-[#FDF2F2] border border-[#F8D7DA] text-xs text-[#B94A48]">
                  {statusError}
                </div>
              )}

              <form onSubmit={handleStatusSubmit} className="space-y-4">
                <Select
                  label="New Account Status"
                  options={[
                    { value: USER_STATUSES.ACTIVE, label: 'Active (Full Platform Access)' },
                    { value: USER_STATUSES.INACTIVE, label: 'Inactive (Temporary Suspension)' },
                    { value: USER_STATUSES.BLOCKED, label: 'Blocked (Access Denied)' },
                    { value: USER_STATUSES.PENDING, label: 'Pending (Awaiting Verification)' },
                  ]}
                  value={statusModalData.newStatus}
                  onChange={(e) =>
                    setStatusModalData((prev) => ({ ...prev, newStatus: e.target.value }))
                  }
                  disabled={isUpdatingStatus}
                />

                <div className="pt-3 border-t border-[#D9E0E6] flex items-center justify-end gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setStatusModalData(null)}
                    disabled={isUpdatingStatus}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isUpdatingStatus}
                    leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}
                  >
                    Update Status
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 4: Delete User Confirmation */}
        <DeleteConfirmModal
          isOpen={Boolean(userToDelete)}
          onClose={() => !isDeleting && setUserToDelete(null)}
          onConfirm={handleDeleteConfirm}
          title="Delete User Account"
          itemName={userToDelete ? `${userToDelete.name} (${userToDelete.email})` : ''}
          consequenceMessage="This will permanently delete this user account from SmartEstate. All credentials will be invalidated. This action cannot be undone."
          isLoading={isDeleting}
        />
        {deleteError && (
          <div className="p-3 rounded-lg bg-[#FDF2F2] border border-[#F8D7DA] text-xs text-[#B94A48]">
            {deleteError}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

