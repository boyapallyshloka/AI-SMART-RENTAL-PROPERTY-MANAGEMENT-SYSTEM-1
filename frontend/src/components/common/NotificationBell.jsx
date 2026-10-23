import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, Clock, AlertCircle } from 'lucide-react'
import { useNotifications } from "../../context/notificationcontext"
import { registerPushSubscription } from "../../api/pushApi"
import { createBrowserPushSubscription } from "../../utils/browserPush"

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [pushMessage, setPushMessage] = useState('')
  const [pushBusy, setPushBusy] = useState(false)
  const navigate = useNavigate()

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    loading,
  } = useNotifications()

  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
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

  // Mark all notifications as read
  const markAllRead = async () => {
    await markAllAsRead()
  }

  const enableBrowserPush = async () => {
    setPushBusy(true)
    setPushMessage('')
    try {
      const subscription = await createBrowserPushSubscription()
      await registerPushSubscription(subscription)
      setPushMessage('Browser notifications are enabled.')
    } catch (error) {
      setPushMessage(error?.message || 'Could not enable browser notifications.')
    } finally {
      setPushBusy(false)
    }
  }

  // Mark one notification as read
  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification.notificationId)
    }

    if (notification.referenceType === 'PROPERTY' && notification.referenceId) {
      if (notification.type === 'PROPERTY_SUBMITTED') {
        navigate('/admin/property-approvals')
        setIsOpen(false)
      } else if (notification.type === 'PROPERTY_APPROVED') {
        navigate(`/owner/properties/${notification.referenceId}`)
        setIsOpen(false)
      }
    }
  }

  const getNotificationAction = (notification) => {
    if (notification.type === 'PROPERTY_SUBMITTED') return 'Open property review'
    if (notification.type === 'PROPERTY_APPROVED') return 'View property'
    return null
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
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open notifications"
        className="relative p-2 rounded-md text-[#5B6875] hover:text-[#243447] hover:bg-[#EAF2F7] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#315A7D]"
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
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-lg bg-white border border-[#D9E0E6] shadow-md z-50 overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#D9E0E6]">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[#243447]">
                Notifications
              </h3>

              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded bg-[#EAF2F7] text-[#315A7D] border border-[#D9E0E6]">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-medium text-[#315A7D] hover:underline flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                Mark read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-[#D9E0E6]">

            {/* Loading */}
            {loading ? (
              <div className="p-6 text-center text-sm text-[#5B6875]">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              /* No notifications */
              <div className="p-6 text-center text-sm text-[#5B6875]">
                No notifications right now
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.notificationId}
                  onClick={() => handleNotificationClick(item)}
                  className={`p-3.5 flex items-start gap-3 transition-colors hover:bg-[#F7F8FA] cursor-pointer ${!item.read
                      ? 'bg-white'
                      : 'bg-[#EAF2F7]/50'
                    }`}
                >
                  {/* Notification Icon */}
                  <div className="mt-0.5 p-1.5 rounded-md bg-[#EAF2F7] text-[#315A7D] border border-[#D9E0E6] shrink-0">
                    <AlertCircle className="w-4 h-4" />
                  </div>

                  {/* Notification Content */}
                  <div className="flex-1 min-w-0">

                    {/* Title */}
                    <p className="text-xs font-semibold text-[#243447] truncate">
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
                    {getNotificationAction(item) && (
                      <p className="mt-1 text-[11px] font-semibold text-[#315A7D]">
                        {getNotificationAction(item)} →
                      </p>
                    )}
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
          <div className="p-2 border-t border-[#D9E0E6] bg-[#F7F8FA] text-center">
            <span className="text-[11px] text-[#5B6875]">
              Real-time property notifications
            </span>
            <button
              type="button"
              onClick={enableBrowserPush}
              disabled={pushBusy}
              className="mt-2 block w-full text-xs font-medium text-[#315A7D] hover:underline disabled:opacity-60"
            >
              {pushBusy ? 'Enabling…' : 'Enable browser notifications'}
            </button>
            {pushMessage && (
              <p role="status" className="mt-1 text-[11px] text-[#5B6875]">
                {pushMessage}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}