// Service Worker for Productivity Hub
// Caches static assets for faster loading and offline capability

const CACHE_NAME = 'productivity-hub-v15';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/login.html',
    '/main.css',
    '/pomodoro.css',
    '/tasks.css',
    '/auth.css',
    '/canvas.css',
    '/main.js',
    '/pomodoro.js',
    '/tasks.js',
    '/auth.js',
    '/canvas.js',
    '/firebase-config.js',
    '/timer-worker.js',
    '/assets/track.png',
    '/assets/choose_acctivity.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

// Handle messages from the main page (for notifications)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const { title, body, tag } = event.data;

        self.registration.showNotification(title, {
            body: body,
            icon: '/assets/track.png',
            badge: '/assets/track.png',
            tag: tag || 'pomodoro-notification',
            requireInteraction: true,
            vibrate: [200, 100, 200],
            actions: [
                { action: 'focus', title: 'Open Timer' },
                { action: 'dismiss', title: 'Dismiss' }
            ]
        });
    }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'dismiss') {
        return;
    }

    // Focus or open the app
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Try to focus an existing window
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Open a new window if none exists
                if (clients.openWindow) {
                    return clients.openWindow('/');
                }
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip non-http(s) requests (like chrome-extension://)
    if (!url.protocol.startsWith('http')) return;

    // Skip Firebase API calls (let them go through network)
    if (url.hostname.includes('firebaseio.com') ||
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('identitytoolkit.googleapis.com')) {
        return;
    }

    // For static assets - cache first, then network
    if (STATIC_ASSETS.some(asset => url.pathname === asset || url.pathname.endsWith(asset))) {
        event.respondWith(
            caches.match(request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        // Return cached version and update cache in background
                        fetch(request)
                            .then((networkResponse) => {
                                if (networkResponse && networkResponse.status === 200) {
                                    caches.open(CACHE_NAME)
                                        .then((cache) => cache.put(request, networkResponse));
                                }
                            })
                            .catch(() => { });
                        return cachedResponse;
                    }
                    // Not in cache, fetch from network
                    return fetch(request).then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200) {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => cache.put(request, responseClone));
                        }
                        return networkResponse;
                    });
                })
        );
        return;
    }

    // For other requests - network first, cache fallback
    event.respondWith(
        fetch(request)
            .then((networkResponse) => {
                // Cache successful responses
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME)
                        .then((cache) => cache.put(request, responseClone));
                }
                return networkResponse;
            })
            .catch(() => {
                // Network failed, try cache
                return caches.match(request);
            })
    );
});
