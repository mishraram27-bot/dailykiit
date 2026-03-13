const borrowState = {
  editingId: null,
  currentPage: 1,
  pageSize: 8
}

function formatBorrowCurrency(amount){
  return `\u20B9${Number(amount) || 0}`
}

function escapeBorrowHtml(value){
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function formatBorrowDate(value){
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
<p class="section-kicker">Shared money</p>
<h2>Borrowed Money</h2>
<p>Keep a neat running view of who owes what, edit entries quickly, and browse older records page by page.</p>
</div>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">Track</p>
<h3 id="borrowFormTitle">Add borrowed entry</h3>
</div>
</div>
<div class="tool-form">
<input id="person" placeholder="Person">
<input id="amount" placeholder="Amount" inputmode="decimal">
<button id="borrowSubmitBtn" type="button" onclick="saveBorrowEntry()">Add Entry</button>
<button id="borrowCancelBtn" type="button" class="secondary-btn" onclick="cancelBorrowEdit()" hidden>Cancel</button>
</div>
</section>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">History</p>
<h3>Borrow archive</h3>
</div>
<p class="panel-copy">Use search plus pagination to review older borrowed entries as the list grows.</p>
</div>
<div class="filters-grid filters-grid-two">
<input id="borrowSearchInput" placeholder="Search person name" oninput="loadBorrow(1)">
<select id="borrowDateFilter" onchange="loadBorrow(1)">
<option value="all">All time</option>
<option value="today">Today</option>
<option value="week">This week</option>
<option value="month">This month</option>
</select>
</div>
<div id="borrowHistoryMeta" class="history-meta"></div>
<div id="borrowList" class="list-group"></div>
<div id="borrowPagination" class="pagination"></div>
</section>
</div>
`

  loadBorrow()
}

function setBorrowFormState(){
  const title = document.getElementById("borrowFormTitle")
  const submitButton = document.getElementById("borrowSubmitBtn")
  const cancelButton = document.getElementById("borrowCancelBtn")
  const personInput = document.getElementById("person")
  const amountInput = document.getElementById("amount")

  if(!title || !submitButton || !cancelButton || !personInput || !amountInput){
    return
  }

  if(!borrowState.editingId){
    title.textContent = "Add borrowed entry"
    submitButton.textContent = "Add Entry"
    cancelButton.hidden = true
    personInput.value = ""
    amountInput.value = ""
    return
  }

  const entry = DailyKitStorage.getBorrow().find((item) => item.id === borrowState.editingId)

  if(!entry){
    borrowState.editingId = null
    setBorrowFormState()
    return
  }

  title.textContent = "Edit borrowed entry"
  submitButton.textContent = "Save Changes"
  cancelButton.hidden = false
  personInput.value = entry.person
  amountInput.value = entry.amount
}

function cancelBorrowEdit(){
  borrowState.editingId = null
  setBorrowFormState()
}

function saveBorrowEntry(){
  const personInput = document.getElementById("person")
  const amountInput = document.getElementById("amount")
  const person = personInput?.value.trim()
  const amount = Number(amountInput?.value)

  if(!person){
    DailyKitFeedback.error("Enter a person name first.")
    return
  }

  if(!Number.isFinite(amount) || amount <= 0){
    DailyKitFeedback.error("Enter a valid amount.")
    return
  }

  if(borrowState.editingId){
    DailyKitStorage.updateBorrow(borrowState.editingId, {person, amount})
    DailyKitFeedback.success("Borrowed entry updated.")
  }else{
    DailyKitStorage.addBorrow({person, amount})
    DailyKitFeedback.success("Borrowed entry added.")
  }

  borrowState.editingId = null
  setBorrowFormState()
  loadBorrow()
  refreshDashboard()
}

function matchesBorrowDateFilter(entry, dateFilter, today){
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

function renderBorrowPagination(totalItems){
  const pagination = document.getElementById("borrowPagination")

  if(!pagination){
    return
  }

  const pageCount = Math.max(1, Math.ceil(totalItems / borrowState.pageSize))
  borrowState.currentPage = Math.min(borrowState.currentPage, pageCount)

  if(pageCount <= 1){
    pagination.innerHTML = ""
    return
  }

  pagination.innerHTML = `
<button type="button" class="secondary-btn" ${borrowState.currentPage === 1 ? "disabled" : ""} onclick="changeBorrowPage(-1)">Previous</button>
<span class="pagination-status">Page ${borrowState.currentPage} of ${pageCount}</span>
<button type="button" class="secondary-btn" ${borrowState.currentPage === pageCount ? "disabled" : ""} onclick="changeBorrowPage(1)">Next</button>
`
}

function changeBorrowPage(offset){
  borrowState.currentPage = Math.max(1, borrowState.currentPage + offset)
  loadBorrow()
}

function loadBorrow(resetPage){
  if(resetPage){
    borrowState.currentPage = 1
  }

  const data = DailyKitStorage.getBorrow().slice().sort((left, right) => {
    const leftDate = DailyKitStorage.parseDateKey(left.date)?.getTime() || 0
    const rightDate = DailyKitStorage.parseDateKey(right.date)?.getTime() || 0
    return rightDate - leftDate
  })
  const list = document.getElementById("borrowList")
  const meta = document.getElementById("borrowHistoryMeta")
  const query = String(document.getElementById("borrowSearchInput")?.value || "").trim().toLowerCase()
  const dateFilter = document.getElementById("borrowDateFilter")?.value || "all"
  const today = DailyKitStorage.parseDateKey(DailyKitStorage.todayKey())

  if(!list){
    return
  }

  const filtered = data.filter((entry) => {
    const matchesQuery = !query || entry.person.toLowerCase().includes(query)
    const matchesDate = matchesBorrowDateFilter(entry, dateFilter, today)
    return matchesQuery && matchesDate
  })

  const totalAmount = filtered.reduce((sum, entry) => sum + entry.amount, 0)
  const pageCount = Math.max(1, Math.ceil(filtered.length / borrowState.pageSize))
  borrowState.currentPage = Math.min(borrowState.currentPage, pageCount)
  const startIndex = (borrowState.currentPage - 1) * borrowState.pageSize
  const currentItems = filtered.slice(startIndex, startIndex + borrowState.pageSize)

  if(meta){
    meta.innerHTML = filtered.length
      ? `Showing <strong>${filtered.length}</strong> entries - Pending total <strong>${formatBorrowCurrency(totalAmount)}</strong>`
      : "No borrowed entries match the current search or date filter."
  }

  list.innerHTML = ""

  if(!data.length){
    list.innerHTML = "<div class='list-empty'><strong>No borrowed entries yet.</strong><span>Add one to start tracking who owes what.</span></div>"
    renderBorrowPagination(0)
    setBorrowFormState()
    return
  }

  if(!filtered.length){
    list.innerHTML = "<div class='list-empty'>No borrowed entries match the current search or date filter.</div>"
    renderBorrowPagination(0)
    setBorrowFormState()
    return
  }

  currentItems.forEach((entry) => {
    list.innerHTML += `
<div class="list-item">
<div class="list-copy">
<strong>${escapeBorrowHtml(entry.person)}</strong>
<span>Pending amount - ${escapeBorrowHtml(formatBorrowDate(entry.date))}</span>
</div>
<div class="list-actions">
<span class="list-amount">${formatBorrowCurrency(entry.amount)}</span>
<button class="secondary-btn" onclick='editBorrow(${JSON.stringify(entry.id)})'>Edit</button>
<button onclick='deleteBorrow(${JSON.stringify(entry.id)})'>Delete</button>
</div>
</div>
`
  })

  renderBorrowPagination(filtered.length)
  setBorrowFormState()
}

function editBorrow(id){
  borrowState.editingId = id
  setBorrowFormState()
  document.getElementById("person")?.focus()
}

function deleteBorrow(id){
  const entry = DailyKitStorage.getBorrow().find((item) => item.id === id)

  if(!entry){
    return
  }

  DailyKitStorage.removeBorrow(id)

  if(borrowState.editingId === id){
    cancelBorrowEdit()
  }

  loadBorrow()
  refreshDashboard()
  DailyKitFeedback.show(`Deleted ${entry.person}.`, {
    type: "info",
    actionLabel: "Undo",
    onAction: () => {
      DailyKitStorage.addBorrow(entry)
      loadBorrow()
      refreshDashboard()
      DailyKitFeedback.success("Borrowed entry restored.")
    }
  })
}
