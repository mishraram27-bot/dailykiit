;(function(){
let expenseChartInstance = null
let weeklyChartInstance = null

const ONBOARDING_KEY = "dailykit:onboarding-dismissed"

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

function getTodayDate(){
  return DailyKitStorage.parseDateKey(DailyKitStorage.todayKey())
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
    const category = entry.category || DailyKitStorage.inferExpenseCategory(entry.name)
    categories[category] = (categories[category] || 0) + entry.amount
    return categories
  }, {})
}

function renderOnboarding(){
  const host = document.getElementById("onboarding")

  if(!host){
    return
  }

  const expenses = DailyKitStorage.getExpenses()
  const borrow = DailyKitStorage.getBorrow()
  const grocery = DailyKitStorage.getGrocery()
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
<p class="section-kicker">Start here</p>
<h3>How to use DailyKit in under a minute</h3>
<p>${hasStarted ? "You already have data here. Use these shortcuts to keep the flow simple." : "Your dashboard is ready. Start with one quick action, then the app will build around your routine."}</p>
</div>
<div class="onboarding-grid">
<article class="onboarding-step">
<strong>1. Add something small</strong>
<span>Open Expenses and try <b>coffee 50</b>, or add your next grocery item.</span>
</article>
<article class="onboarding-step">
<strong>2. Check the dashboard</strong>
<span>DailyKit updates totals, categories, and this week's spending automatically.</span>
</article>
<article class="onboarding-step">
<strong>3. Keep a backup</strong>
<span>Use Export once in a while so your offline data stays portable and safe.</span>
</article>
</div>
<div class="onboarding-actions">
<button type="button" class="ghost-btn onboarding-btn" onclick="dismissOnboarding()">Hide tips</button>
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
    box.innerHTML = "<div class='empty-state'>No spending trends yet. Add a few entries to unlock insights, budgets, and smarter weekly tracking.</div>"
    return
  }

  const todayDate = getTodayDate()
  const monthlyExpenses = expenses.filter((entry) => {
    const entryDate = DailyKitStorage.parseDateKey(entry.date)
    return entryDate && isSameMonth(entryDate, todayDate)
  })
  const baseSet = monthlyExpenses.length ? monthlyExpenses : expenses
  const categories = getExpenseCategories(baseSet)
  const total = baseSet.reduce((sum, entry) => sum + entry.amount, 0)
  const topCategory = Object.keys(categories).reduce((best, current) => {
    return categories[best] > categories[current] ? best : current
  })
  const dailyAverage = Math.round(total / Math.max(1, todayDate.getDate()))
  const monthlyBudget = DailyKitStorage.getBudgetSettings().monthlyBudget
  const budgetRemaining = monthlyBudget ? monthlyBudget - total : null

  box.innerHTML = `
<div class="insight-grid">
<article class="insight-tile">
<span class="insight-label">Top Category</span>
<span class="insight-value">${escapeHtml(topCategory)}</span>
</article>
<article class="insight-tile">
<span class="insight-label">Month Total</span>
<span class="insight-value">${formatCurrency(total)}</span>
</article>
<article class="insight-tile">
<span class="insight-label">Daily Average</span>
<span class="insight-value">${formatCurrency(dailyAverage)}</span>
</article>
<article class="insight-tile">
<span class="insight-label">${monthlyBudget ? "Budget Left" : "Budget"}</span>
<span class="insight-value">${monthlyBudget ? formatCurrency(budgetRemaining) : "Set one"}</span>
</article>
</div>
`
}

function renderExpenseChart(){
  const canvas = document.getElementById("expenseChart")

  if(!canvas){
    return
  }

  const expenses = DailyKitStorage.getExpenses()

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
  const expenses = DailyKitStorage.getExpenses()
  const borrow = DailyKitStorage.getBorrow()
  const todayKey = DailyKitStorage.todayKey()

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

  const expenses = DailyKitStorage.getExpenses()
  const todayDate = getTodayDate()
  const startOfWeek = getStartOfWeek(todayDate)
  const endOfWeek = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + 7)
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
  const totals = [0, 0, 0, 0, 0, 0, 0]

  expenses.forEach((entry) => {
    const date = DailyKitStorage.parseDateKey(entry.date)

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
        label: "This Week",
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

function dismissOnboarding(){
  localStorage.setItem(ONBOARDING_KEY, "1")
  renderOnboarding()
}

function refreshDashboard(){
  renderOnboarding()
  updateDashboardStats()
  renderExpenseChart()
  renderWeeklyChart()

  if(typeof window.runSearch === "function"){
    const searchInput = document.getElementById("globalSearch")

    if(searchInput && searchInput.value.trim()){
      window.runSearch()
    }
  }
}

window.DailyKitDashboard = {
  refreshDashboard,
  renderExpenseChart,
  renderWeeklyChart,
  updateDashboardStats,
  renderOnboarding
}

window.refreshDashboard = refreshDashboard
window.dismissOnboarding = dismissOnboarding
})()
