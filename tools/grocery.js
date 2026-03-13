const groceryState = {
  editingId: null,
  currentPage: 1,
  pageSize: 10
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
    return "Unknown date"
  }

  return new Intl.DateTimeFormat("en-IN", {
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
<p class="section-kicker">Shopping</p>
<h2>Grocery List</h2>
<p>Drop in items fast, edit them cleanly, and browse older grocery additions page by page.</p>
</div>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">Add fast</p>
<h3 id="groceryFormTitle">Add grocery item</h3>
</div>
</div>
<div class="tool-form">
<input id="groceryInput" placeholder="Item name">
<button id="grocerySubmitBtn" type="button" onclick="saveGroceryEntry()">Add Item</button>
<button id="groceryCancelBtn" type="button" class="secondary-btn" onclick="cancelGroceryEdit()" hidden>Cancel</button>
</div>
</section>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">History</p>
<h3>Grocery archive</h3>
</div>
<p class="panel-copy">Search your grocery archive and page through older items as your list grows.</p>
</div>
<div class="filters-grid filters-grid-two">
<input id="grocerySearchInput" placeholder="Search item name" oninput="loadGroceries(1)">
<select id="groceryDateFilter" onchange="loadGroceries(1)">
<option value="all">All time</option>
<option value="today">Today</option>
<option value="week">This week</option>
<option value="month">This month</option>
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
    title.textContent = "Add grocery item"
    submitButton.textContent = "Add Item"
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

  title.textContent = "Edit grocery item"
  submitButton.textContent = "Save Changes"
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
    DailyKitFeedback.error("Enter a grocery item first.")
    return
  }

  if(groceryState.editingId){
    DailyKitStorage.updateGrocery(groceryState.editingId, {name: value})
    DailyKitFeedback.success("Grocery item updated.")
  }else{
    DailyKitStorage.addGrocery({name: value})
    DailyKitFeedback.success("Grocery item added.")
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
<button type="button" class="secondary-btn" ${groceryState.currentPage === 1 ? "disabled" : ""} onclick="changeGroceryPage(-1)">Previous</button>
<span class="pagination-status">Page ${groceryState.currentPage} of ${pageCount}</span>
<button type="button" class="secondary-btn" ${groceryState.currentPage === pageCount ? "disabled" : ""} onclick="changeGroceryPage(1)">Next</button>
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
      ? `Showing <strong>${filtered.length}</strong> grocery items`
      : "No grocery items match the current search or date filter."
  }

  list.innerHTML = ""

  if(!data.length){
    list.innerHTML = "<div class='list-empty'><strong>No grocery items yet.</strong><span>Add your first item above and DailyKit will keep the archive ready.</span></div>"
    renderGroceryPagination(0)
    setGroceryFormState()
    return
  }

  if(!filtered.length){
    list.innerHTML = "<div class='list-empty'>No grocery items match the current search or date filter.</div>"
    renderGroceryPagination(0)
    setGroceryFormState()
    return
  }

  currentItems.forEach((item) => {
    list.innerHTML += `
<div class="list-item">
<div class="list-copy">
<strong>${escapeGroceryHtml(item.name)}</strong>
<span>Added ${escapeGroceryHtml(formatGroceryDate(item.date))}</span>
</div>
<div class="list-actions">
<button class="secondary-btn" onclick='editGrocery(${JSON.stringify(item.id)})'>Edit</button>
<button onclick='removeGrocery(${JSON.stringify(item.id)})'>Delete</button>
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
  DailyKitFeedback.show(`Deleted ${entry.name}.`, {
    type: "info",
    actionLabel: "Undo",
    onAction: () => {
      DailyKitStorage.addGrocery(entry)
      loadGroceries()
      refreshDashboard()
      DailyKitFeedback.success("Grocery item restored.")
    }
  })
}
