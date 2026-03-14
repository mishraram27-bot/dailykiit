const CACHE_NAME = "dailykit-v9.1"

const urlsToCache = [
"/",
"/index.html",
"/pages/privacy.html",
"/pages/terms.html",
"/style.css",
"/app.js",
"/firebase-config.js",
"/core/auth.js",
"/core/storage.js",
"/core/feedback.js",
"/core/commandParser.js",
"/core/reporting.js",
"/core/reminders.js",
"/core/searchEngine.js",
"/core/router.js",
"/core/dashboard.js",
"/manifest.json",

"/tools/expenses.js",
"/tools/borrowed.js",
"/tools/grocery.js",
"/tools/habits.js",
"/tools/notes.js",
"/tools/subscriptions.js",

"/icons/icon-192.png",
"/icons/icon-512.png"
]

self.addEventListener("install", event => {

event.waitUntil(
caches.open(CACHE_NAME)
.then(cache => cache.addAll(urlsToCache))
)

})

self.addEventListener("activate", event => {

event.waitUntil(
caches.keys().then(keys => {
return Promise.all(
keys.filter(key => key !== CACHE_NAME)
.map(key => caches.delete(key))
)
})
)

})

self.addEventListener("fetch", event => {

event.respondWith(
caches.match(event.request).then(response => {
return response || fetch(event.request)
})
)

})
