;(function(){
let expenseChartInstance = null
let weeklyChartInstance = null

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

function getExpenseCategories(expenses){
  return expenses.reduce((categories, entry) => {
    const category = entry.category || DailyKitStorage.inferExpenseCategory(entry.name)
    categories[category] = (categories[category] || 0) + entry.amount
    return categories
  }, {})
}

function generateInsights(categories){
  const values = Object.values(categories)
  const box = document.getElementById("insights")

  if(!box){
    return
  }

  if(!values.length){
    box.innerHTML = "<div class='empty-state'>No spending trends yet. Add a few entries to unlock insights.</div>"
    return
  }

  const total = values.reduce((sum, value) => sum + value, 0)
  const topCategory = Object.keys(categories).reduce((best, current) => {
    return categories[best] > categories[current] ? best : current
  })
  const dailyAvg = Math.round(total / 30)

  box.innerHTML = `
<div class="insight-grid">
<article class="insight-tile">
<span class="insight-label">Top Category</span>
<span class="insight-value">${escapeHtml(topCategory)}</span>
</article>
<article class="insight-tile">
<span class="insight-label">Monthly Spend</span>
<span class="insight-value">${formatCurrency(total)}</span>
</article>
<article class="insight-tile">
<span class="insight-label">Daily Average</span>
<span class="insight-value">${formatCurrency(dailyAvg)}</span>
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
  const insightsBox = document.getElementById("insights")

  if(!expenses.length){
    if(expenseChartInstance){
      expenseChartInstance.destroy()
      expenseChartInstance = null
    }

    if(insightsBox){
      insightsBox.innerHTML = "<div class='empty-state'>No expenses yet. Add your first expense to start building your dashboard.</div>"
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
  updateDashboardStats
}

window.refreshDashboard = refreshDashboard
})()
