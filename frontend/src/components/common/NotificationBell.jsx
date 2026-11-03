import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Bell, Check, Clock, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from "../../context/notificationcontext"

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuth()
  const role = String(user?.role || '').toUpperCase()

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    loading,
    error,
    refreshNotifications,
  } = useNotifications()
  const dropdownRef = useRef(null)
  const bellButtonRef = useRef(null)
  const [dropdownPosition, setDropdownPosition] = useState(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        !dropdownRef.current?.contains(event.target) &&
        !bellButtonRef.current?.contains(event.target)
      ) {
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

  useEffect(() => {
    if (!isOpen) {
      setDropdownPosition(null)
      return undefined
    }

    const updateDropdownPosition = () => {
      const bellBounds = bellButtonRef.current?.getBoundingClientRect()
      if (!bellBounds) return

      const margin = 16
      const width = Math.min(384, window.innerWidth - margin * 2)
      const left = Math.max(
        margin,
        Math.min(bellBounds.right - width, window.innerWidth - width - margin)
      )
      const preferredTop = bellBounds.bottom + 8
      const availableBelow = window.innerHeight - preferredTop - margin

      if (availableBelow < 260 && bellBounds.top > 260) {
        const height = Math.min(480, bellBounds.top - margin - 8)
        setDropdownPosition({
          left,
          top: Math.max(margin, bellBounds.top - height - 8),
          width,
          maxHeight: height,
        })
        return
      }

      setDropdownPosition({
        left,
        top: preferredTop,
        width,
        maxHeight: Math.max(180, Math.min(480, availableBelow)),
      })
    }

    updateDropdownPosition()
    window.addEventListener('resize', updateDropdownPosition)
    window.addEventListener('scroll', updateDropdownPosition, true)

    return () => {
      window.removeEventListener('resize', updateDropdownPosition)
      window.removeEventListener('scroll', updateDropdownPosition, true)
    }
  }, [isOpen])

  // Mark all notifications as read
  const markAllRead = async () => {
    await markAllAsRead()
  }

  // Mark one notification as read
  const handleNotificationClick = async (notification) => {
    if (!notification) return

    if (!notification.read) {
      await markAsRead(notification.notificationId)
    }

    const referenceType = String(notification.referenceType || '').toUpperCase()
    const referenceId = notification.referenceId
    if (referenceId == null || String(referenceId).trim() === '') return

    const encodedId = encodeURIComponent(referenceId)
    let destination = null

    if (['RENTAL_APPLICATION', 'APPLICATION'].includes(referenceType)) {
      if (['PROPERTY_OWNER', 'OWNER'].includes(role)) {
        destination = `/owner/applications/${encodedId}`
      } else if (role === 'TENANT') {
        destination = `/tenant/applications/${encodedId}`
      } else if (role === 'PROPERTY_MANAGER') {
        destination = `/manager/applications/${encodedId}`
      }
    } else if (referenceType === 'MAINTENANCE') {
      if (['PROPERTY_OWNER', 'OWNER'].includes(role)) {
        destination = `/owner/maintenance/${encodedId}`
      } else if (role === 'TENANT') {
        destination = '/tenant/maintenance'
      } else if (role === 'PROPERTY_MANAGER') {
        destination = `/manager/maintenance?ticket=${encodedId}`
      }
    } else if (['PAYMENT', 'RENT_PAYMENT'].includes(referenceType)) {
      if (['PROPERTY_OWNER', 'OWNER'].includes(role)) {
        destination = `/owner/payments/${encodedId}`
      } else if (role === 'PROPERTY_MANAGER') {
        destination = `/manager/payments/${encodedId}`
      }
    }

    if (destination) {
      setIsOpen(false)
      navigate(destination)
    }
  }

  // Format backend createdAt value
  const formatNotificationTime = (createdAt) => {
    if (!createdAt) {
      return ''
    }

    const date = new Date(createdAt)

    if (Number.isNaN(date.getTime())) {
      return ''
    }

    return date.toLocaleString([], {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  }

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        ref={bellButtonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open notifications"
        className="relative p-2 rounded-md text-[#5B6875] hover:text-[#111820] hover:bg-[#EDF4ED] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3F7D58]"
      >
        <Bell className="w-5 h-5" />

        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#B94A48] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#B94A48]" />
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && dropdownPosition && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            left: dropdownPosition.left,
            top: dropdownPosition.top,
            width: dropdownPosition.width,
            maxHeight: dropdownPosition.maxHeight,
            zIndex: 10000,
          }}
          className="flex flex-col rounded-lg border border-[#E3E8DF] bg-white shadow-xl"
        >

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E3E8DF]">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[#111820]">
                Notifications
              </h3>

              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-[#EDF4ED] text-[#3F7D58] border border-[#E3E8DF]">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-medium text-[#3F7D58] hover:underline flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                Mark read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div
            className="min-h-0 overflow-y-auto divide-y divide-[#E3E8DF]"
            style={{ maxHeight: Math.max(80, dropdownPosition.maxHeight - 112) }}
          >

            {error && (
              <div className="flex items-start justify-between gap-3 border-b border-[#F8B4B4] bg-[#FDF2F2] p-3 text-xs text-[#9B1C1C]" role="alert">
                <span>{error}</span>
                <button
                  type="button"
                  onClick={refreshNotifications}
                  className="shrink-0 font-semibold underline underline-offset-2"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Loading */}
            {loading ? (
              <div className="p-6 text-center text-sm text-[#5B6875]">
                Loading notifications...
              </div>
            ) : error && notifications.length === 0 ? null : notifications.length === 0 ? (
              /* No notifications */
              <div className="p-6 text-center text-sm text-[#5B6875]">
                No notifications right now
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.notificationId}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3.5 flex items-start gap-3 transition-colors hover:bg-[#F7F7F1] cursor-pointer ${!item.read
                    ? 'bg-white'
                    : 'bg-[#EDF4ED]/50'
                    }`}
                >
                  {/* Notification Icon */}
                  <div className="mt-0.5 p-1.5 rounded-md bg-[#EDF4ED] text-[#3F7D58] border border-[#E3E8DF] shrink-0">
                    <AlertCircle className="w-4 h-4" />
                  </div>

                  {/* Notification Content */}
                  <div className="flex-1 min-w-0">

                    {/* Title */}
                    <p className="text-xs font-semibold text-[#111820] truncate">
                      {item.title}
                    </p>

                    {/* Message */}
                    <p className="text-xs text-[#5B6875] mt-0.5 line-clamp-2">
                      {item.message}
                    </p>

                    {/* Time */}
                    <div className="flex items-center gap-1 mt-1 text-[11px] text-[#5B6875]">
                      <Clock className="w-3 h-3" />

                      <span>
                        {formatNotificationTime(item.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Unread Indicator */}
                  {!item.read && (
                    <span className="w-2 h-2 rounded-full bg-[#B94A48] shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-[#E3E8DF] bg-[#F7F7F1] text-center">
            <span className="text-[11px] text-[#5B6875]">
              Refreshes automatically every 10 seconds
            </span>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
