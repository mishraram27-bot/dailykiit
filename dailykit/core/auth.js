;(function(){
const SESSION_KEY = "plifeos_session"
const CLOUD_DOC_COLLECTION = "plifeosUsers"

let currentSession = null
let firebaseState = {
  enabled: false,
  ready: false,
  auth: null,
  db: null,
  modules: null
}

function getFirebaseConfig(){
  const config = window.PlifeOSFirebaseConfig || {}
  return config
}

function hasFirebaseConfig(){
  const config = getFirebaseConfig()
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId)
}

function createRandomId(){
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

function createGuestSession(){
  const guestId = `guest-${createRandomId().toLowerCase()}`

  return {
    mode: "guest",
    userId: guestId,
    displayName: `Guest ${guestId.slice(-6).toUpperCase()}`,
    email: "",
    avatar: "",
    cloudEnabled: false
  }
}

function readSession(){
  try{
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  }catch(error){
    return null
  }
}

function writeSession(session){
  currentSession = session

  if(session){
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  }else{
    localStorage.removeItem(SESSION_KEY)
  }

  updateAuthUi()
  window.dispatchEvent(new CustomEvent("plifeos:session-changed", {detail: session}))
}

function getSession(){
  return currentSession
}

function hasSession(){
  return Boolean(currentSession && currentSession.userId)
}

function isGoogleSession(){
  return currentSession?.mode === "google"
}

function getStorageNamespace(){
  return currentSession?.userId || null
}

function updateAuthUi(){
  const gate = document.getElementById("authGate")
  const badge = document.getElementById("sessionBadge")
  const hint = document.getElementById("authHint")
  const switchAccountBtn = document.getElementById("switchAccountBtn")

  if(gate){
    gate.classList.toggle("is-hidden", hasSession())
  }

  document.body.classList.toggle("auth-locked", !hasSession())

  if(badge){
    badge.textContent = hasSession() ? currentSession.displayName : "Signed out"
  }

  if(hint){
    hint.textContent = "Guest mode is active for this release. Your data stays on this device unless you export a backup."
  }

  if(switchAccountBtn){
    switchAccountBtn.style.display = hasSession() ? "inline-flex" : "none"
  }
}

async function initFirebase(){
  if(firebaseState.ready || !hasFirebaseConfig()){
    updateAuthUi()
    return firebaseState
  }

  const version = window.PlifeOSFirebaseSdkVersion || "11.9.0"
  const [appModule, authModule, firestoreModule] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${version}/firebase-firestore.js`)
  ])

  const app = appModule.initializeApp(getFirebaseConfig())
  const auth = authModule.getAuth(app)
  const db = firestoreModule.getFirestore(app)

  firebaseState = {
    enabled: true,
    ready: true,
    auth,
    db,
    modules: {
      authModule,
      firestoreModule
    }
  }

  const redirectResult = await authModule.getRedirectResult(auth).catch(() => null)

  if(redirectResult?.user){
    await completeGoogleLogin(redirectResult.user)
  }

  updateAuthUi()
  return firebaseState
}

async function completeGoogleLogin(user){
  const previousSession = currentSession

  const nextSession = {
    mode: "google",
    userId: user.uid,
    displayName: user.displayName || user.email || "Google User",
    email: user.email || "",
    avatar: user.photoURL || "",
    cloudEnabled: true
  }

  if(previousSession?.userId && previousSession.userId !== nextSession.userId && window.PlifeOSStorage){
    PlifeOSStorage.transferUserData(previousSession.userId, nextSession.userId)
  }

  writeSession(nextSession)
}

async function continueAsGuest(){
  if(hasSession()){
    return currentSession
  }

  const session = createGuestSession()
  writeSession(session)
  return session
}

function isMobileLike(){
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 720
}

async function signInWithGoogle(){
  if(!hasFirebaseConfig()){
    alert("Add your Firebase project keys in firebase-config.js first to enable Google sign-in.")
    return null
  }

  try{
    const state = await initFirebase()
    const {authModule} = state.modules
    const provider = new authModule.GoogleAuthProvider()
    provider.setCustomParameters({prompt: "select_account"})

    if(isMobileLike()){
      await authModule.signInWithRedirect(state.auth, provider)
      return null
    }

    const result = await authModule.signInWithPopup(state.auth, provider)
    await completeGoogleLogin(result.user)
    return currentSession
  }catch(error){
    console.error(error)
    alert("Google sign-in could not start. Check your Firebase Auth, authorized domain, and Google provider setup.")
    return null
  }
}

async function saveBackupToCloud(){
  if(!(isGoogleSession() && firebaseState.enabled)){
    alert("Sign in with Google first to use cloud backup.")
    return
  }

  const {firestoreModule} = firebaseState.modules
  const payload = {
    backup: PlifeOSStorage.exportBackup(),
    updatedAt: firestoreModule.serverTimestamp(),
    profile: {
      displayName: currentSession.displayName,
      email: currentSession.email
    }
  }

  await firestoreModule.setDoc(
    firestoreModule.doc(firebaseState.db, CLOUD_DOC_COLLECTION, currentSession.userId),
    payload,
    {merge: true}
  )

  updateAuthUi()
  alert("Cloud backup saved.")
}

async function restoreBackupFromCloud(){
  if(!(isGoogleSession() && firebaseState.enabled)){
    alert("Sign in with Google first to restore from cloud.")
    return
  }

  const {firestoreModule} = firebaseState.modules
  const snapshot = await firestoreModule.getDoc(
    firestoreModule.doc(firebaseState.db, CLOUD_DOC_COLLECTION, currentSession.userId)
  )

  if(!snapshot.exists()){
    alert("No cloud backup was found for this account yet.")
    return
  }

  const data = snapshot.data()
  PlifeOSStorage.importBackup(data.backup || {})
  window.dispatchEvent(new CustomEvent("plifeos:cloud-restored"))
  alert("Cloud backup restored.")
}

function signOut(){
  if(firebaseState.enabled && firebaseState.auth && isGoogleSession()){
    firebaseState.modules.authModule.signOut(firebaseState.auth).catch(() => {})
  }

  writeSession(null)
}

async function init(){
  currentSession = readSession()

  bindUi()
  updateAuthUi()

  if(hasFirebaseConfig()){
    try{
      await initFirebase()
    }catch(error){
      console.error(error)
      updateAuthUi()
    }
  }

  return currentSession
}

function bindUi(){
  const guestBtn = document.getElementById("guestLoginBtn")
  const switchBtn = document.getElementById("switchAccountBtn")

  if(guestBtn && !guestBtn.dataset.bound){
    guestBtn.dataset.bound = "true"
    guestBtn.addEventListener("click", continueAsGuest)
  }

  if(switchBtn && !switchBtn.dataset.bound){
    switchBtn.dataset.bound = "true"
    switchBtn.addEventListener("click", () => {
      signOut()
    })
  }
}

window.PlifeOSAuth = {
  init,
  hasSession,
  getSession,
  getStorageNamespace,
  continueAsGuest,
  signInWithGoogle,
  signOut,
  hasFirebaseConfig,
  saveBackupToCloud,
  restoreBackupFromCloud
}
})()
