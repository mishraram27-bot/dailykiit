function formatExpenseCurrency(amount){
  return `\u20B9${Number(amount) || 0}`
}

function escapeExpenseHtml(value){
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function formatExpenseDate(value){
  const date = DailyKitStorage.parseDateKey(value)

  if(!date){
    return "Unknown date"
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date)
}

function getMonthlyExpenseStats(){
  const today = DailyKitStorage.parseDateKey(DailyKitStorage.todayKey())
  const expenses = DailyKitStorage.getExpenses()
  const monthExpenses = expenses.filter((entry) => {
    const entryDate = DailyKitStorage.parseDateKey(entry.date)
    return entryDate &&
      entryDate.getMonth() === today.getMonth() &&
      entryDate.getFullYear() === today.getFullYear()
  })

  const total = monthExpenses.reduce((sum, entry) => sum + entry.amount, 0)
  return {
    total,
    count: monthExpenses.length
  }
}

function buildCategoryOptions(selectedValue, config = {}){
  const {includeAuto = false, includeAll = false} = config
  const categories = DailyKitStorage.getExpenseCategoriesList()
  const options = []

  if(includeAuto){
    options.push(`<option value="">Auto category</option>`)
  }

  if(includeAll){
    options.push(`<option value="">All categories</option>`)
  }

  categories.forEach((category) => {
    const isSelected = category === selectedValue ? " selected" : ""
    options.push(`<option value="${escapeExpenseHtml(category)}"${isSelected}>${escapeExpenseHtml(category)}</option>`)
  })

  return options.join("")
}

function syncExpenseSelects(){
  const addSelect = document.getElementById("expenseCategory")
  const filterSelect = document.getElementById("expenseCategoryFilter")
  const currentCategory = addSelect ? addSelect.value : ""
  const currentFilter = filterSelect ? filterSelect.value : ""

  if(addSelect){
    addSelect.innerHTML = buildCategoryOptions(currentCategory, {includeAuto: true})
    addSelect.value = currentCategory
  }

  if(filterSelect){
    filterSelect.innerHTML = buildCategoryOptions(currentFilter, {includeAll: true})
    filterSelect.value = currentFilter
  }
}

function renderTool(){
  const area = document.getElementById("toolContainer")
  const budgetSettings = DailyKitStorage.getBudgetSettings()
  const monthlyStats = getMonthlyExpenseStats()
  const budgetLeft = budgetSettings.monthlyBudget ? budgetSettings.monthlyBudget - monthlyStats.total : null

  area.innerHTML = `
<div class="tool-shell">
<div class="tool-heading">
<p class="section-kicker">Money</p>
<h2>Expenses</h2>
<p>Capture a spend quickly, organize it with your own categories, and review your running history.</p>
</div>

<section class="feature-panel budget-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">Budget</p>
<h3>Monthly budget</h3>
</div>
<div class="metric-pills">
<span class="metric-pill">Spent ${formatExpenseCurrency(monthlyStats.total)}</span>
<span class="metric-pill ${budgetLeft != null && budgetLeft < 0 ? "is-danger" : ""}">${budgetLeft == null ? "No budget set" : `Left ${formatExpenseCurrency(budgetLeft)}`}</span>
</div>
</div>
<div class="tool-form">
<input id="monthlyBudgetInput" type="number" min="0" step="1" placeholder="Set monthly budget" value="${budgetSettings.monthlyBudget || ""}">
<button type="button" onclick="saveMonthlyBudget()">Save Budget</button>
</div>
</section>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">Add fast</p>
<h3>New expense</h3>
</div>
</div>
<div class="tool-form">
<input id="expenseInput" placeholder="coffee 50">
<select id="expenseCategory">${buildCategoryOptions("", {includeAuto: true})}</select>
<button type="button" onclick="addExpense()">Add Expense</button>
</div>
<div class="tool-form tool-form-secondary">
<input id="customCategoryInput" placeholder="Create custom category">
<button type="button" class="secondary-btn" onclick="addCustomCategory()">Add Category</button>
</div>
</section>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">History</p>
<h3>Recent and all entries</h3>
</div>
<p class="panel-copy">Search, filter by time, and review everything beyond today's list.</p>
</div>
<div class="filters-grid">
<input id="expenseSearchInput" placeholder="Search expense name" oninput="loadExpenses()">
<select id="expenseDateFilter" onchange="loadExpenses()">
<option value="all">All time</option>
<option value="today">Today</option>
<option value="week">This week</option>
<option value="month">This month</option>
</select>
<select id="expenseCategoryFilter" onchange="loadExpenses()">${buildCategoryOptions("", {includeAll: true})}</select>
</div>
<div id="expenseHistoryMeta" class="history-meta"></div>
<div id="expenseList" class="list-group"></div>
</section>
</div>
`

  syncExpenseSelects()
  loadExpenses()
}

function addExpense(){
  const inputElement = document.getElementById("expenseInput")
  const categoryElement = document.getElementById("expenseCategory")

  if(!inputElement){
    return
  }

  const input = inputElement.value.trim()

  if(!input){
    alert("Enter expense")
    return
  }

  const parts = input.split(/\s+/)
  const amount = Number(parts.pop())
  const name = parts.join(" ").trim()

  if(!name){
    alert("Enter item name")
    return
  }

  if(!Number.isFinite(amount) || amount <= 0){
    alert("Invalid amount")
    return
  }

  const selectedCategory = categoryElement ? categoryElement.value.trim() : ""
  const category = selectedCategory || DailyKitStorage.inferExpenseCategory(name)

  DailyKitStorage.addExpense({name, amount, category})
  inputElement.value = ""

  if(categoryElement){
    categoryElement.value = ""
  }

  loadExpenses()

  if(typeof refreshDashboard === "function"){
    refreshDashboard()
  }
}

function addCustomCategory(){
  const input = document.getElementById("customCategoryInput")

  if(!input){
    return
  }

  const value = input.value.trim()

  if(!value){
    alert("Enter category name")
    return
  }

  DailyKitStorage.addExpenseCategory(value)
  input.value = ""
  syncExpenseSelects()
}

function saveMonthlyBudget(){
  const input = document.getElementById("monthlyBudgetInput")

  if(!input){
    return
  }

  const value = Number(input.value)

  if(!Number.isFinite(value) || value <= 0){
    DailyKitStorage.saveBudgetSettings({monthlyBudget: null})
  }else{
    DailyKitStorage.saveBudgetSettings({monthlyBudget: value})
  }

  renderTool()

  if(typeof refreshDashboard === "function"){
    refreshDashboard()
  }
}

function matchesDateFilter(entry, dateFilter, today){
  const entryDate = DailyKitStorage.parseDateKey(entry.date)

  if(!entryDate){
    return false
  }

  if(dateFilter === "today"){
    return entry.date === DailyKitStorage.todayKey()
  }

  if(dateFilter === "week"){
    const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay())
    const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7)
    return entryDate >= weekStart && entryDate < weekEnd
  }

  if(dateFilter === "month"){
    return entryDate.getMonth() === today.getMonth() && entryDate.getFullYear() === today.getFullYear()
  }

  return true
}

