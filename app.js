let languageData = {}
let deferredPrompt = null
let listenersBound = false
let toolsPanelOpen = false
let searchTimer = null
let appUpdateRegistration = null

const APP_VERSION = "10.12"
const LAST_EXPORT_KEY = "plifeos:last-export-at"
const THEME_KEY = "plifeos:theme"
const BRAND_LOGO_SOURCES = {
  dark: "icons/logo-white.svg",
  light: "icons/logo-black.svg"
}

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

function t(key, fallback, replacements = {}){
  let output = languageData[key] || fallback || key

  Object.entries(replacements).forEach(([name, value]) => {
    output = output.replaceAll(`{${name}}`, value)
  })

  return output
}

function getStoredTheme(){
  const theme = localStorage.getItem(THEME_KEY) || "dark"
  return ["system", "light", "dark"].includes(theme) ? theme : "dark"
}

function resolveTheme(theme){
  if(theme === "light" || theme === "dark"){
    return theme
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light"
}

function syncBrandLogo(theme){
  const logo = document.getElementById("brandLogo")

  if(!logo){
    return
  }

  logo.setAttribute("src", theme === "light" ? BRAND_LOGO_SOURCES.light : BRAND_LOGO_SOURCES.dark)
}

function applyTheme(theme, {persist = true} = {}){
  const selectedTheme = ["system", "light", "dark"].includes(theme) ? theme : "system"
  const resolvedTheme = resolveTheme(selectedTheme)

  document.documentElement.dataset.theme = resolvedTheme
  document.documentElement.dataset.themePreference = selectedTheme
  syncBrandLogo(resolvedTheme)

  if(persist){
    localStorage.setItem(THEME_KEY, selectedTheme)
  }

  const themeMeta = document.querySelector('meta[name="theme-color"]')

  if(themeMeta){
    themeMeta.setAttribute("content", resolvedTheme === "dark" ? "#111827" : "#2F6FED")
  }
}

async function loadLanguage(lang){
  const response = await fetch(`languages/${lang}.json`)
  languageData = await response.json()
  document.documentElement.lang = lang

  applyLanguage()
  renderToolsPanel()
  rerenderActiveTool()
  renderDiagnostics()
  renderSettings()

  if(window.PlifeOSRouter){
    PlifeOSRouter.loadTools()
  }

  if(window.PlifeOSDashboard){
    PlifeOSDashboard.refreshDashboard()
  }

  localStorage.setItem("language", lang)
}

function applyLanguage(){
  document.querySelectorAll("[data-i18n-html]").forEach((node) => {
    const key = node.dataset.i18nHtml
    const fallback = node.dataset.i18nFallback || node.innerHTML.trim()
    node.innerHTML = t(key, fallback)
  })

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.dataset.i18n
    const fallback = node.dataset.i18nFallback || node.textContent.trim()
    node.textContent = t(key, fallback)
  })

  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    const key = node.dataset.i18nPlaceholder
    const fallback = node.getAttribute("placeholder") || ""
    node.setAttribute("placeholder", t(key, fallback))
  })

  const nodes = {
    todayExpense: document.querySelector('[data-text="todayExpense"]'),
    borrowedPending: document.querySelector('[data-text="borrowedPending"]'),
    quickTools: document.querySelector('[data-text="quickTools"]')
  }

  Object.entries(nodes).forEach(([key, node]) => {
    if(node){
      node.innerText = t(`dashboard.${key}`, languageData[key] || node.innerText)
    }
  })
}

