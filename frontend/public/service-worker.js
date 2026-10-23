self.addEventListener('push', (event) => {
  if (!event.data) {
    return
  }

  event.waitUntil((async () => {
    const payload = event.data.json()
    const url = payload?.data?.url

    await self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      data: { url },
    })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url
  if (typeof targetUrl !== 'string') {
    return
  }

  let target
  try {
    target = new URL(targetUrl, self.location.origin)
  } catch {
    return
  }

  if (
    target.origin !== self.location.origin ||
    !/^\/(tenant|owner|manager)\/resolve$/.test(target.pathname)
  ) {
    return
  }

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    })
    const existing = windows.find(
      (client) => new URL(client.url).origin === self.location.origin
    )

    if (existing) {
      await existing.navigate(target.href)
      await existing.focus()
      return
    }

    await self.clients.openWindow(target.href)
  })())
})
