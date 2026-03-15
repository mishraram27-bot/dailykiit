const expenseState = {
  editingId: null,
  currentPage: 1,
  pageSize: 8
}

function tr(key, fallback, replacements){
  return window.t ? window.t(key, fallback, replacements) : fallback
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
  const date = PlifeOSStorage.parseDateKey(value)

  if(!date){
    return tr("common.unknownDate", "Unknown date")
  }

  return new Intl.DateTimeFormat(localStorage.getItem("language") === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date)
}

function getMonthlyExpenseStats(){
  const today = PlifeOSStorage.parseDateKey(PlifeOSStorage.todayKey())
  const expenses = PlifeOSStorage.getExpenses()
  const monthExpenses = expenses.filter((entry) => {
    const entryDate = PlifeOSStorage.parseDateKey(entry.date)
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
  const categories = PlifeOSStorage.getExpenseCategoriesList()
  const options = []

  if(includeAuto){
    options.push(`<option value="">${tr("expenses.autoCategory", "Auto category")}</option>`)
  }

  if(includeAll){
    options.push(`<option value="">${tr("expenses.allCategories", "All categories")}</option>`)
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
  const budgetSettings = PlifeOSStorage.getBudgetSettings()
  const monthlyStats = getMonthlyExpenseStats()
  const budgetLeft = budgetSettings.monthlyBudget ? budgetSettings.monthlyBudget - monthlyStats.total : null

  area.innerHTML = `
<div class="tool-shell">
<div class="tool-heading">
<p class="section-kicker">${tr("tool.expensesKicker", "Money")}</p>
<h2>${tr("tool.expenses", "Expenses")}</h2>
<p>${tr("tool.expensesIntro", "Capture a spend quickly, organize it with your own categories, and review your running history.")}</p>
</div>

<section class="feature-panel budget-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">${tr("expenses.budgetKicker", "Budget")}</p>
<h3>${tr("expenses.monthlyBudget", "Monthly budget")}</h3>
</div>
<div class="metric-pills">
<span class="metric-pill">${tr("expenses.spent", "Spent")} ${formatExpenseCurrency(monthlyStats.total)}</span>
<span class="metric-pill ${budgetLeft != null && budgetLeft < 0 ? "is-danger" : ""}">${budgetLeft == null ? tr("expenses.noBudget", "No budget set") : `${tr("expenses.left", "Left")} ${formatExpenseCurrency(budgetLeft)}`}</span>
</div>
</div>
<div class="tool-form">
<input id="monthlyBudgetInput" type="number" min="0" step="1" placeholder="${tr("expenses.setMonthlyBudget", "Set monthly budget")}" value="${budgetSettings.monthlyBudget || ""}">
<button type="button" onclick="saveMonthlyBudget()">${tr("common.saveBudget", "Save Budget")}</button>
</div>
</section>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">${tr("common.addFast", "Add fast")}</p>
<h3 id="expenseFormTitle">${tr("expenses.newExpense", "New expense")}</h3>
</div>
</div>
<div class="tool-form">
<input id="expenseInput" placeholder="${tr("expenses.quickExample", "coffee 50")}">
<select id="expenseCategory">${buildCategoryOptions("", {includeAuto: true})}</select>
<button id="expenseSubmitBtn" type="button" onclick="saveExpenseEntry()">${tr("common.addExpense", "Add Expense")}</button>
<button id="expenseCancelBtn" type="button" class="secondary-btn" onclick="cancelExpenseEdit()" hidden>${tr("common.cancel", "Cancel")}</button>
</div>
<div class="tool-form tool-form-secondary">
<input id="customCategoryInput" placeholder="${tr("expenses.createCustomCategory", "Create custom category")}">
<button type="button" class="secondary-btn" onclick="addCustomCategory()">${tr("expenses.addCategory", "Add Category")}</button>
</div>
</section>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">${tr("common.history", "History")}</p>
<h3>${tr("expenses.archiveTitle", "Recent and archived entries")}</h3>
</div>
<p class="panel-copy">${tr("expenses.archiveCopy", "Search, filter by time, and browse older data page by page as the archive grows.")}</p>
</div>
<div class="filters-grid">
<input id="expenseSearchInput" placeholder="${tr("expenses.searchName", "Search expense name")}" oninput="loadExpenses(1)">
<select id="expenseDateFilter" onchange="loadExpenses(1)">
<option value="all">${tr("filters.allTime", "All time")}</option>
<option value="today">${tr("filters.today", "Today")}</option>
<option value="week">${tr("filters.thisWeek", "This week")}</option>
<option value="month">${tr("filters.thisMonth", "This month")}</option>
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
    title.textContent = tr("expenses.newExpense", "New expense")
    submitButton.textContent = tr("common.addExpense", "Add Expense")
    cancelButton.hidden = true
    input.value = ""
    select.value = ""
    return
  }

  const entry = PlifeOSStorage.getExpenses().find((item) => item.id === expenseState.editingId)

  if(!entry){
    expenseState.editingId = null
    setExpenseFormState()
    return
  }

  title.textContent = tr("expenses.editExpense", "Edit expense")
  submitButton.textContent = tr("common.saveChanges", "Save Changes")
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
    PlifeOSFeedback.error(tr("messages.enterCategory", "Enter a category name first."))
    return
  }

  PlifeOSStorage.addExpenseCategory(value)
  input.value = ""
  syncExpenseSelects()
  PlifeOSFeedback.success(tr("messages.categoryAdded", "Category added: {value}", {value}))
}

function saveMonthlyBudget(){
  const input = document.getElementById("monthlyBudgetInput")

  if(!input){
    return
  }

  const value = Number(input.value)

  if(input.value && (!Number.isFinite(value) || value <= 0)){
    PlifeOSFeedback.error(tr("messages.validMonthlyBudget", "Enter a valid monthly budget."))
    return
  }

  PlifeOSStorage.saveBudgetSettings({monthlyBudget: Number.isFinite(value) && value > 0 ? value : null})
  renderTool()
  refreshDashboard()
  PlifeOSFeedback.success(tr("messages.monthlyBudgetUpdated", "Monthly budget updated."))
}

function saveExpenseEntry(){
  const inputElement = document.getElementById("expenseInput")
  const categoryElement = document.getElementById("expenseCategory")

  if(!inputElement){
    return
  }

  const input = inputElement.value.trim()

  if(!input){
    PlifeOSFeedback.error(tr("messages.enterExpenseExample", "Enter an expense like coffee 50."))
    return
  }

  const parts = input.split(/\s+/)
  const amount = Number(parts.pop())
  const name = parts.join(" ").trim()

  if(!name){
    PlifeOSFeedback.error(tr("messages.enterItemName", "Enter an item name."))
    return
  }

  if(!Number.isFinite(amount) || amount <= 0){
    PlifeOSFeedback.error(tr("messages.validAmount", "Enter a valid amount."))
    return
  }

  const selectedCategory = categoryElement ? categoryElement.value.trim() : ""
  const category = selectedCategory || PlifeOSStorage.inferExpenseCategory(name)
  PlifeOSStorage.addExpenseCategory(category)

  if(expenseState.editingId){
    PlifeOSStorage.updateExpense(expenseState.editingId, {name, amount, category})
    PlifeOSFeedback.success(tr("messages.expenseUpdated", "Expense updated."))
  }else{
    PlifeOSStorage.addExpense({name, amount, category})
    PlifeOSFeedback.success(tr("messages.expenseAdded", "Expense added."))
  }

  expenseState.editingId = null
  setExpenseFormState()
  loadExpenses()
  refreshDashboard()
}

function matchesExpenseDateFilter(entry, dateFilter, today){
  const entryDate = PlifeOSStorage.parseDateKey(entry.date)

  if(!entryDate){
    return false
  }

  if(dateFilter === "today"){
    return entry.date === PlifeOSStorage.todayKey()
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
<button type="button" class="secondary-btn" ${expenseState.currentPage === 1 ? "disabled" : ""} onclick="changeExpensePage(-1)">${tr("common.previous", "Previous")}</button>
<span class="pagination-status">${tr("common.pageOf", "Page {page} of {count}", {page: expenseState.currentPage, count: pageCount})}</span>
<button type="button" class="secondary-btn" ${expenseState.currentPage === pageCount ? "disabled" : ""} onclick="changeExpensePage(1)">${tr("common.next", "Next")}</button>
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

  const data = PlifeOSStorage.getExpenses().slice().sort((left, right) => {
    const leftDate = PlifeOSStorage.parseDateKey(left.date)?.getTime() || 0
    const rightDate = PlifeOSStorage.parseDateKey(right.date)?.getTime() || 0
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
  const today = PlifeOSStorage.parseDateKey(PlifeOSStorage.todayKey())

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
      ? tr("expenses.meta", "Showing <strong>{count}</strong> of {totalCount} entries - Total <strong>{total}</strong>", {
        count: filtered.length,
        totalCount: data.length,
        total: formatExpenseCurrency(totalAmount)
      })
      : tr("expenses.noMatchesMeta", "No matching expenses yet. Try a different filter or add a fresh entry.")
  }

  list.innerHTML = ""

  if(!data.length){
    list.innerHTML = `
<div class="list-empty">
<strong>${tr("expenses.emptyTitle", "No expenses yet.")}</strong>
<span>${tr("expenses.emptyCopy", "Start with something simple like <b>coffee 50</b>. PlifeOS will auto-categorize it and add it to this week's chart.")}</span>
</div>
`
    renderExpensePagination(0)
    setExpenseFormState()
    return
  }

  if(!filtered.length){
    list.innerHTML = `<div class='list-empty'>${tr("expenses.noMatches", "No expenses match the current search or date filter.")}</div>`
    renderExpensePagination(0)
    setExpenseFormState()
    return
  }

  currentItems.forEach((entry) => {
    list.innerHTML += `
<div class="list-item">
<div class="list-copy">
<strong>${escapeExpenseHtml(entry.name)}</strong>
<span>${tr("expenses.itemMeta", "{category} - {date}", {
  category: escapeExpenseHtml(entry.category),
  date: escapeExpenseHtml(formatExpenseDate(entry.date))
})}</span>
</div>
<div class="list-actions">
<span class="list-amount">${formatExpenseCurrency(entry.amount)}</span>
<button class="secondary-btn" onclick='editExpense(${JSON.stringify(entry.id)})'>${tr("common.edit", "Edit")}</button>
<button onclick='deleteExpense(${JSON.stringify(entry.id)})'>${tr("common.delete", "Delete")}</button>
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
  const entry = PlifeOSStorage.getExpenses().find((item) => item.id === id)

  if(!entry){
    return
  }

  PlifeOSStorage.removeExpense(id)

  if(expenseState.editingId === id){
    cancelExpenseEdit()
  }

  loadExpenses()
  refreshDashboard()
  PlifeOSFeedback.show(tr("messages.deletedItem", "Deleted {value}.", {value: entry.name}), {
    type: "info",
    actionLabel: tr("common.undo", "Undo"),
    onAction: () => {
      PlifeOSStorage.addExpense(entry)
      loadExpenses()
      refreshDashboard()
      PlifeOSFeedback.success(tr("messages.expenseRestored", "Expense restored."))
    }
  })
}

window.registerPlifeOSTool?.({
  id: "expenses",
  render: renderTool,
  refresh: renderTool
})
