let languageData = {}
let toolRegistry = []
let toolRegistryPromise = null
let expenseChartInstance = null
let weeklyChartInstance = null
let deferredPrompt = null
let activeToolId = null

const searchState = {
  results: [],
  activeIndex: -1
}

function formatCurrency(amount){
  return `\u20B9${Number(amount) || 0}`
}

function escapeHtml(value){
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

async function ensureToolRegistry(){
  if(toolRegistry.length){
    return toolRegistry
  }

  if(!toolRegistryPromise){
    toolRegistryPromise = fetch("tools/tools.json")
      .then((response) => response.json())
      .then((tools) => {
        toolRegistry = Array.isArray(tools) ? tools : []
        return toolRegistry
      })
      .catch((error) => {
        toolRegistryPromise = null
        throw error
      })
  }

  return toolRegistryPromise
}

function showHome(){
  activeToolId = null
  document.getElementById("screenHome").style.display = "block"
  document.getElementById("toolArea").style.display = "none"
  refreshDashboard()
}

function showSection(sectionId){
  const sections = document.querySelectorAll(".page-section")

  sections.forEach((section) => {
    section.style.display = "none"
  })

  const target = document.getElementById(sectionId)

  if(target){
    target.style.display = "block"
  }
}

async function openTool(toolId){
  const tools = await ensureToolRegistry()
  const tool = tools.find((entry) => entry.id === toolId)

  if(!tool){
    return
  }

  activeToolId = toolId

  const container = document.getElementById("toolContainer")
  container.innerHTML = ""

  document.getElementById("screenHome").style.display = "none"
  document.getElementById("toolArea").style.display = "block"

  document.querySelectorAll("script[data-tool]").forEach((script) => script.remove())

  const script = document.createElement("script")
  script.src = tool.script
  script.dataset.tool = toolId
  script.onload = () => {
    if(typeof renderTool === "function"){
      renderTool()
    }
  }

  document.body.appendChild(script)
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

async function loadTools(){
  const tools = await ensureToolRegistry()
  const container = document.querySelector(".home-tools")

  if(!container){
    return
  }

  container.innerHTML = ""

  tools.forEach((tool) => {
    const button = document.createElement("button")
    button.innerHTML = `${tool.icon} ${tool.name}`
    button.onclick = () => openTool(tool.id)
    container.appendChild(button)
  })
}

function getExpenseCategories(expenses){
  return expenses.reduce((categories, entry) => {
    const category = entry.category || DailyKitStorage.inferExpenseCategory(entry.name)
    categories[category] = (categories[category] || 0) + entry.amount
    return categories
  }, {})
}

function renderExpenseChart(){
  const canvas = document.getElementById("expenseChart")

  if(!canvas){
    return
  }

  const expenses = DailyKitStorage.getExpenses()
  const insightsBox = document.getElementById("insights")

  if(!expenses.length){
    if(expenseChartInstance){
      expenseChartInstance.destroy()
      expenseChartInstance = null
    }

    if(insightsBox){
      insightsBox.innerHTML = "<p style='color:#777'>No expenses yet. Add your first expense.</p>"
    }

    return
  }

  const categories = getExpenseCategories(expenses)

  generateInsights(categories)

  if(expenseChartInstance){
    expenseChartInstance.destroy()
  }

  expenseChartInstance = new Chart(canvas, {
    type: "pie",
    data: {
      labels: Object.keys(categories),
      datasets: [{
        data: Object.values(categories),
        backgroundColor: ["#3B82F6", "#F59E0B", "#10B981", "#EF4444"]
      }]
    }
  })
}

function generateInsights(categories){
  const values = Object.values(categories)
  const box = document.getElementById("insights")

  if(!box){
    return
  }

  if(!values.length){
    box.innerHTML = "<p style='text-align:center;color:#888'>No data yet</p>"
    return
  }

  const total = values.reduce((sum, value) => sum + value, 0)
  const topCategory = Object.keys(categories).reduce((best, current) => {
    return categories[best] > categories[current] ? best : current
  })
  const dailyAvg = Math.round(total / 30)

  box.innerHTML = `
<p><b>Top Category:</b> ${escapeHtml(topCategory)}</p>
<p><b>Monthly Spend:</b> ${formatCurrency(total)}</p>
<p><b>Daily Average:</b> ${formatCurrency(dailyAvg)}</p>
`
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

  searchState.results = DailyKitSearch.buildResults(query, toolRegistry)
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
  openTool(result.toolId)
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
      refreshDashboard()

      if(activeToolId && typeof renderTool === "function"){
        renderTool()
      }
    }catch(error){
      event.target.value = ""
      alert("Backup file is invalid.")
    }
  }

  reader.readAsText(file)
}

function updateDashboardStats(){
  const expenses = DailyKitStorage.getExpenses()
  const borrow = DailyKitStorage.getBorrow()
  const today = new Date().toISOString().slice(0, 10)

  const todayTotal = expenses.reduce((sum, entry) => {
    return entry.date === today ? sum + entry.amount : sum
  }, 0)

  const borrowTotal = borrow.reduce((sum, entry) => sum + entry.amount, 0)

  document.getElementById("todayExpense").innerText = formatCurrency(todayTotal)
  document.getElementById("borrowedTotal").innerText = formatCurrency(borrowTotal)
}

function renderWeeklyChart(){
  const canvas = document.getElementById("weeklyChart")

  if(!canvas){
    return
  }

  canvas.style.height = "220px"
  canvas.style.maxHeight = "220px"
  canvas.height = 220

  const expenses = DailyKitStorage.getExpenses()
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
  const totals = [0,0,0,0,0,0,0]

  expenses.forEach((entry) => {
    const date = new Date(entry.date)

    if(Number.isNaN(date.getTime())){
      return
    }

    totals[date.getDay()] += entry.amount
  })

  if(weeklyChartInstance){
    weeklyChartInstance.destroy()
  }

  weeklyChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels: days,
      datasets: [{
        label: "Weekly Spending",
        data: totals,
        backgroundColor: "#3B82F6"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  })
}

function refreshDashboard(){
  updateDashboardStats()
  renderExpenseChart()
  renderWeeklyChart()

  const searchInput = document.getElementById("globalSearch")

  if(searchInput && searchInput.value.trim()){
    runSearch()
  }
}

function showWelcome(){
  const first = localStorage.getItem("dailykit_welcome")

  if(first){
    return
  }

  alert("Welcome to DailyKit!\n\nTrack expenses, groceries and borrowed money easily.")
  localStorage.setItem("dailykit_welcome", "yes")
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
      button.style.display = "block"
    }
  })

  const button = document.getElementById("installBtn")

  if(button){
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

async function initApp(){
  showWelcome()
  await loadTools()
  refreshDashboard()

  const languageSelect = document.getElementById("languageSelect")
  const savedLanguage = localStorage.getItem("language") || "en"

  if(languageSelect){
    languageSelect.value = savedLanguage
    languageSelect.addEventListener("change", (event) => loadLanguage(event.target.value))
  }

  await loadLanguage(savedLanguage)

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
}

window.addEventListener("DOMContentLoaded", initApp)

initInstallPrompt()
initServiceWorker()

window.refreshDashboard = refreshDashboard
