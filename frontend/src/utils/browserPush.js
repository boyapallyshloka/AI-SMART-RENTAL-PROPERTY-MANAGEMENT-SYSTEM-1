const decodeVapidPublicKey = (key) => {
  const padding = '='.repeat((4 - (key.length % 4)) % 4)
  const base64 = (key + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from(raw, (character) => character.charCodeAt(0))
}

export const createBrowserPushSubscription = async () => {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('This browser does not support Web Push notifications.')
  }

  if (!('Notification' in window)) {
    throw new Error('This browser does not support notification permissions.')
  }

  const vapidPublicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY
  if (!vapidPublicKey) {
    throw new Error('Browser push is not configured for this deployment.')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.')
  }

  const registration = await navigator.serviceWorker.register('/service-worker.js')
  const subscription =
    (await registration.pushManager.getSubscription()) ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeVapidPublicKey(vapidPublicKey),
    }))

  return subscription.toJSON()
}
