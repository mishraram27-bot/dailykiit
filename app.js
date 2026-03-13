let languageData = {}
let deferredPrompt = null
let listenersBound = false

const searchState = {
  results: [],
  activeIndex: -1
}

function escapeHtml(value){
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

async function loadLanguage(lang){
  const response = await fetch(`languages/${lang}.json`)
  languageData = await response.json()

  applyLanguage()
  localStorage.setItem("language", lang)
}

function applyLanguage(){
  const nodes = {
    todayExpense: document.querySelector('[data-text="todayExpense"]'),
    borrowedPending: document.querySelector('[data-text="borrowedPending"]'),
    quickTools: document.querySelector('[data-text="quickTools"]')
  }

  Object.entries(nodes).forEach(([key, node]) => {
    if(node && languageData[key]){
      node.innerText = languageData[key]
    }
  })
}

function exportData(){
  const data = DailyKitStorage.exportBackup()
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], {type: "application/json"})
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = "dailykit-backup.json"
  link.click()

  URL.revokeObjectURL(url)
}

function renderSearchResults(){
  const resultsBox = document.getElementById("searchResults")

  if(!resultsBox){
    return
  }

  if(!searchState.results.length){
    resultsBox.innerHTML = "<div class='search-empty'>No results found</div>"
    resultsBox.style.display = "block"
    return
  }

  resultsBox.innerHTML = searchState.results.map((result, index) => {
    const activeClass = index === searchState.activeIndex ? " active" : ""

    return `
<button type="button" class="search-item${activeClass}" data-index="${index}">
<span class="search-title">${escapeHtml(result.title)}</span>
<span class="search-subtitle">${escapeHtml(result.subtitle)}</span>
</button>
`
  }).join("")

  resultsBox.style.display = "block"
}

function closeSearchResults(){
  const resultsBox = document.getElementById("searchResults")

  searchState.results = []
  searchState.activeIndex = -1

  if(resultsBox){
    resultsBox.innerHTML = ""
    resultsBox.style.display = "none"
  }
}

function runSearch(){
  const input = document.getElementById("globalSearch")

  if(!input){
    return
  }

  const query = input.value.trim()

  if(!query){
    closeSearchResults()
    return
  }

  searchState.results = DailyKitSearch.buildResults(query, DailyKitRouter.getToolRegistry())
  searchState.activeIndex = searchState.results.length ? 0 : -1

  renderSearchResults()
}

function selectSearchResult(index){
  const result = searchState.results[index]
  const input = document.getElementById("globalSearch")

  if(!result){
    return
  }

  if(input){
    input.value = ""
  }

  closeSearchResults()
  DailyKitRouter.openTool(result.toolId)
}

function handleSearchKeydown(event){
  if(!searchState.results.length){
    if(event.key === "Escape"){
      closeSearchResults()
    }

    return
  }

  if(event.key === "ArrowDown"){
    event.preventDefault()
    searchState.activeIndex = (searchState.activeIndex + 1) % searchState.results.length
    renderSearchResults()
    return
  }

  if(event.key === "ArrowUp"){
    event.preventDefault()
    searchState.activeIndex =
      (searchState.activeIndex - 1 + searchState.results.length) % searchState.results.length
    renderSearchResults()
    return
  }

  if(event.key === "Enter"){
    event.preventDefault()
    selectSearchResult(searchState.activeIndex >= 0 ? searchState.activeIndex : 0)
    return
  }

  if(event.key === "Escape"){
    closeSearchResults()
  }
}

function handleDocumentClick(event){
  const searchItem = event.target.closest(".search-item")

  if(searchItem){
    selectSearchResult(Number(searchItem.dataset.index))
    return
  }

  const searchBox = document.querySelector(".search-box")

  if(searchBox && !searchBox.contains(event.target)){
    closeSearchResults()
  }
}

function importData(){
  const input = document.getElementById("importFile")

  if(input){
    input.click()
  }
}

function rerenderActiveTool(){
  const activeToolId = DailyKitRouter.getActiveToolId()

  if(activeToolId && typeof renderTool === "function"){
    renderTool()
  }
}

