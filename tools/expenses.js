const expenseState = {
  editingId: null,
  currentPage: 1,
  pageSize: 8
}

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
<h3 id="expenseFormTitle">New expense</h3>
</div>
</div>
<div class="tool-form">
<input id="expenseInput" placeholder="coffee 50">
<select id="expenseCategory">${buildCategoryOptions("", {includeAuto: true})}</select>
<button id="expenseSubmitBtn" type="button" onclick="saveExpenseEntry()">Add Expense</button>
<button id="expenseCancelBtn" type="button" class="secondary-btn" onclick="cancelExpenseEdit()" hidden>Cancel</button>
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
<h3>Recent and archived entries</h3>
</div>
<p class="panel-copy">Search, filter by time, and browse older data page by page as the archive grows.</p>
</div>
<div class="filters-grid">
<input id="expenseSearchInput" placeholder="Search expense name" oninput="loadExpenses(1)">
<select id="expenseDateFilter" onchange="loadExpenses(1)">
<option value="all">All time</option>
<option value="today">Today</option>
<option value="week">This week</option>
<option value="month">This month</option>
</select>
<select id="expenseCategoryFilter" onchange="loadExpenses(1)">${buildCategoryOptions("", {includeAll: true})}</select>
</div>
<div id="expenseHistoryMeta" class="history-meta"></div>
<div id="expenseList" class="list-group"></div>
<div id="expensePagination" class="pagination"></div>
</section>
</div>
`

  syncExpenseSelects()
  loadExpenses()
}

function setExpenseFormState(){
  const title = document.getElementById("expenseFormTitle")
  const submitButton = document.getElementById("expenseSubmitBtn")
  const cancelButton = document.getElementById("expenseCancelBtn")
  const input = document.getElementById("expenseInput")
  const select = document.getElementById("expenseCategory")

  if(!title || !submitButton || !cancelButton || !input || !select){
    return
  }

  if(!expenseState.editingId){
    title.textContent = "New expense"
    submitButton.textContent = "Add Expense"
    cancelButton.hidden = true
    input.value = ""
    select.value = ""
    return
  }

  const entry = DailyKitStorage.getExpenses().find((item) => item.id === expenseState.editingId)

  if(!entry){
    expenseState.editingId = null
    setExpenseFormState()
    return
  }

  title.textContent = "Edit expense"
  submitButton.textContent = "Save Changes"
  cancelButton.hidden = false
  input.value = `${entry.name} ${entry.amount}`
  select.value = entry.category || ""
}

function cancelExpenseEdit(){
  expenseState.editingId = null
  setExpenseFormState()
}

function addCustomCategory(){
  const input = document.getElementById("customCategoryInput")

  if(!input){
    return
  }

  const value = input.value.trim()

  if(!value){
    DailyKitFeedback.error("Enter a category name first.")
    return
  }

  DailyKitStorage.addExpenseCategory(value)
  input.value = ""
  syncExpenseSelects()
  DailyKitFeedback.success(`Category added: ${value}`)
}

function saveMonthlyBudget(){
  const input = document.getElementById("monthlyBudgetInput")

  if(!input){
    return
  }

  const value = Number(input.value)

  if(input.value && (!Number.isFinite(value) || value <= 0)){
    DailyKitFeedback.error("Enter a valid monthly budget.")
    return
  }

  DailyKitStorage.saveBudgetSettings({monthlyBudget: Number.isFinite(value) && value > 0 ? value : null})
  renderTool()
  refreshDashboard()
  DailyKitFeedback.success("Monthly budget updated.")
}

function saveExpenseEntry(){
  const inputElement = document.getElementById("expenseInput")
  const categoryElement = document.getElementById("expenseCategory")

  if(!inputElement){
    return
  }

  const input = inputElement.value.trim()

  if(!input){
    DailyKitFeedback.error("Enter an expense like coffee 50.")
    return
  }

  const parts = input.split(/\s+/)
  const amount = Number(parts.pop())
  const name = parts.join(" ").trim()

  if(!name){
    DailyKitFeedback.error("Enter an item name.")
    return
  }

  if(!Number.isFinite(amount) || amount <= 0){
    DailyKitFeedback.error("Enter a valid amount.")
    return
  }

  const selectedCategory = categoryElement ? categoryElement.value.trim() : ""
  const category = selectedCategory || DailyKitStorage.inferExpenseCategory(name)
  DailyKitStorage.addExpenseCategory(category)

  if(expenseState.editingId){
    DailyKitStorage.updateExpense(expenseState.editingId, {name, amount, category})
    DailyKitFeedback.success("Expense updated.")
  }else{
    DailyKitStorage.addExpense({name, amount, category})
    DailyKitFeedback.success("Expense added.")
  }

  expenseState.editingId = null
  setExpenseFormState()
  loadExpenses()
  refreshDashboard()
}

function matchesExpenseDateFilter(entry, dateFilter, today){
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

function renderExpensePagination(totalItems){
  const pagination = document.getElementById("expensePagination")

  if(!pagination){
    return
  }

  const pageCount = Math.max(1, Math.ceil(totalItems / expenseState.pageSize))
  expenseState.currentPage = Math.min(expenseState.currentPage, pageCount)

  if(pageCount <= 1){
    pagination.innerHTML = ""
    return
  }

  pagination.innerHTML = `
