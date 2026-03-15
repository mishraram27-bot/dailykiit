;(function(){
let expenseChartInstance = null
let weeklyChartInstance = null

const ONBOARDING_KEY = "lifeos:onboarding-dismissed"

function formatCurrency(amount){
  return `\u20B9${Number(amount) || 0}`
}

function tr(key, fallback, replacements){
  return window.t ? window.t(key, fallback, replacements) : fallback
}

function escapeHtml(value){
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function getTodayDate(){
  return LifeOSStorage.parseDateKey(LifeOSStorage.todayKey())
}

function isSameMonth(date, baseDate){
  return date.getFullYear() === baseDate.getFullYear() && date.getMonth() === baseDate.getMonth()
}

function getStartOfWeek(date){
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  copy.setDate(copy.getDate() - copy.getDay())
  return copy
}

function getExpenseCategories(expenses){
  return expenses.reduce((categories, entry) => {
    const category = entry.category || LifeOSStorage.inferExpenseCategory(entry.name)
    categories[category] = (categories[category] || 0) + entry.amount
    return categories
  }, {})
}

function formatActivityDate(dateKey){
  const date = LifeOSStorage.parseDateKey(dateKey)

  if(!date){
    return dateKey || ""
  }

  return new Intl.DateTimeFormat(localStorage.getItem("language") === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "short"
  }).format(date)
}

function renderOnboarding(){
  const host = document.getElementById("onboarding")

  if(!host){
    return
  }

  const expenses = LifeOSStorage.getExpenses()
  const borrow = LifeOSStorage.getBorrow()
  const grocery = LifeOSStorage.getGrocery()
  const hasStarted = expenses.length || borrow.length || grocery.length
  const dismissed = localStorage.getItem(ONBOARDING_KEY) === "1"

  if(hasStarted && dismissed){
    host.innerHTML = ""
    host.hidden = true
    return
  }

  host.hidden = false
  host.innerHTML = `
<section class="onboarding-card">
<div class="onboarding-copy">
<p class="section-kicker">${tr("onboarding.kicker", "Start here")}</p>
<h3>${tr("onboarding.title", "How to use Life OS in under a minute")}</h3>
<p>${hasStarted ? tr("onboarding.started", "You already have data here. Use these shortcuts to keep the flow simple.") : tr("onboarding.empty", "Your dashboard is ready. Start with one quick action, then the app will build around your routine.")}</p>
</div>
<div class="onboarding-grid">
<article class="onboarding-step">
<strong>${tr("onboarding.step1Title", "1. Add something small")}</strong>
<span>${tr("onboarding.step1Copy", "Open Expenses and try <b>coffee 50</b>, or add your next grocery item.")}</span>
</article>
<article class="onboarding-step">
<strong>${tr("onboarding.step2Title", "2. Check the dashboard")}</strong>
<span>${tr("onboarding.step2Copy", "Life OS updates totals, categories, and this week's spending automatically.")}</span>
</article>
<article class="onboarding-step">
<strong>${tr("onboarding.step3Title", "3. Keep a backup")}</strong>
<span>${tr("onboarding.step3Copy", "Use Export once in a while so your offline data stays portable and safe.")}</span>
</article>
</div>
<div class="onboarding-actions">
<button type="button" class="ghost-btn onboarding-btn" onclick="dismissOnboarding()">${tr("onboarding.hide", "Hide tips")}</button>
</div>
</section>
`
}

function renderReportSummary(){
  const host = document.getElementById("reportSummary")

  if(!host || !window.LifeOSReports){
    return
  }

  const report = LifeOSReports.getMonthlyReportData()

  host.innerHTML = `
<section class="report-panel">
  <div class="panel-heading">
    <div>
      <p class="section-kicker">${tr("reports.kicker", "Reports")}</p>
      <h3>${escapeHtml(report.monthLabel)} ${tr("reports.snapshot", "snapshot")}</h3>
    </div>
    <button type="button" class="secondary-btn" onclick="exportMonthlyReport()">${tr("reports.downloadMonthly", "Download Monthly CSV")}</button>
  </div>
  <div class="report-grid">
    <article class="report-tile">
      <span class="insight-label">${tr("nav.expenses", "Expenses")}</span>
      <strong>${formatCurrency(report.totalExpense)}</strong>
    </article>
    <article class="report-tile">
      <span class="insight-label">${tr("reports.borrowAdded", "Borrow Added")}</span>
      <strong>${formatCurrency(report.totalBorrow)}</strong>
    </article>
    <article class="report-tile">
      <span class="insight-label">${tr("reports.groceryAdded", "Grocery Added")}</span>
      <strong>${report.groceryCount}</strong>
    </article>
    <article class="report-tile">
      <span class="insight-label">${tr("insights.topCategory", "Top Category")}</span>
      <strong>${escapeHtml(report.topCategory)}</strong>
    </article>
  </div>
</section>
`
}

function getActivityFeedItems(){
  const collections = [
    ...LifeOSStorage.getExpenses().map((entry) => ({
      id: `expense-${entry.id}`,
      type: tr("nav.expenses", "Expenses"),
      date: entry.date,
      title: entry.name,
      meta: formatCurrency(entry.amount)
    })),
    ...LifeOSStorage.getBorrow().map((entry) => ({
      id: `borrow-${entry.id}`,
      type: tr("nav.borrowed", "Borrowed"),
      date: entry.date,
      title: entry.person,
      meta: formatCurrency(entry.amount)
    })),
    ...LifeOSStorage.getGrocery().map((entry) => ({
      id: `grocery-${entry.id}`,
      type: tr("nav.grocery", "Grocery"),
      date: entry.date,
      title: entry.name,
      meta: tr("activity.itemAdded", "Added")
    })),
    ...LifeOSStorage.getNotes().map((entry) => ({
      id: `note-${entry.id}`,
      type: tr("tool.notes", "Notes"),
      date: entry.date,
      title: entry.title,
      meta: tr("activity.noteSaved", "Saved")
    })),
    ...LifeOSStorage.getTasks().map((entry) => ({
      id: `task-${entry.id}`,
      type: tr("tool.tasks", "Tasks"),
      date: entry.date,
      title: entry.title,
      meta: entry.done ? tr("activity.taskDone", "Done") : tr("activity.taskOpen", "Open")
    })),
    ...LifeOSStorage.getJournal().map((entry) => ({
      id: `journal-${entry.id}`,
      type: tr("tool.journal", "Journal"),
      date: entry.date,
      title: entry.title,
      meta: entry.mood || tr("journal.defaultMood", "Neutral")
    })),
    ...LifeOSStorage.getSubscriptions().map((entry) => ({
      id: `subscription-${entry.id}`,
      type: tr("tool.subscriptions", "Subscriptions"),
      date: entry.date,
      title: entry.name,
      meta: formatCurrency(entry.amount)
    }))
  ]

  return collections
    .filter((item) => item.date)
    .sort((left, right) => {
      const leftDate = LifeOSStorage.parseDateKey(left.date)?.getTime() || 0
      const rightDate = LifeOSStorage.parseDateKey(right.date)?.getTime() || 0
      return rightDate - leftDate
    })
    .slice(0, 6)
}

function renderTrustSummary(){
  const host = document.getElementById("trustSummary")

  if(!host){
    return
  }

  const expenses = LifeOSStorage.getExpenses()
  const todayDate = getTodayDate()
  const monthlyTotal = expenses.filter((entry) => {
    const date = LifeOSStorage.parseDateKey(entry.date)
    return date && isSameMonth(date, todayDate)
  }).reduce((sum, entry) => sum + entry.amount, 0)
  const monthlyBudget = LifeOSStorage.getBudgetSettings().monthlyBudget
  const usage = monthlyBudget ? Math.round((monthlyTotal / monthlyBudget) * 100) : null
  const lastExportRaw = localStorage.getItem("lifeos:last-export-at")
  const lastExport = lastExportRaw ? Number(lastExportRaw) : null
  const daysSinceBackup = lastExport ? Math.floor((Date.now() - lastExport) / 86400000) : null
  const needsBackup = lastExport == null || daysSinceBackup >= 7

  host.innerHTML = `
<section class="report-panel trust-panel">
  <div class="panel-heading">
    <div>
      <p class="section-kicker">${tr("trust.kicker", "Trust")}</p>
      <h3>${tr("trust.title", "Stay safe and in control")}</h3>
    </div>
    <button type="button" class="secondary-btn" onclick="openDiagnostics()">${tr("diagnostics.title", "Diagnostics & Recovery")}</button>
  </div>
  <div class="report-grid">
    <article class="report-tile ${usage != null && usage >= 80 ? "report-alert" : ""}">
      <span class="insight-label">${tr("trust.budgetLabel", "Budget alert")}</span>
      <strong>${monthlyBudget ? tr("trust.budgetValue", "{percent}% used", {percent: usage}) : tr("trust.noBudget", "No budget set")}</strong>
      <span>${monthlyBudget ? tr("trust.budgetCopy", "{spent} spent out of {budget}", {
        spent: formatCurrency(monthlyTotal),
        budget: formatCurrency(monthlyBudget)
      }) : tr("trust.budgetHint", "Set a budget in Expenses to unlock alerts.")}</span>
    </article>
    <article class="report-tile ${needsBackup ? "report-alert" : ""}">
      <span class="insight-label">${tr("trust.backupLabel", "Backup status")}</span>
      <strong>${needsBackup ? tr("trust.backupNeeded", "Export a fresh backup") : tr("trust.backupReady", "Backup looks recent")}</strong>
      <span>${lastExport ? tr("trust.backupCopy", "Last export {days} day(s) ago", {days: daysSinceBackup}) : tr("trust.backupNever", "No export found yet on this device.")}</span>
    </article>
  </div>
</section>
`
}

function renderActivityFeed(){
  const host = document.getElementById("activityFeed")

  if(!host){
    return
  }

  const items = getActivityFeedItems()

  if(!items.length){
    host.innerHTML = `
<section class="report-panel">
  <div class="panel-heading">
    <div>
      <p class="section-kicker">${tr("activity.kicker", "Today")}</p>
      <h3>${tr("activity.title", "Recent activity")}</h3>
    </div>
  </div>
  <div class="empty-state">${tr("activity.empty", "Your latest actions will appear here as you add expenses, notes, grocery items, and more.")}</div>
</section>
`
    return
  }

  host.innerHTML = `
<section class="report-panel">
  <div class="panel-heading">
    <div>
      <p class="section-kicker">${tr("activity.kicker", "Today")}</p>
      <h3>${tr("activity.title", "Recent activity")}</h3>
    </div>
  </div>
  <div class="activity-list">
    ${items.map((item) => `
<article class="activity-item">
  <span class="activity-type">${escapeHtml(item.type)}</span>
  <div class="activity-copy">
    <strong>${escapeHtml(item.title)}</strong>
    <span>${escapeHtml(item.meta)} - ${escapeHtml(formatActivityDate(item.date))}</span>
  </div>
</article>`).join("")}
  </div>
</section>
`
}

function generateInsights(expenses){
  const box = document.getElementById("insights")

  if(!box){
    return
  }

  if(!expenses.length){
    box.innerHTML = `<div class='empty-state'>${tr("insights.empty", "No spending trends yet. Add a few entries to unlock insights, budgets, and smarter weekly tracking.")}</div>`
    return
  }

  const todayDate = getTodayDate()
  const monthlyExpenses = expenses.filter((entry) => {
    const entryDate = LifeOSStorage.parseDateKey(entry.date)
    return entryDate && isSameMonth(entryDate, todayDate)
  })
  const baseSet = monthlyExpenses.length ? monthlyExpenses : expenses
  const categories = getExpenseCategories(baseSet)
  const total = baseSet.reduce((sum, entry) => sum + entry.amount, 0)
  const topCategory = Object.keys(categories).reduce((best, current) => {
    return categories[best] > categories[current] ? best : current
  })
  const dailyAverage = Math.round(total / Math.max(1, todayDate.getDate()))
  const monthlyBudget = LifeOSStorage.getBudgetSettings().monthlyBudget
  const budgetRemaining = monthlyBudget ? monthlyBudget - total : null

  box.innerHTML = `
<div class="insight-grid">
<article class="insight-tile">
<span class="insight-label">${tr("insights.topCategory", "Top Category")}</span>
<span class="insight-value">${escapeHtml(topCategory)}</span>
</article>
<article class="insight-tile">
<span class="insight-label">${tr("insights.monthTotal", "Month Total")}</span>
<span class="insight-value">${formatCurrency(total)}</span>
</article>
<article class="insight-tile">
<span class="insight-label">${tr("insights.dailyAverage", "Daily Average")}</span>
<span class="insight-value">${formatCurrency(dailyAverage)}</span>
</article>
<article class="insight-tile">
<span class="insight-label">${monthlyBudget ? tr("insights.budgetLeft", "Budget Left") : tr("insights.budget", "Budget")}</span>
<span class="insight-value">${monthlyBudget ? formatCurrency(budgetRemaining) : tr("insights.setOne", "Set one")}</span>
</article>
</div>
`
}

function renderExpenseChart(){
  const canvas = document.getElementById("expenseChart")

  if(!canvas){
    return
  }

  const expenses = LifeOSStorage.getExpenses()

  if(!expenses.length){
    if(expenseChartInstance){
      expenseChartInstance.destroy()
      expenseChartInstance = null
    }

    generateInsights([])
    return
  }

  const categories = getExpenseCategories(expenses)
  generateInsights(expenses)

  if(expenseChartInstance){
    expenseChartInstance.destroy()
  }

  expenseChartInstance = new Chart(canvas, {
    type: "pie",
    data: {
      labels: Object.keys(categories),
      datasets: [{
        data: Object.values(categories),
        backgroundColor: ["#3B82F6", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6", "#EC4899"]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  })
}

function updateDashboardStats(){
  const expenses = LifeOSStorage.getExpenses()
  const borrow = LifeOSStorage.getBorrow()
  const todayKey = LifeOSStorage.todayKey()

  const todayTotal = expenses.reduce((sum, entry) => {
    return entry.date === todayKey ? sum + entry.amount : sum
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

  const expenses = LifeOSStorage.getExpenses()
  const todayDate = getTodayDate()
  const startOfWeek = getStartOfWeek(todayDate)
  const endOfWeek = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 7)
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const totals = [0, 0, 0, 0, 0, 0, 0]

  expenses.forEach((entry) => {
    const date = LifeOSStorage.parseDateKey(entry.date)

    if(!date){
      return
    }

    if(date >= startOfWeek && date < endOfWeek){
      totals[date.getDay()] += entry.amount
    }
  })

  if(weeklyChartInstance){
    weeklyChartInstance.destroy()
  }

  weeklyChartInstance = new Chart(canvas, {
    type: "bar",
    data: {
      labels: days,
      datasets: [{
        label: tr("dashboard.thisWeek", "This Week"),
        data: totals,
        backgroundColor: "#3B82F6",
        borderRadius: 12,
        maxBarThickness: 28
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  })
}

function renderWeeklySummary(){
  const host = document.getElementById("weeklySummary")

  if(!host){
    return
  }

  const todayDate = getTodayDate()
  const startOfWeek = getStartOfWeek(todayDate)
  const endOfWeek = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 7)
  const weeklyExpenses = LifeOSStorage.getExpenses().filter((entry) => {
    const date = LifeOSStorage.parseDateKey(entry.date)
    return date && date >= startOfWeek && date < endOfWeek
  })
  const weeklySpend = weeklyExpenses.reduce((sum, entry) => sum + entry.amount, 0)
  const weeklyCategories = getExpenseCategories(weeklyExpenses)
  const topCategory = Object.keys(weeklyCategories).length
    ? Object.keys(weeklyCategories).reduce((best, current) => weeklyCategories[best] > weeklyCategories[current] ? best : current)
    : tr("weekly.noCategory", "No category yet")
  const habitCount = LifeOSStorage.getHabits().reduce((sum, entry) => {
    return sum + (entry.completions || []).filter((value) => {
      const date = LifeOSStorage.parseDateKey(value)
      return date && date >= startOfWeek && date < endOfWeek
    }).length
  }, 0)
  const taskCount = LifeOSStorage.getTasks().filter((entry) => {
    const date = LifeOSStorage.parseDateKey(entry.date)
    return entry.done && date && date >= startOfWeek && date < endOfWeek
  }).length

  host.innerHTML = `
<section class="report-panel">
  <div class="panel-heading">
    <div>
      <p class="section-kicker">${tr("weekly.kicker", "This week")}</p>
      <h3>${tr("weekly.title", "Weekly summary")}</h3>
    </div>
  </div>
  <div class="report-grid">
    <article class="report-tile">
      <span class="insight-label">${tr("weekly.spent", "Spent")}</span>
      <strong>${formatCurrency(weeklySpend)}</strong>
    </article>
    <article class="report-tile">
      <span class="insight-label">${tr("weekly.topCategory", "Top category")}</span>
      <strong>${escapeHtml(topCategory)}</strong>
    </article>
    <article class="report-tile">
      <span class="insight-label">${tr("weekly.habitsDone", "Habits completed")}</span>
      <strong>${habitCount}</strong>
    </article>
    <article class="report-tile">
      <span class="insight-label">${tr("weekly.tasksDone", "Tasks completed")}</span>
      <strong>${taskCount}</strong>
    </article>
  </div>
</section>
`
}

function renderQuickActions(){
  const host = document.getElementById("quickActions")

  if(!host){
    return
  }

  host.innerHTML = `
<section class="report-panel">
  <div class="panel-heading">
    <div>
      <p class="section-kicker">${tr("dashboard.quickAddKicker", "Quick add")}</p>
      <h3>${tr("dashboard.quickAddTitle", "Start with one tap")}</h3>
    </div>
  </div>
  <div class="quick-actions-grid">
    <button type="button" class="tools-panel-item" onclick="openQuickAction('expense')">
      <span class="tool-icon">+</span>
      <span class="tool-copy">
        <strong>${tr("quickActions.expense", "Add Expense")}</strong>
        <span>${tr("quickActions.expenseCopy", "Try coffee 50")}</span>
      </span>
    </button>
    <button type="button" class="tools-panel-item" onclick="openQuickAction('grocery')">
      <span class="tool-icon">+</span>
      <span class="tool-copy">
        <strong>${tr("quickActions.grocery", "Add Grocery")}</strong>
        <span>${tr("quickActions.groceryCopy", "Try grocery milk")}</span>
      </span>
    </button>
    <button type="button" class="tools-panel-item" onclick="openQuickAction('borrow')">
      <span class="tool-icon">+</span>
      <span class="tool-copy">
        <strong>${tr("quickActions.borrow", "Add Borrowed")}</strong>
        <span>${tr("quickActions.borrowCopy", "Try borrow ram 200")}</span>
      </span>
    </button>
    <button type="button" class="tools-panel-item" onclick="openQuickAction('note')">
      <span class="tool-icon">+</span>
      <span class="tool-copy">
        <strong>${tr("quickActions.note", "Add Note")}</strong>
        <span>${tr("quickActions.noteCopy", "Try note meeting idea")}</span>
      </span>
    </button>
    <button type="button" class="tools-panel-item" onclick="openQuickAction('task')">
      <span class="tool-icon">+</span>
      <span class="tool-copy">
        <strong>${tr("quickActions.task", "Add Task")}</strong>
        <span>${tr("quickActions.taskCopy", "Try task call bank")}</span>
      </span>
    </button>
    <button type="button" class="tools-panel-item" onclick="openQuickAction('journal')">
      <span class="tool-icon">+</span>
      <span class="tool-copy">
        <strong>${tr("quickActions.journal", "Add Journal")}</strong>
        <span>${tr("quickActions.journalCopy", "Try journal Today felt focused")}</span>
      </span>
    </button>
  </div>
</section>
`
}

function dismissOnboarding(){
  localStorage.setItem(ONBOARDING_KEY, "1")
  renderOnboarding()
}

function refreshDashboard(){
  renderOnboarding()
  updateDashboardStats()
  renderExpenseChart()
  renderWeeklyChart()
  renderReportSummary()
  renderWeeklySummary()
  renderTrustSummary()
  renderActivityFeed()
  renderQuickActions()

  if(typeof window.runSearch === "function"){
    const searchInput = document.getElementById("globalSearch")

    if(searchInput && searchInput.value.trim()){
      window.runSearch()
    }
  }
}

window.LifeOSDashboard = {
  refreshDashboard,
  renderExpenseChart,
  renderWeeklyChart,
  updateDashboardStats,
  renderOnboarding,
  renderReportSummary,
  renderWeeklySummary,
  renderTrustSummary,
  renderActivityFeed,
  renderQuickActions
}

window.LifeOSEvents?.on?.("storage:changed", ({key}) => {
  if(["expenses", "borrow", "grocery", "habits", "notes", "tasks", "journal", "subscriptions", "settings"].includes(key)){
    refreshDashboard()
  }
})

window.refreshDashboard = refreshDashboard
window.dismissOnboarding = dismissOnboarding
})()