function exportData(){
  const data = PlifeOSStorage.exportBackup()
  const csv = buildBackupCsv(data)
  const blob = new Blob([csv], {type: "text/csv;charset=utf-8"})
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = "plifeos-backup.csv"
  link.click()

  URL.revokeObjectURL(url)
  localStorage.setItem(LAST_EXPORT_KEY, String(Date.now()))

  if(window.PlifeOSDashboard){
    PlifeOSDashboard.refreshDashboard()
  }
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

  ;(data.tasks || []).forEach((entry) => {
    rows.push([
      "task",
      entry.id || "",
      entry.title || "",
      "",
      "",
      entry.date || "",
      entry.priority || "",
      entry.done ? "true" : "false",
      ""
    ])
  })

  ;(data.journal || []).forEach((entry) => {
    rows.push([
      "journal",
      entry.id || "",
      entry.title || "",
      "",
      "",
      entry.date || "",
      entry.mood || "",
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
    throw new Error("CSV format is not a PlifeOS backup.")
  }
  const data = {
    expenses: [],
    borrow: [],
    grocery: [],
    habits: [],
    notes: [],
    tasks: [],
    journal: [],
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

    if(section === "task"){
      data.tasks.push({
        id: record.id,
        title: record.name,
        date: record.date,
        priority: record.category,
        done: String(record.done).toLowerCase() === "true"
      })
      return
    }

    if(section === "journal"){
      data.journal.push({
        id: record.id,
        title: record.name,
        date: record.date,
        mood: record.category,
        body: record.value
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
    resultsBox.innerHTML = `<div class='search-empty'>${t("search.empty", "No results found")}</div>`
    resultsBox.style.display = "block"
    return
  }

  resultsBox.innerHTML = searchState.results.map((result, index) => {
    const activeClass = index === searchState.activeIndex ? " active" : ""
    const commandClass = result.type === "command" ? " is-command" : ""
    const badge = result.type === "command"
      ? `<span class="search-pill">${escapeHtml(t("search.commandBadge", "Command"))}</span>`
      : ""
    const hint = result.type === "command"
      ? `<span class="search-hint">${escapeHtml(t("search.enterHint", "Press Enter"))}</span>`
      : ""

    return `
<button type="button" class="search-item${activeClass}${commandClass}" data-index="${index}">
<span class="search-row">
<span class="search-title">${escapeHtml(result.title)}</span>
${badge}
</span>
<span class="search-subtitle">${escapeHtml(result.subtitle)}</span>
${hint}
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

  searchState.results = PlifeOSSearch.buildResults(query, PlifeOSRouter.getToolRegistry())
  searchState.activeIndex = searchState.results.length ? 0 : -1

  renderSearchResults()
}

function queueSearch(){
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(runSearch, 120)
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

  PlifeOSRouter.openTool(result.toolId)
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
  const activeToolId = PlifeOSRouter.getActiveToolId()

  if(activeToolId){
    PlifeOSRouter.refreshActiveTool?.()
  }
}

function openQuickAdd(){
  const modal = document.getElementById("quickAddModal")
  const input = document.getElementById("quickAddInput")

  if(!modal){
    return
  }

  modal.hidden = false
  document.body.classList.add("panel-open")

  window.setTimeout(() => {
    input?.focus()
    input?.select()
  }, 30)
}

function closeQuickAdd(){
  const modal = document.getElementById("quickAddModal")
  const input = document.getElementById("quickAddInput")

  if(!modal){
    return
  }

  modal.hidden = true
  input.value = ""

  if(!toolsPanelOpen){
    document.body.classList.remove("panel-open")
  }
}

function openQuickAction(type){
  const presets = {
    expense: "coffee 50",
    grocery: "grocery milk",
    borrow: "borrow ram 200",
    note: "note meeting idea",
    task: "task call bank",
    journal: "journal Today felt focused"
  }

  openQuickAdd()
  fillQuickAdd(presets[type] || "")
}

function showAppUpdateToast(registration){
  const toast = document.getElementById("updateToast")

  if(!toast){
    return
  }

  appUpdateRegistration = registration || appUpdateRegistration
  toast.hidden = false
}

function hideAppUpdateToast(){
  const toast = document.getElementById("updateToast")

  if(toast){
    toast.hidden = true
  }
}

function openChangelog(){
  const modal = document.getElementById("changelogModal")

  if(!modal){
    return
  }

  modal.hidden = false
  document.body.classList.add("panel-open")
}

function closeChangelog(){
  const modal = document.getElementById("changelogModal")

  if(!modal){
    return
  }

  modal.hidden = true

  if(!toolsPanelOpen && document.getElementById("quickAddModal")?.hidden && document.getElementById("installHelpModal")?.hidden){
    document.body.classList.remove("panel-open")
  }
}

function openInstallHelp(){
  const modal = document.getElementById("installHelpModal")

  if(!modal){
    return
  }

  modal.hidden = false
  document.body.classList.add("panel-open")
}

function closeInstallHelp(){
  const modal = document.getElementById("installHelpModal")

  if(!modal){
    return
  }

  modal.hidden = true

  if(!toolsPanelOpen && document.getElementById("quickAddModal")?.hidden && document.getElementById("changelogModal")?.hidden){
    document.body.classList.remove("panel-open")
  }
}

function applyAppUpdate(){
  if(appUpdateRegistration?.waiting){
    appUpdateRegistration.waiting.postMessage("SKIP_WAITING")
    return
  }

  window.location.reload()
}

function fillQuickAdd(value){
  const input = document.getElementById("quickAddInput")

  if(input){
    input.value = value
    input.focus()
  }
}

function submitQuickAdd(){
  const input = document.getElementById("quickAddInput")
  const value = String(input?.value || "").trim()

  if(!value){
    PlifeOSFeedback.error(t("quickAdd.empty", "Enter something first."))
    return
  }

  const command = window.PlifeOSCommands?.parse?.(value)

  if(!command){
    PlifeOSFeedback.error(t("quickAdd.invalid", "Try a command like coffee 50 or borrow ram 200."))
    return
  }

  closeQuickAdd()
  window.PlifeOSCommands.execute(command)
}

function renderToolsPanel(){
  const container = document.getElementById("toolsPanelList")

  if(!container || !window.PlifeOSRouter){
    return
  }

  const tools = PlifeOSRouter.getToolRegistry()

  const toolButtons = tools.map((tool) => `
<button type="button" class="tools-panel-item" onclick="openToolFromPanel('${tool.id}')">
  <span class="tool-icon">${escapeHtml(tool.icon || tool.name.slice(0, 3).toUpperCase())}</span>
  <span class="tool-copy">
    <strong>${escapeHtml(t(`tool.${tool.id}`, tool.name))}</strong>
    <span>${escapeHtml(t(`toolDesc.${tool.id}`, "Open this tool"))}</span>
  </span>
</button>
`).join("")

  container.innerHTML = `
${toolButtons}
<button type="button" class="tools-panel-item" onclick="openSettings()">
  <span class="tool-icon">SET</span>
  <span class="tool-copy">
    <strong>${escapeHtml(t("settings.title", "Settings & Preferences"))}</strong>
    <span>${escapeHtml(t("settings.subtitle", "Manage app preferences, category learning, and backups."))}</span>
  </span>
</button>
<button type="button" class="tools-panel-item" onclick="openDiagnostics()">
  <span class="tool-icon">LOG</span>
  <span class="tool-copy">
    <strong>${escapeHtml(t("diagnostics.title", "Diagnostics & Recovery"))}</strong>
    <span>${escapeHtml(t("diagnostics.subtitle", "Review backups, storage health, and local errors"))}</span>
  </span>
</button>
`
}

function toggleToolsPanel(forceState){
  const panel = document.getElementById("toolsPanel")
  const nextState = typeof forceState === "boolean" ? forceState : !toolsPanelOpen

  if(!panel){
    return
  }

  toolsPanelOpen = nextState
  panel.hidden = !nextState
  document.body.classList.toggle("panel-open", nextState || !document.getElementById("quickAddModal")?.hidden)
  document.querySelector('.bottom-nav button[data-nav="tools"]')?.classList.toggle("is-active", nextState)
}

function openToolFromPanel(toolId){
  toggleToolsPanel(false)
  PlifeOSRouter.openTool(toolId)
}

function formatBackupAge(){
  const rawValue = Number(localStorage.getItem(LAST_EXPORT_KEY))

  if(!rawValue){
    return t("diagnostics.backupNever", "No local backup export recorded yet.")
  }

  const days = Math.floor((Date.now() - rawValue) / 86400000)

  if(days <= 0){
    return t("diagnostics.backupToday", "Last backup exported today.")
  }

  return t("diagnostics.backupDays", "Last backup exported {days} day(s) ago.", {days})
}

function renderDiagnostics(){
  const container = document.getElementById("diagnosticsContainer")

  if(!container){
    return
  }

  const backup = PlifeOSStorage.exportBackup()
  const errors = PlifeOSStorage.getErrorLogs().slice().sort((left, right) => right.timestamp - left.timestamp).slice(0, 8)
  const storageVersion = PlifeOSStorage.getStorageVersion()
  const namespace = window.PlifeOSAuth?.getStorageNamespace?.() || "local"
  const counts = [
    {label: t("tool.expenses", "Expenses"), value: backup.expenses.length},
    {label: t("tool.borrowed", "Borrowed Money"), value: backup.borrow.length},
    {label: t("tool.grocery", "Grocery List"), value: backup.grocery.length},
    {label: t("tool.habits", "Habits"), value: backup.habits.length},
    {label: t("tool.notes", "Notes"), value: backup.notes.length},
    {label: t("tool.tasks", "Tasks"), value: backup.tasks.length},
    {label: t("tool.journal", "Journal"), value: backup.journal.length},
    {label: t("tool.subscriptions", "Subscriptions"), value: backup.subscriptions.length}
  ]

  container.innerHTML = `
<div class="tool-shell">
  <div class="tool-heading">
    <p class="section-kicker">${t("diagnostics.kicker", "Recovery")}</p>
    <h2>${t("diagnostics.title", "Diagnostics & Recovery")}</h2>
    <p>${t("diagnostics.copy", "Review workspace health, backup freshness, storage version, and recent local errors before something becomes a problem.")}</p>
  </div>

  <section class="feature-panel">
    <div class="panel-heading">
      <div>
        <p class="section-kicker">${t("diagnostics.workspace", "Workspace")}</p>
        <h3>${t("diagnostics.status", "Current status")}</h3>
      </div>
    </div>
    <div class="report-grid">
      <article class="report-tile">
        <span class="insight-label">${t("diagnostics.profile", "Profile")}</span>
        <strong>${escapeHtml(namespace)}</strong>
      </article>
      <article class="report-tile">
        <span class="insight-label">${t("diagnostics.storageVersion", "Storage version")}</span>
        <strong>v${storageVersion}</strong>
      </article>
      <article class="report-tile">
        <span class="insight-label">${t("diagnostics.backupStatus", "Backup status")}</span>
        <strong>${escapeHtml(formatBackupAge())}</strong>
      </article>
      <article class="report-tile">
        <span class="insight-label">${t("diagnostics.errorCount", "Error logs")}</span>
        <strong>${errors.length}</strong>
      </article>
    </div>
  </section>

  <section class="feature-panel">
    <div class="panel-heading">
      <div>
        <p class="section-kicker">${t("diagnostics.dataCounts", "Data")}</p>
        <h3>${t("diagnostics.dataTitle", "Workspace counts")}</h3>
      </div>
    </div>
    <div class="report-grid">
      ${counts.map((item) => `
<article class="report-tile">
  <span class="insight-label">${escapeHtml(item.label)}</span>
  <strong>${item.value}</strong>
</article>`).join("")}
    </div>
  </section>

  <section class="feature-panel">
    <div class="panel-heading">
      <div>
        <p class="section-kicker">${t("diagnostics.actions", "Actions")}</p>
        <h3>${t("diagnostics.recoveryTitle", "Recovery actions")}</h3>
      </div>
    </div>
    <div class="tool-form diagnostics-actions">
      <button type="button" onclick="exportData()">${t("backup.export", "Export CSV")}</button>
      <button type="button" class="secondary-btn" onclick="importData()">${t("backup.import", "Import Backup")}</button>
      <button type="button" class="secondary-btn" onclick="validateWorkspaceData()">${t("diagnostics.validate", "Validate Data")}</button>
      <button type="button" class="secondary-btn" onclick="clearDiagnosticsLogs()">${t("diagnostics.clearErrors", "Clear Error Logs")}</button>
      <button type="button" onclick="resetWorkspaceData()">${t("diagnostics.reset", "Reset Workspace")}</button>
    </div>
  </section>

  <section class="feature-panel">
    <div class="panel-heading">
      <div>
        <p class="section-kicker">${t("diagnostics.errors", "Errors")}</p>
        <h3>${t("diagnostics.errorTitle", "Recent local errors")}</h3>
      </div>
    </div>
    ${errors.length ? `
    <div class="diagnostics-log">
      ${errors.map((entry) => `
<article class="diagnostics-log-item">
  <strong>${escapeHtml(entry.type)}</strong>
  <span>${escapeHtml(entry.message)}</span>
  <small>${new Date(entry.timestamp).toLocaleString(localStorage.getItem("language") === "hi" ? "hi-IN" : "en-IN")}</small>
</article>`).join("")}
    </div>` : `<div class="empty-state">${t("diagnostics.noErrors", "No local runtime errors logged right now.")}</div>`}
  </section>
</div>
`
}

function formatLearningLabel(value){
  return String(value || "")
    .split(" ")
    .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : "")
    .join(" ")
}

function renderSettings(){
  const container = document.getElementById("settingsContainer")

  if(!container || !window.PlifeOSStorage){
    return
  }

  const namespace = window.PlifeOSAuth?.getStorageNamespace?.() || "local"
  const currentLanguage = localStorage.getItem("language") || "en"
  const currentLanguageLabel = currentLanguage === "hi"
    ? t("language.hindi", "Hindi")
    : t("language.english", "English")
  const currentTheme = getStoredTheme()
  const currentThemeLabel = t(`settings.theme.${currentTheme}`, currentTheme)
  const categories = PlifeOSStorage.getExpenseCategoriesList()
  const memoryEntries = Object.entries(PlifeOSStorage.getExpenseCategoryMemory())
    .sort((left, right) => left[0].localeCompare(right[0]))

  container.innerHTML = `
<div class="tool-shell">
  <div class="tool-heading">
    <p class="section-kicker">${t("settings.kicker", "Preferences")}</p>
    <h2>${t("settings.title", "Settings & Preferences")}</h2>
    <p>${t("settings.copy", "Review your workspace profile, manage category learning, and keep your backup habits healthy.")}</p>
  </div>

  <section class="feature-panel">
    <div class="panel-heading">
      <div>
        <p class="section-kicker">${t("settings.profileKicker", "Workspace")}</p>
        <h3>${t("settings.profileTitle", "App preferences")}</h3>
      </div>
    </div>
    <div class="report-grid">
      <article class="report-tile">
        <span class="insight-label">${t("diagnostics.profile", "Profile")}</span>
        <strong>${escapeHtml(namespace)}</strong>
      </article>
      <article class="report-tile">
        <span class="insight-label">${t("settings.languageTitle", "Language")}</span>
        <strong>${escapeHtml(currentLanguageLabel)}</strong>
      </article>
      <article class="report-tile">
        <span class="insight-label">${t("settings.versionTitle", "App version")}</span>
        <strong>v${APP_VERSION}</strong>
      </article>
      <article class="report-tile">
        <span class="insight-label">${t("settings.themeTitle", "Theme")}</span>
        <strong>${escapeHtml(currentThemeLabel)}</strong>
      </article>
      <article class="report-tile">
        <span class="insight-label">${t("diagnostics.backupStatus", "Backup status")}</span>
        <strong>${escapeHtml(formatBackupAge())}</strong>
      </article>
    </div>
    <div class="tool-form diagnostics-actions">
      <button type="button" class="${currentLanguage === "en" ? "is-disabled" : ""}" onclick="changeSettingsLanguage('en')" ${currentLanguage === "en" ? "disabled" : ""}>${t("language.english", "English")}</button>
      <button type="button" class="${currentLanguage === "hi" ? "is-disabled" : ""}" onclick="changeSettingsLanguage('hi')" ${currentLanguage === "hi" ? "disabled" : ""}>${t("language.hindi", "Hindi")}</button>
      <button type="button" class="secondary-btn" onclick="openDiagnostics()">${t("diagnostics.title", "Diagnostics & Recovery")}</button>
    </div>
  </section>

  <section class="feature-panel">
    <div class="panel-heading">
      <div>
        <p class="section-kicker">${t("settings.appearanceKicker", "Appearance")}</p>
        <h3>${t("settings.appearanceTitle", "Theme & display")}</h3>
      </div>
    </div>
    <p class="panel-copy">${t("settings.appearanceCopy", "Choose the look that feels best on this device. System mode follows your phone or desktop preference automatically.")}</p>
    <div class="tool-form diagnostics-actions">
      <button type="button" class="${currentTheme === "system" ? "is-disabled" : ""}" onclick="changeThemePreference('system')" ${currentTheme === "system" ? "disabled" : ""}>${t("settings.theme.system", "System")}</button>
      <button type="button" class="${currentTheme === "light" ? "is-disabled" : ""}" onclick="changeThemePreference('light')" ${currentTheme === "light" ? "disabled" : ""}>${t("settings.theme.light", "Light")}</button>
      <button type="button" class="${currentTheme === "dark" ? "is-disabled" : ""}" onclick="changeThemePreference('dark')" ${currentTheme === "dark" ? "disabled" : ""}>${t("settings.theme.dark", "Dark")}</button>
    </div>
  </section>

  <section class="feature-panel">
    <div class="panel-heading">
      <div>
        <p class="section-kicker">${t("settings.categoriesKicker", "Learning")}</p>
        <h3>${t("settings.categoriesTitle", "Learned expense categories")}</h3>
      </div>
    </div>
      <p class="panel-copy">${t("settings.categoriesCopy", "PlifeOS remembers the category you choose for an expense name so future quick adds stay smarter.")}</p>
    <div class="report-grid">
      <article class="report-tile">
        <span class="insight-label">${t("settings.categoriesKnown", "Known mappings")}</span>
        <strong>${memoryEntries.length}</strong>
      </article>
      <article class="report-tile">
        <span class="insight-label">${t("settings.categoriesAvailable", "Available categories")}</span>
        <strong>${categories.length}</strong>
      </article>
    </div>
    ${memoryEntries.length ? `
    <div class="settings-learning-list">
      ${memoryEntries.map(([name, category]) => `
      <article class="settings-learning-item">
        <div class="settings-learning-copy">
          <strong>${escapeHtml(formatLearningLabel(name))}</strong>
          <span>${escapeHtml(category)}</span>
        </div>
        <button type="button" class="secondary-btn" onclick="removeCategoryLearning(decodeURIComponent('${encodeURIComponent(name)}'))">${t("settings.removeMapping", "Remove")}</button>
      </article>
      `).join("")}
      </div>` : `<div class="empty-state">${t("settings.categoriesEmpty", "No learned mappings yet. Add or edit expenses with categories and PlifeOS will remember them here.")}</div>`}
    <div class="tool-form diagnostics-actions">
      <button type="button" class="secondary-btn" onclick="clearCategoryLearning()">${t("settings.clearLearning", "Clear learned categories")}</button>
    </div>
  </section>

  <section class="feature-panel">
    <div class="panel-heading">
      <div>
        <p class="section-kicker">${t("settings.backupKicker", "Safety")}</p>
        <h3>${t("settings.backupTitle", "Backup habits")}</h3>
      </div>
    </div>
    <p class="panel-copy">${t("settings.backupCopy", "Export a CSV backup regularly so your offline workspace stays portable across browser resets and device changes.")}</p>
    <div class="tool-form diagnostics-actions">
      <button type="button" onclick="exportData()">${t("backup.export", "Export CSV")}</button>
      <button type="button" class="secondary-btn" onclick="importData()">${t("backup.import", "Import Backup")}</button>
    </div>
  </section>
</div>
`
}

function openDiagnostics(){
  closeQuickAdd()
  toggleToolsPanel(false)
  PlifeOSRouter.showDiagnostics?.()
  renderDiagnostics()
}

function openSettings(){
  closeQuickAdd()
  toggleToolsPanel(false)
  PlifeOSRouter.showSettings?.()
  renderSettings()
}

function changeSettingsLanguage(language){
  const languageSelect = document.getElementById("languageSelect")

  if(languageSelect){
    languageSelect.value = language
  }

  loadLanguage(language)
}

function changeThemePreference(theme){
  applyTheme(theme)
  renderSettings()
  PlifeOSFeedback.success(t("settings.themeUpdated", "Theme updated."))
}

function removeCategoryLearning(name){
  PlifeOSStorage.removeExpenseCategoryMemory(name)
  renderSettings()
  PlifeOSFeedback.success(t("settings.mappingRemoved", "Learned category removed."))
}

function clearCategoryLearning(){
  const shouldClear = window.confirm(t("settings.clearLearningConfirm", "Clear every learned category mapping?"))

  if(!shouldClear){
    return
  }

  PlifeOSStorage.clearExpenseCategoryMemory()
  renderSettings()
  PlifeOSFeedback.success(t("settings.learningCleared", "Learned categories cleared."))
}

function validateWorkspaceData(){
  PlifeOSStorage.ensureReady()
  renderDiagnostics()
  PlifeOSFeedback.success(t("diagnostics.validated", "Workspace data checked successfully."))
}

function clearDiagnosticsLogs(){
  PlifeOSStorage.clearErrorLogs()
  renderDiagnostics()
  PlifeOSFeedback.success(t("diagnostics.cleared", "Local error logs cleared."))
}

function resetWorkspaceData(){
  const shouldReset = window.confirm(t("diagnostics.resetConfirm", "Reset this workspace on this device? Export a backup first if you need one."))

  if(!shouldReset){
    return
  }

  localStorage.removeItem(LAST_EXPORT_KEY)
  PlifeOSStorage.resetWorkspaceData()
  renderDiagnostics()
  renderSettings()
  PlifeOSDashboard.refreshDashboard()
  rerenderActiveTool()
  PlifeOSFeedback.success(t("diagnostics.resetDone", "Workspace reset completed."))
}

function handleImportFileChange(event){
  const file = event.target.files[0]

  if(!file){
    return
  }

  if(file.size > 2 * 1024 * 1024){
    event.target.value = ""
    PlifeOSFeedback.error(t("backup.fileTooLarge", "Backup file is too large. Keep imports under 2 MB."))
    return
  }

  const reader = new FileReader()

  reader.onload = function(loadEvent){
    try{
      const text = String(loadEvent.target.result || "")
      const data = text.trim().startsWith("{")
        ? JSON.parse(text)
        : parseCsvBackup(text)
      PlifeOSStorage.importBackup(data)
      event.target.value = ""
      PlifeOSFeedback.success(t("backup.restored", "Backup restored successfully."))
      PlifeOSDashboard.refreshDashboard()
      rerenderActiveTool()
    }catch(error){
      event.target.value = ""
      PlifeOSFeedback.error(t("backup.invalid", "Backup file is invalid. Use a PlifeOS CSV backup or a legacy JSON backup."))
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
  const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent)
  const isStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone
  const button = document.getElementById("installBtn")

  if(button && isIOS && !isStandalone){
    button.style.display = "inline-flex"
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault()
    deferredPrompt = event

    if(button){
      button.style.display = "inline-flex"
    }
  })

  if(button && !button.dataset.bound){
    button.dataset.bound = "true"
    button.addEventListener("click", async () => {
      if(isIOS && !isStandalone && !deferredPrompt){
        openInstallHelp()
        return
      }

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

  window.addEventListener("load", async () => {
    const registration = await navigator.serviceWorker.register("service-worker.js")
    appUpdateRegistration = registration

    if(registration.waiting){
      showAppUpdateToast(registration)
    }

    registration.addEventListener("updatefound", () => {
      const worker = registration.installing

      worker?.addEventListener("statechange", () => {
        if(worker.state === "installed" && navigator.serviceWorker.controller){
          showAppUpdateToast(registration)
        }
      })
    })

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload()
    })
  })
}

function logRuntimeError(payload){
  try{
    PlifeOSStorage?.addErrorLog?.({
      type: payload.type || "error",
      message: payload.message || "Unknown error",
      source: payload.source || payload.filename || "",
      stack: payload.stack || payload.reason || "",
      timestamp: Date.now()
    })
  }catch(error){
    console.error("PlifeOS failed to store runtime error", error)
  }
}

function bindGlobalListeners(){
  if(listenersBound){
    return
  }

  applyTheme(getStoredTheme(), {persist: false})

  const colorSchemeMedia = window.matchMedia?.("(prefers-color-scheme: dark)")

  colorSchemeMedia?.addEventListener?.("change", () => {
    if(getStoredTheme() === "system"){
      applyTheme("system", {persist: false})
      if(!document.getElementById("settingsArea")?.hidden){
        renderSettings()
      }
    }
  })

  const languageSelect = document.getElementById("languageSelect")
  const savedLanguage = localStorage.getItem("language") || "en"

  if(languageSelect){
    languageSelect.value = savedLanguage
    languageSelect.addEventListener("change", (event) => loadLanguage(event.target.value))
  }

  const searchInput = document.getElementById("globalSearch")

  if(searchInput){
    searchInput.addEventListener("input", queueSearch)
    searchInput.addEventListener("keydown", handleSearchKeydown)
    searchInput.addEventListener("focus", () => {
      if(searchInput.value.trim()){
        runSearch()
      }
    })
  }

  const importInput = document.getElementById("importFile")
  const quickAddInput = document.getElementById("quickAddInput")

  if(importInput){
    importInput.addEventListener("change", handleImportFileChange)
  }

  if(quickAddInput){
    quickAddInput.addEventListener("keydown", (event) => {
      if(event.key === "Enter"){
        event.preventDefault()
        submitQuickAdd()
      }

      if(event.key === "Escape"){
        closeQuickAdd()
      }
    })
  }

  document.addEventListener("click", handleDocumentClick)
  document.addEventListener("keydown", (event) => {
    if(event.key === "Escape" && !document.getElementById("quickAddModal")?.hidden){
      closeQuickAdd()
    }

    if(event.key === "Escape" && !document.getElementById("changelogModal")?.hidden){
      closeChangelog()
    }

    if(event.key === "Escape" && !document.getElementById("installHelpModal")?.hidden){
      closeInstallHelp()
    }
  })
  window.addEventListener("error", (event) => {
    logRuntimeError({
      type: "error",
      message: event.message,
      source: event.filename,
      stack: event.error?.stack || ""
    })
  })
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason

    logRuntimeError({
      type: "promise",
      message: reason?.message || String(reason || "Unhandled promise rejection"),
      source: "unhandledrejection",
      stack: reason?.stack || String(reason || "")
    })
  })
window.addEventListener("plifeos:cloud-restored", () => {
    PlifeOSDashboard.refreshDashboard()
    rerenderActiveTool()
  })
  window.PlifeOSEvents?.on?.("storage:changed", () => {
    const searchInput = document.getElementById("globalSearch")

    if(searchInput?.value.trim()){
      runSearch()
    }

    if(!document.getElementById("diagnosticsArea")?.hidden){
      renderDiagnostics()
    }

    if(!document.getElementById("settingsArea")?.hidden){
      renderSettings()
    }
  })

  listenersBound = true
}

async function bootSessionUi(){
  document.body.classList.remove("is-signed-out")
  PlifeOSStorage?.ensureReady?.()
  const savedLanguage = localStorage.getItem("language") || "en"
  await loadLanguage(savedLanguage)
  await PlifeOSRouter.loadTools()
  renderToolsPanel()
  PlifeOSDashboard.refreshDashboard()
  PlifeOSRouter.showHome()
  PlifeOSReminders?.start?.()
}

function resetForSignedOutState(){
  document.body.classList.add("is-signed-out")
  closeSearchResults()
  PlifeOSReminders?.stop?.()
  toggleToolsPanel(false)
  closeQuickAdd()
  PlifeOSRouter.syncNavState("home")
  const home = document.getElementById("screenHome")
  const toolArea = document.getElementById("toolArea")
  const diagnosticsArea = document.getElementById("diagnosticsArea")
  const settingsArea = document.getElementById("settingsArea")

  if(home){
    home.hidden = false
    home.classList.add("is-active")
    home.classList.remove("is-entering")
  }

  if(toolArea){
    toolArea.hidden = true
    toolArea.classList.remove("is-active", "is-entering")
  }

  if(diagnosticsArea){
    diagnosticsArea.hidden = true
    diagnosticsArea.classList.remove("is-active", "is-entering")
  }

  if(settingsArea){
    settingsArea.hidden = true
    settingsArea.classList.remove("is-active", "is-entering")
  }
}

async function handleSessionChange(){
  if(PlifeOSAuth.hasSession()){
    await bootSessionUi()
    return
  }

  resetForSignedOutState()
}

async function initApp(){
  await PlifeOSAuth.init()
  bindGlobalListeners()

  if(PlifeOSAuth.hasSession()){
    await bootSessionUi()
  }else{
    resetForSignedOutState()
  }

window.addEventListener("plifeos:session-changed", handleSessionChange)
}

window.addEventListener("DOMContentLoaded", initApp)

initInstallPrompt()
initServiceWorker()

window.runSearch = runSearch
window.exportData = exportData
window.importData = importData
window.installApp = installApp
window.rerenderActiveTool = rerenderActiveTool
window.exportMonthlyReport = () => window.PlifeOSReports?.downloadMonthlyReport()
window.toggleToolsPanel = toggleToolsPanel
window.openToolFromPanel = openToolFromPanel
window.openQuickAdd = openQuickAdd
window.openQuickAction = openQuickAction
window.closeQuickAdd = closeQuickAdd
window.fillQuickAdd = fillQuickAdd
window.submitQuickAdd = submitQuickAdd
window.openChangelog = openChangelog
window.closeChangelog = closeChangelog
window.openInstallHelp = openInstallHelp
window.closeInstallHelp = closeInstallHelp
window.applyAppUpdate = applyAppUpdate
window.openDiagnostics = openDiagnostics
window.openSettings = openSettings
window.renderDiagnostics = renderDiagnostics
window.renderSettings = renderSettings
window.changeSettingsLanguage = changeSettingsLanguage
window.changeThemePreference = changeThemePreference
window.removeCategoryLearning = removeCategoryLearning
window.clearCategoryLearning = clearCategoryLearning
window.validateWorkspaceData = validateWorkspaceData
window.clearDiagnosticsLogs = clearDiagnosticsLogs
window.resetWorkspaceData = resetWorkspaceData
window.t = t
window.applyLanguage = applyLanguage
window.PLIFEOS_LAST_EXPORT_KEY = LAST_EXPORT_KEY