<button type="button" class="secondary-btn" ${expenseState.currentPage === 1 ? "disabled" : ""} onclick="changeExpensePage(-1)">Previous</button>
<span class="pagination-status">Page ${expenseState.currentPage} of ${pageCount}</span>
<button type="button" class="secondary-btn" ${expenseState.currentPage === pageCount ? "disabled" : ""} onclick="changeExpensePage(1)">Next</button>
`
}

function changeExpensePage(offset){
  expenseState.currentPage = Math.max(1, expenseState.currentPage + offset)
  loadExpenses()
}

function loadExpenses(resetPage){
  if(resetPage){
    expenseState.currentPage = 1
  }

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
    const matchesDate = matchesExpenseDateFilter(entry, dateFilter, today)

    return matchesQuery && matchesCategory && matchesDate
  })

  const totalAmount = filtered.reduce((sum, entry) => sum + entry.amount, 0)
  const pageCount = Math.max(1, Math.ceil(filtered.length / expenseState.pageSize))
  expenseState.currentPage = Math.min(expenseState.currentPage, pageCount)
  const startIndex = (expenseState.currentPage - 1) * expenseState.pageSize
  const currentItems = filtered.slice(startIndex, startIndex + expenseState.pageSize)

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
    renderExpensePagination(0)
    setExpenseFormState()
    return
  }

  if(!filtered.length){
    list.innerHTML = "<div class='list-empty'>No expenses match the current search or date filter.</div>"
    renderExpensePagination(0)
    setExpenseFormState()
    return
  }

  currentItems.forEach((entry) => {
    list.innerHTML += `
<div class="list-item">
<div class="list-copy">
<strong>${escapeExpenseHtml(entry.name)}</strong>
<span>${escapeExpenseHtml(entry.category)} - ${escapeExpenseHtml(formatExpenseDate(entry.date))}</span>
</div>
<div class="list-actions">
<span class="list-amount">${formatExpenseCurrency(entry.amount)}</span>
<button class="secondary-btn" onclick='editExpense(${JSON.stringify(entry.id)})'>Edit</button>
<button onclick='deleteExpense(${JSON.stringify(entry.id)})'>Delete</button>
</div>
</div>
`
  })

  renderExpensePagination(filtered.length)
  setExpenseFormState()
}

function editExpense(id){
  expenseState.editingId = id
  setExpenseFormState()
  document.getElementById("expenseInput")?.focus()
}

function deleteExpense(id){
  const entry = DailyKitStorage.getExpenses().find((item) => item.id === id)

  if(!entry){
    return
  }

  DailyKitStorage.removeExpense(id)

  if(expenseState.editingId === id){
    cancelExpenseEdit()
  }

  loadExpenses()
  refreshDashboard()
  DailyKitFeedback.show(`Deleted ${entry.name}.`, {
    type: "info",
    actionLabel: "Undo",
    onAction: () => {
      DailyKitStorage.addExpense(entry)
      loadExpenses()
      refreshDashboard()
      DailyKitFeedback.success("Expense restored.")
    }
  })
}
