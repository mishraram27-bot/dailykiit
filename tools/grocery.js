const groceryState = {
  editingId: null,
  currentPage: 1,
  pageSize: 10
}

function tr(key, fallback, replacements){
  return window.t ? window.t(key, fallback, replacements) : fallback
}

function escapeGroceryHtml(value){
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function formatGroceryDate(value){
  const date = DailyKitStorage.parseDateKey(value)

  if(!date){
    return tr("common.unknownDate", "Unknown date")
  }

  return new Intl.DateTimeFormat(localStorage.getItem("language") === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date)
}

function renderTool(){
  const area = document.getElementById("toolContainer")

  area.innerHTML = `
<div class="tool-shell">
<div class="tool-heading">
<p class="section-kicker">${tr("tool.groceryKicker", "Shopping")}</p>
<h2>${tr("tool.grocery", "Grocery List")}</h2>
<p>${tr("tool.groceryIntro", "Drop in items fast, edit them cleanly, and browse older grocery additions page by page.")}</p>
</div>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">${tr("common.addFast", "Add fast")}</p>
<h3 id="groceryFormTitle">${tr("grocery.addItem", "Add grocery item")}</h3>
</div>
</div>
<div class="tool-form">
<input id="groceryInput" placeholder="${tr("grocery.itemName", "Item name")}">
<button id="grocerySubmitBtn" type="button" onclick="saveGroceryEntry()">${tr("grocery.addButton", "Add Item")}</button>
<button id="groceryCancelBtn" type="button" class="secondary-btn" onclick="cancelGroceryEdit()" hidden>${tr("common.cancel", "Cancel")}</button>
</div>
</section>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">${tr("common.history", "History")}</p>
<h3>${tr("grocery.archive", "Grocery archive")}</h3>
</div>
<p class="panel-copy">${tr("grocery.archiveCopy", "Search your grocery archive and page through older items as your list grows.")}</p>
</div>
<div class="filters-grid filters-grid-two">
<input id="grocerySearchInput" placeholder="${tr("grocery.search", "Search item name")}" oninput="loadGroceries(1)">
<select id="groceryDateFilter" onchange="loadGroceries(1)">
<option value="all">${tr("filters.allTime", "All time")}</option>
<option value="today">${tr("filters.today", "Today")}</option>
<option value="week">${tr("filters.thisWeek", "This week")}</option>
<option value="month">${tr("filters.thisMonth", "This month")}</option>
</select>
</div>
<div id="groceryHistoryMeta" class="history-meta"></div>
<div id="groceryList" class="list-group"></div>
<div id="groceryPagination" class="pagination"></div>
</section>
</div>
`

  loadGroceries()
}

function setGroceryFormState(){
  const title = document.getElementById("groceryFormTitle")
  const submitButton = document.getElementById("grocerySubmitBtn")
  const cancelButton = document.getElementById("groceryCancelBtn")
  const input = document.getElementById("groceryInput")

  if(!title || !submitButton || !cancelButton || !input){
    return
  }

  if(!groceryState.editingId){
    title.textContent = tr("grocery.addItem", "Add grocery item")
    submitButton.textContent = tr("grocery.addButton", "Add Item")
    cancelButton.hidden = true
    input.value = ""
    return
  }

  const entry = DailyKitStorage.getGrocery().find((item) => item.id === groceryState.editingId)

  if(!entry){
    groceryState.editingId = null
    setGroceryFormState()
    return
  }

  title.textContent = tr("grocery.editItem", "Edit grocery item")
  submitButton.textContent = tr("common.saveChanges", "Save Changes")
  cancelButton.hidden = false
  input.value = entry.name
}

function cancelGroceryEdit(){
  groceryState.editingId = null
  setGroceryFormState()
}

function saveGroceryEntry(){
  const input = document.getElementById("groceryInput")

  if(!input){
    return
  }

  const value = input.value.trim()

  if(!value){
    DailyKitFeedback.error(tr("messages.enterGroceryFirst", "Enter a grocery item first."))
    return
  }

  if(groceryState.editingId){
    DailyKitStorage.updateGrocery(groceryState.editingId, {name: value})
    DailyKitFeedback.success(tr("messages.groceryUpdated", "Grocery item updated."))
  }else{
    DailyKitStorage.addGrocery({name: value})
    DailyKitFeedback.success(tr("messages.groceryAdded", "Grocery item added."))
  }

  groceryState.editingId = null
  setGroceryFormState()
  loadGroceries()
  refreshDashboard()
}

function matchesGroceryDateFilter(entry, dateFilter, today){
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

function renderGroceryPagination(totalItems){
  const pagination = document.getElementById("groceryPagination")

  if(!pagination){
    return
  }

  const pageCount = Math.max(1, Math.ceil(totalItems / groceryState.pageSize))
  groceryState.currentPage = Math.min(groceryState.currentPage, pageCount)

  if(pageCount <= 1){
    pagination.innerHTML = ""
    return
  }

  pagination.innerHTML = `
<button type="button" class="secondary-btn" ${groceryState.currentPage === 1 ? "disabled" : ""} onclick="changeGroceryPage(-1)">${tr("common.previous", "Previous")}</button>
<span class="pagination-status">${tr("common.pageOf", "Page {page} of {count}", {page: groceryState.currentPage, count: pageCount})}</span>
<button type="button" class="secondary-btn" ${groceryState.currentPage === pageCount ? "disabled" : ""} onclick="changeGroceryPage(1)">${tr("common.next", "Next")}</button>
`
}

function changeGroceryPage(offset){
  groceryState.currentPage = Math.max(1, groceryState.currentPage + offset)
  loadGroceries()
}

function loadGroceries(resetPage){
  if(resetPage){
    groceryState.currentPage = 1
  }

  const data = DailyKitStorage.getGrocery().slice().sort((left, right) => {
    const leftDate = DailyKitStorage.parseDateKey(left.date)?.getTime() || 0
    const rightDate = DailyKitStorage.parseDateKey(right.date)?.getTime() || 0
    return rightDate - leftDate
  })
  const list = document.getElementById("groceryList")
  const meta = document.getElementById("groceryHistoryMeta")
  const query = String(document.getElementById("grocerySearchInput")?.value || "").trim().toLowerCase()
  const dateFilter = document.getElementById("groceryDateFilter")?.value || "all"
  const today = DailyKitStorage.parseDateKey(DailyKitStorage.todayKey())

  if(!list){
    return
  }

  const filtered = data.filter((entry) => {
    const matchesQuery = !query || entry.name.toLowerCase().includes(query)
    const matchesDate = matchesGroceryDateFilter(entry, dateFilter, today)
    return matchesQuery && matchesDate
  })
  const pageCount = Math.max(1, Math.ceil(filtered.length / groceryState.pageSize))
  groceryState.currentPage = Math.min(groceryState.currentPage, pageCount)
  const startIndex = (groceryState.currentPage - 1) * groceryState.pageSize
  const currentItems = filtered.slice(startIndex, startIndex + groceryState.pageSize)

  if(meta){
    meta.innerHTML = filtered.length
      ? tr("grocery.meta", "Showing <strong>{count}</strong> grocery items", {count: filtered.length})
      : tr("grocery.noMatches", "No grocery items match the current search or date filter.")
  }

  list.innerHTML = ""

  if(!data.length){
    list.innerHTML = `<div class='list-empty'><strong>${tr("grocery.emptyTitle", "No grocery items yet.")}</strong><span>${tr("grocery.emptyCopy", "Add your first item above and DailyKit will keep the archive ready.")}</span></div>`
    renderGroceryPagination(0)
    setGroceryFormState()
    return
  }

  if(!filtered.length){
    list.innerHTML = `<div class='list-empty'>${tr("grocery.noMatches", "No grocery items match the current search or date filter.")}</div>`
    renderGroceryPagination(0)
    setGroceryFormState()
    return
  }

  currentItems.forEach((item) => {
    list.innerHTML += `
<div class="list-item">
<div class="list-copy">
<strong>${escapeGroceryHtml(item.name)}</strong>
<span>${tr("grocery.addedOn", "Added {date}", {date: escapeGroceryHtml(formatGroceryDate(item.date))})}</span>
</div>
<div class="list-actions">
<button class="secondary-btn" onclick='editGrocery(${JSON.stringify(item.id)})'>${tr("common.edit", "Edit")}</button>
<button onclick='removeGrocery(${JSON.stringify(item.id)})'>${tr("common.delete", "Delete")}</button>
</div>
</div>
`
  })

  renderGroceryPagination(filtered.length)
  setGroceryFormState()
}

function editGrocery(id){
  groceryState.editingId = id
  setGroceryFormState()
  document.getElementById("groceryInput")?.focus()
}

function removeGrocery(id){
  const entry = DailyKitStorage.getGrocery().find((item) => item.id === id)

  if(!entry){
    return
  }

  DailyKitStorage.removeGrocery(id)

  if(groceryState.editingId === id){
    cancelGroceryEdit()
  }

  loadGroceries()
  refreshDashboard()
  DailyKitFeedback.show(tr("grocery.deleted", "Deleted {value}.", {value: entry.name}), {
    type: "info",
    actionLabel: tr("common.undo", "Undo"),
    onAction: () => {
      DailyKitStorage.addGrocery(entry)
      loadGroceries()
      refreshDashboard()
      DailyKitFeedback.success(tr("grocery.restored", "Grocery item restored."))
    }
  })
}