function handleImportFileChange(event){
  const file = event.target.files[0]

  if(!file){
    return
  }

  const reader = new FileReader()

  reader.onload = function(loadEvent){
    try{
      const data = JSON.parse(loadEvent.target.result)
      DailyKitStorage.importBackup(data)
      event.target.value = ""
      alert("Backup restored successfully.")
      DailyKitDashboard.refreshDashboard()
      rerenderActiveTool()
    }catch(error){
      event.target.value = ""
      alert("Backup file is invalid.")
    }
  }

  reader.readAsText(file)
}

function installApp(){
  if(!deferredPrompt){
    return
  }

  deferredPrompt.prompt()
}

function initInstallPrompt(){
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault()
    deferredPrompt = event

    const button = document.getElementById("installBtn")

    if(button){
      button.style.display = "inline-flex"
    }
  })

  const button = document.getElementById("installBtn")

  if(button && !button.dataset.bound){
    button.dataset.bound = "true"
    button.addEventListener("click", async () => {
      if(!deferredPrompt){
        return
      }

      deferredPrompt.prompt()
      await deferredPrompt.userChoice
      deferredPrompt = null
      button.style.display = "none"
    })
  }
}

function initServiceWorker(){
  if(!("serviceWorker" in navigator)){
    return
  }

  const isLocalDev =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1"

  if(isLocalDev){
    window.addEventListener("load", async () => {
      const registrations = await navigator.serviceWorker.getRegistrations()

      await Promise.all(registrations.map((registration) => registration.unregister()))

      if("caches" in window){
        const keys = await caches.keys()
        await Promise.all(keys.map((key) => caches.delete(key)))
      }
    })

    return
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js")
  })
}

function bindGlobalListeners(){
  if(listenersBound){
    return
  }

  const languageSelect = document.getElementById("languageSelect")
  const savedLanguage = localStorage.getItem("language") || "en"

  if(languageSelect){
    languageSelect.value = savedLanguage
    languageSelect.addEventListener("change", (event) => loadLanguage(event.target.value))
  }

  const searchInput = document.getElementById("globalSearch")

  if(searchInput){
    searchInput.addEventListener("input", runSearch)
    searchInput.addEventListener("keydown", handleSearchKeydown)
    searchInput.addEventListener("focus", () => {
      if(searchInput.value.trim()){
        runSearch()
      }
    })
  }

  const importInput = document.getElementById("importFile")

  if(importInput){
    importInput.addEventListener("change", handleImportFileChange)
  }

  document.addEventListener("click", handleDocumentClick)
  window.addEventListener("dailykit:cloud-restored", () => {
    DailyKitDashboard.refreshDashboard()
    rerenderActiveTool()
  })

  listenersBound = true
}

async function bootSessionUi(){
  const savedLanguage = localStorage.getItem("language") || "en"
  await loadLanguage(savedLanguage)
  await DailyKitRouter.loadTools()
  DailyKitDashboard.refreshDashboard()
  DailyKitRouter.showHome()
}

function resetForSignedOutState(){
  closeSearchResults()
  DailyKitRouter.syncNavState("home")
  const home = document.getElementById("screenHome")
  const toolArea = document.getElementById("toolArea")

  if(home){
    home.hidden = false
    home.classList.add("is-active")
    home.classList.remove("is-entering")
  }

  if(toolArea){
    toolArea.hidden = true
    toolArea.classList.remove("is-active", "is-entering")
  }
}

async function handleSessionChange(){
  if(DailyKitAuth.hasSession()){
    await bootSessionUi()
    return
  }

  resetForSignedOutState()
}

async function initApp(){
  await DailyKitAuth.init()
  bindGlobalListeners()

  if(DailyKitAuth.hasSession()){
    await bootSessionUi()
  }else{
    resetForSignedOutState()
  }

  window.addEventListener("dailykit:session-changed", handleSessionChange)
}

window.addEventListener("DOMContentLoaded", initApp)

initInstallPrompt()
initServiceWorker()

window.runSearch = runSearch
window.exportData = exportData
window.importData = importData
window.installApp = installApp
