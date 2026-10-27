// public/sw.js
self.addEventListener('notificationclick', function (event) {
    const notificationData = event.notification.data || {};
    const targetUrl = notificationData.url || '/dashboard';

    event.notification.close(); // Close the native OS banner toast

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(function (clientList) {
                // If the landlord/tenant already has a dashboard tab open, use it
                for (let client of clientList) {
                    if (client.url.includes(self.location.origin) && 'navigate' in client) {
                        client.focus();
                        return client.navigate(targetUrl);
                    }
                }
                // If the website is closed completely, launch a brand new browser tab
                if (clients.openWindow) {
                    return clients.openWindow(targetUrl);
                }
            })
    );
});