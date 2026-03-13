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
  const csv = buildBackupCsv(data)
  const blob = new Blob([csv], {type: "text/csv;charset=utf-8"})
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = "dailykit-backup.csv"
  link.click()

  URL.revokeObjectURL(url)
}

function escapeCsvValue(value){
  let stringValue = String(value ?? "")

  if(/^[=+\-@]/.test(stringValue)){
    stringValue = `'${stringValue}`
  }

  const normalized = stringValue.replaceAll('"', '""')
  return /[",\n]/.test(normalized) ? `"${normalized}"` : normalized
}

function decodeCsvValue(value){
  const stringValue = String(value ?? "")
  return /^'[=+\-@]/.test(stringValue) ? stringValue.slice(1) : stringValue
}

function buildBackupCsv(data){
  const rows = [[
    "section",
    "id",
    "name",
    "person",
    "amount",
    "date",
    "category",
    "done",
    "value"
  ]]

  ;(data.expenses || []).forEach((entry) => {
    rows.push([
      "expense",
      entry.id || "",
      entry.name || "",
      "",
      entry.amount ?? "",
      entry.date || "",
      entry.category || "",
      "",
      ""
    ])
  })

  ;(data.borrow || []).forEach((entry) => {
    rows.push([
      "borrow",
      entry.id || "",
      "",
      entry.person || "",
      entry.amount ?? "",
      entry.date || "",
      "",
      "",
      ""
    ])
  })

  ;(data.grocery || []).forEach((entry) => {
    rows.push([
      "grocery",
      entry.id || "",
      entry.name || "",
      "",
      "",
      entry.date || "",
      "",
      entry.done ? "true" : "false",
      ""
    ])
  })

  ;(data.habits || []).forEach((entry) => {
    rows.push([
      "habit",
      entry.id || "",
      entry.name || "",
      "",
      "",
      "",
      "",
      "",
      (entry.completions || []).join("|")
    ])
  })

  ;(data.notes || []).forEach((entry) => {
    rows.push([
      "note",
      entry.id || "",
      entry.title || "",
      "",
      "",
      entry.date || "",
      "",
      "",
      entry.body || ""
    ])
  })

  ;(data.subscriptions || []).forEach((entry) => {
    rows.push([
      "subscription",
      entry.id || "",
      entry.name || "",
      "",
      entry.amount ?? "",
      entry.date || "",
      "",
      "",
      entry.billingDay ?? ""
    ])
  })

  if(data.settings){
    rows.push([
      "setting",
      "monthlyBudget",
      "",
      "",
      "",
      "",
      "",
      "",
      data.settings.monthlyBudget ?? ""
    ])

    rows.push([
      "setting",
      "habitReminderEnabled",
      "",
      "",
      "",
      "",
      "",
      "",
      data.settings.reminders?.habits?.enabled ? "true" : "false"
    ])

    rows.push([
      "setting",
      "habitReminderTime",
      "",
      "",
      "",
      "",
      "",
      "",
      data.settings.reminders?.habits?.time || ""
    ])

    rows.push([
      "setting",
      "subscriptionReminderEnabled",
      "",
      "",
      "",
      "",
      "",
      "",
      data.settings.reminders?.subscriptions?.enabled ? "true" : "false"
    ])

    rows.push([
      "setting",
      "subscriptionReminderTime",
      "",
      "",
      "",
      "",
      "",
      "",
      data.settings.reminders?.subscriptions?.time || ""
    ])

    rows.push([
      "setting",
      "subscriptionLeadDays",
      "",
      "",
      "",
      "",
      "",
      "",
      data.settings.reminders?.subscriptions?.leadDays ?? ""
    ])

    ;(data.settings.expenseCategories || []).forEach((category) => {
      rows.push([
        "category",
        "",
        category || "",
        "",
        "",
        "",
        "",
        "",
        ""
      ])
    })
  }

  return rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n")
}

function parseCsvRows(text){
  const rows = []
  let row = []
  let field = ""
  let inQuotes = false

  for(let index = 0; index < text.length; index += 1){
    const char = text[index]
    const nextChar = text[index + 1]

    if(char === '"'){
      if(inQuotes && nextChar === '"'){
        field += '"'
        index += 1
      }else{
        inQuotes = !inQuotes
      }
      continue
    }

    if(char === "," && !inQuotes){
      row.push(field)
      field = ""
      continue
    }

    if((char === "\n" || char === "\r") && !inQuotes){
      if(char === "\r" && nextChar === "\n"){
        index += 1
      }

      row.push(field)
      rows.push(row)
      row = []
      field = ""
      continue
    }

    field += char
  }

  if(field || row.length){
    row.push(field)
    rows.push(row)
  }

  return rows.filter((entry) => entry.some((value) => String(value).trim() !== ""))
}

function parseCsvBackup(text){
  const rows = parseCsvRows(text)

  if(!rows.length){
    throw new Error("CSV is empty.")
  }

  const header = rows[0].map((value) => String(value || "").trim())
  const expectedHeader = ["section", "id", "name", "person", "amount", "date", "category", "done", "value"]

  if(header.join("|") !== expectedHeader.join("|")){
    throw new Error("CSV format is not a DailyKit backup.")
  }
  const data = {
    expenses: [],
    borrow: [],
    grocery: [],
    habits: [],
    notes: [],
    subscriptions: [],
    settings: {
      monthlyBudget: null,
      expenseCategories: [],
      reminders: {
        habits: {},
        subscriptions: {}
      }
    }
  }

  rows.slice(1).forEach((row) => {
    const record = {}

    header.forEach((key, index) => {
      record[key] = decodeCsvValue(row[index] ?? "")
    })

    const section = String(record.section || "").trim().toLowerCase()

    if(section === "expense"){
      data.expenses.push({
        id: record.id,
        name: record.name,
        amount: Number(record.amount),
        date: record.date,
        category: record.category
      })
      return
    }

    if(section === "borrow"){
      data.borrow.push({
        id: record.id,
        person: record.person,
        amount: Number(record.amount),
        date: record.date
      })
      return
    }

    if(section === "grocery"){
      data.grocery.push({
        id: record.id,
        name: record.name,
        done: String(record.done).toLowerCase() === "true",
        date: record.date
      })
      return
    }

    if(section === "habit"){
      data.habits.push({
        id: record.id,
        name: record.name,
        completions: String(record.value || "").split("|").filter(Boolean)
      })
      return
    }

    if(section === "note"){
      data.notes.push({
        id: record.id,
        title: record.name,
        body: record.value,
        date: record.date
      })
      return
    }

    if(section === "subscription"){
      data.subscriptions.push({
        id: record.id,
        name: record.name,
        amount: Number(record.amount),
        date: record.date,
        billingDay: Number(record.value)
      })
      return
    }

    if(section === "setting" && record.id === "monthlyBudget"){
      const budget = Number(record.value)
      data.settings.monthlyBudget = Number.isFinite(budget) && budget > 0 ? budget : null
      return
    }

    if(section === "setting" && record.id === "habitReminderEnabled"){
      data.settings.reminders = data.settings.reminders || {habits: {}, subscriptions: {}}
      data.settings.reminders.habits = data.settings.reminders.habits || {}
      data.settings.reminders.habits.enabled = String(record.value).toLowerCase() === "true"
      return
    }

    if(section === "setting" && record.id === "habitReminderTime"){
      data.settings.reminders = data.settings.reminders || {habits: {}, subscriptions: {}}
      data.settings.reminders.habits = data.settings.reminders.habits || {}
      data.settings.reminders.habits.time = record.value
      return
    }

    if(section === "setting" && record.id === "subscriptionReminderEnabled"){
      data.settings.reminders = data.settings.reminders || {habits: {}, subscriptions: {}}
      data.settings.reminders.subscriptions = data.settings.reminders.subscriptions || {}
      data.settings.reminders.subscriptions.enabled = String(record.value).toLowerCase() === "true"
      return
    }

    if(section === "setting" && record.id === "subscriptionReminderTime"){
      data.settings.reminders = data.settings.reminders || {habits: {}, subscriptions: {}}
      data.settings.reminders.subscriptions = data.settings.reminders.subscriptions || {}
      data.settings.reminders.subscriptions.time = record.value
      return
    }

    if(section === "setting" && record.id === "subscriptionLeadDays"){
      data.settings.reminders = data.settings.reminders || {habits: {}, subscriptions: {}}
      data.settings.reminders.subscriptions = data.settings.reminders.subscriptions || {}
      data.settings.reminders.subscriptions.leadDays = Number(record.value)
      return
    }

    if(section === "category" && record.name){
      data.settings.expenseCategories.push(record.name)
    }
  })

  return data
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

  if(typeof result.action === "function"){
    result.action()
    return
  }

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

  if(file.size > 2 * 1024 * 1024){
    event.target.value = ""
    DailyKitFeedback.error("Backup file is too large. Keep imports under 2 MB.")
    return
  }

  const reader = new FileReader()

  reader.onload = function(loadEvent){
    try{
      const text = String(loadEvent.target.result || "")
      const data = text.trim().startsWith("{")
        ? JSON.parse(text)
        : parseCsvBackup(text)
      DailyKitStorage.importBackup(data)
      event.target.value = ""
      DailyKitFeedback.success("Backup restored successfully.")
      DailyKitDashboard.refreshDashboard()
      rerenderActiveTool()
    }catch(error){
      event.target.value = ""
      DailyKitFeedback.error("Backup file is invalid. Use a DailyKit CSV backup or a legacy JSON backup.")
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
  DailyKitReminders?.start?.()
}

function resetForSignedOutState(){
  closeSearchResults()
  DailyKitReminders?.stop?.()
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
window.rerenderActiveTool = rerenderActiveTool
window.exportMonthlyReport = () => window.DailyKitReports?.downloadMonthlyReport()
