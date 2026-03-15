const CACHE_NAME = "dailykit-v9.8"

const urlsToCache = [
"/",
"/index.html",
"/pages/privacy.html",
"/pages/terms.html",
"/style.css",
"/app.js",
"/firebase-config.js",
"/core/auth.js",
"/core/events.js",
"/core/storage.js",
"/core/feedback.js",
"/core/commandParser.js",
"/core/reporting.js",
"/core/reminders.js",
"/core/searchEngine.js",
"/core/router.js",
"/core/dashboard.js",
"/languages/en.json",
"/languages/hi.json",
"/manifest.json",

"/tools/expenses.js",
"/tools/borrowed.js",
"/tools/grocery.js",
"/tools/habits.js",
"/tools/notes.js",
"/tools/tasks.js",
"/tools/journal.js",
"/tools/subscriptions.js",

"/icons/icon-192.png",
"/icons/icon-512.png"
]

self.addEventListener("install", event => {

event.waitUntil(
caches.open(CACHE_NAME)
.then(cache => cache.addAll(urlsToCache))
.then(() => self.skipWaiting())
)

})

self.addEventListener("activate", event => {

event.waitUntil(
caches.keys().then(keys => {
return Promise.all(
keys.filter(key => key !== CACHE_NAME)
.map(key => caches.delete(key))
)
}).then(() => self.clients.claim())
)

})

self.addEventListener("message", event => {
if(event.data === "SKIP_WAITING"){
self.skipWaiting()
}
})

async function networkFirst(request){
  const cache = await caches.open(CACHE_NAME)

  try{
    const response = await fetch(request)
    cache.put(request, response.clone())
    return response
  }catch(error){
    return caches.match(request) || caches.match("/index.html")
  }
}

async function cacheFirst(request){
  const cached = await caches.match(request)

  if(cached){
    return cached
  }

  const cache = await caches.open(CACHE_NAME)
  const response = await fetch(request)
  cache.put(request, response.clone())
  return response
}

self.addEventListener("fetch", event => {
if(event.request.method !== "GET"){
return
}

const url = new URL(event.request.url)

if(url.origin !== self.location.origin){
return
}

const isDocumentRequest =
event.request.mode === "navigate" ||
event.request.destination === "document" ||
(event.request.headers.get("accept") || "").includes("text/html")

if(isDocumentRequest){
event.respondWith(networkFirst(event.request))
return
}

event.respondWith(
cacheFirst(event.request)
)

})