function loadExpenses(){
  const data = DailyKitStorage.getExpenses().slice().sort((left, right) => {
    const leftDate = DailyKitStorage.parseDateKey(left.date)?.getTime() || 0
    const rightDate = DailyKitStorage.parseDateKey(right.date)?.getTime() || 0
    return rightDate - leftDate
  })
  const list = document.getElementById("expenseList")
  const meta = document.getElementById("expenseHistoryMeta")
  const searchInput = document.getElementById("expenseSearchInput")
  const dateFilterInput = document.getElementById("expenseDateFilter")
  const categoryFilterInput = document.getElementById("expenseCategoryFilter")

  if(!list){
    return
  }

  const query = String(searchInput?.value || "").trim().toLowerCase()
  const dateFilter = dateFilterInput?.value || "all"
  const categoryFilter = categoryFilterInput?.value || ""
  const today = DailyKitStorage.parseDateKey(DailyKitStorage.todayKey())

  const filtered = data.filter((entry) => {
    const matchesQuery = !query || entry.name.toLowerCase().includes(query)
    const matchesCategory = !categoryFilter || entry.category === categoryFilter
    const matchesDate = matchesDateFilter(entry, dateFilter, today)

    return matchesQuery && matchesCategory && matchesDate
  })

  const totalAmount = filtered.reduce((sum, entry) => sum + entry.amount, 0)

  if(meta){
    meta.innerHTML = filtered.length
      ? `Showing <strong>${filtered.length}</strong> of ${data.length} entries - Total <strong>${formatExpenseCurrency(totalAmount)}</strong>`
      : "No matching expenses yet. Try a different filter or add a fresh entry."
  }

  list.innerHTML = ""

  if(!data.length){
    list.innerHTML = `
<div class="list-empty">
<strong>No expenses yet.</strong>
<span>Start with something simple like <b>coffee 50</b>. DailyKit will auto-categorize it and add it to this week's chart.</span>
</div>
`
    return
  }

  if(!filtered.length){
    list.innerHTML = "<div class='list-empty'>No expenses match the current search or date filter.</div>"
    return
  }

  filtered.forEach((entry) => {
    list.innerHTML += `
<div class="list-item">
<div class="list-copy">
<strong>${escapeExpenseHtml(entry.name)}</strong>
<span>${escapeExpenseHtml(entry.category)} - ${escapeExpenseHtml(formatExpenseDate(entry.date))}</span>
</div>
<div class="list-actions">
<span class="list-amount">${formatExpenseCurrency(entry.amount)}</span>
<button onclick='deleteExpense(${JSON.stringify(entry.id)})'>Delete</button>
</div>
</div>
`
  })
}

function deleteExpense(id){
  DailyKitStorage.removeExpense(id)
  loadExpenses()

  if(typeof refreshDashboard === "function"){
    refreshDashboard()
  }
}
