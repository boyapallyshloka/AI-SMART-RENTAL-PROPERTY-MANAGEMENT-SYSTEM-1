import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Settings, LogOut, ChevronDown, Shield } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { ROLES, normalizeRole, getRoleLabel, isPropertyManager, isPropertyOwner, isTenant } from '../../utils/roles'
import ProfileModal from './ProfileModal'

/**
 * UserMenu Component for Topbar
 * Updated to use SmartEstate Primary Blue #3F7D58
 * Connected to live user profile from GET /api/users/me with ProfileModal
 *
 * @param {Object} props
 * @param {string} [props.role]
 * @param {() => void} [props.onLogout]
 */
export default function UserMenu({ role, onLogout }) {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [modalTab, setModalTab] = useState('profile')
  const menuRef = useRef(null)

  let auth = null
  try {
    auth = useAuth()
  } catch (e) {
    // Graceful fallback if used outside AuthProvider
  }

  const effectiveRole = normalizeRole(role || auth?.user?.role || ROLES.PROPERTY_OWNER)
  const roleLabel = auth?.user?.roleLabel || getRoleLabel(effectiveRole)

  const userName =
    auth?.user?.name ||
    [auth?.user?.firstName, auth?.user?.lastName].filter(Boolean).join(' ') ||
    auth?.user?.email ||
    roleLabel ||
    'User'

  const userEmail = auth?.user?.email || ''

  const userAvatar =
    auth?.user?.avatarText ||
    ((auth?.user?.firstName?.[0] || '') + (auth?.user?.lastName?.[0] || '')) ||
    (userName && userName !== 'User' ? userName.slice(0, 2).toUpperCase() : 'U')

  const userInfo = {
    name: userName,
    email: userEmail,
    roleLabel,
    avatarText: (userAvatar || 'U').toUpperCase(),
  }

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleLogoutClick = () => {
    setIsOpen(false)
    if (onLogout) {
      onLogout()
    } else if (auth?.logout) {
      auth.logout()
    }
  }

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="User menu"
          className="flex items-center gap-2.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-md hover:bg-[#EDF4ED] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3F7D58]"
        >
          <div className="w-8 h-8 rounded-md bg-[#3F7D58] text-white flex items-center justify-center text-xs font-semibold shadow-xs">
            {userInfo.avatarText}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-[#111820] leading-tight">
              {userInfo.name}
            </p>
            <p className="text-[11px] text-[#5B6875] capitalize">
              {userInfo.roleLabel}
            </p>
          </div>
          <ChevronDown className="hidden sm:block w-3.5 h-3.5 text-[#5B6875]" />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-60 rounded-lg bg-white border border-[#E3E8DF] shadow-md z-50 overflow-hidden animate-in fade-in">
            <div className="px-4 py-3 border-b border-[#E3E8DF] bg-[#F7F7F1]">
              <p className="text-xs font-semibold text-[#111820]">
                {userInfo.name}
              </p>
              <p className="text-[11px] text-[#5B6875] truncate">
                {userInfo.email}
              </p>
              <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#EDF4ED] text-[#3F7D58] border border-[#E3E8DF]">
                <Shield className="w-3 h-3" />
                <span>{userInfo.roleLabel}</span>
              </div>
            </div>

            <div className="p-1.5 text-xs text-[#111820]">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  if (isPropertyManager(effectiveRole)) {
                    navigate('/manager/account')
                  } else if (isPropertyOwner(effectiveRole)) {
                    navigate('/owner/account')
                  } else if (isTenant(effectiveRole)) {
                    navigate('/tenant/account')
                  } else {
                    setModalTab('profile')
                    setIsProfileOpen(true)
                  }
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-[#EDF4ED] transition-colors text-left"
              >
                <User className="w-4 h-4 text-[#5B6875]" />
                <span>{effectiveRole === ROLES.SUPER_ADMIN ? 'My Profile' : 'My Account'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  if (isPropertyManager(effectiveRole)) {
                    navigate('/manager/account')
                  } else if (isPropertyOwner(effectiveRole)) {
                    navigate('/owner/account')
                  } else if (isTenant(effectiveRole)) {
                    navigate('/tenant/account')
                  } else {
                    setModalTab('security')
                    setIsProfileOpen(true)
                  }
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-[#EDF4ED] transition-colors text-left"
              >
                <Settings className="w-4 h-4 text-[#5B6875]" />
                <span>Account Settings</span>
              </button>
            </div>

            <div className="p-1.5 border-t border-[#E3E8DF]">
              <button
                type="button"
                onClick={handleLogoutClick}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[#B94A48] hover:bg-[#FDF2F2] transition-colors font-medium text-xs text-left"
              >
                <LogOut className="w-4 h-4" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Profile & Security Modal connected to GET /api/users/me and PUT /api/auth/change-password */}
      <ProfileModal
        isOpen={isProfileOpen}
        initialTab={modalTab}
        onClose={() => setIsProfileOpen(false)}
      />
    </>
  )
}
