const borrowState = {
  editingId: null,
  currentPage: 1,
  pageSize: 8
}

function tr(key, fallback, replacements){
  return window.t ? window.t(key, fallback, replacements) : fallback
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
<p class="section-kicker">${tr("tool.borrowedKicker", "Shared money")}</p>
<h2>${tr("tool.borrowed", "Borrowed Money")}</h2>
<p>${tr("tool.borrowedIntro", "Keep a neat running view of who owes what, edit entries quickly, and browse older records page by page.")}</p>
</div>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">${tr("borrow.track", "Track")}</p>
<h3 id="borrowFormTitle">${tr("borrow.addEntry", "Add borrowed entry")}</h3>
</div>
</div>
<div class="tool-form">
<input id="person" placeholder="${tr("borrow.person", "Person")}">
<input id="amount" placeholder="${tr("common.amount", "Amount")}" inputmode="decimal">
<button id="borrowSubmitBtn" type="button" onclick="saveBorrowEntry()">${tr("borrow.addButton", "Add Entry")}</button>
<button id="borrowCancelBtn" type="button" class="secondary-btn" onclick="cancelBorrowEdit()" hidden>${tr("common.cancel", "Cancel")}</button>
</div>
</section>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">${tr("common.history", "History")}</p>
<h3>${tr("borrow.archive", "Borrow archive")}</h3>
</div>
<p class="panel-copy">${tr("borrow.archiveCopy", "Use search plus pagination to review older borrowed entries as the list grows.")}</p>
</div>
<div class="filters-grid filters-grid-two">
<input id="borrowSearchInput" placeholder="${tr("borrow.search", "Search person name")}" oninput="loadBorrow(1)">
<select id="borrowDateFilter" onchange="loadBorrow(1)">
<option value="all">${tr("filters.allTime", "All time")}</option>
<option value="today">${tr("filters.today", "Today")}</option>
<option value="week">${tr("filters.thisWeek", "This week")}</option>
<option value="month">${tr("filters.thisMonth", "This month")}</option>
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
    title.textContent = tr("borrow.addEntry", "Add borrowed entry")
    submitButton.textContent = tr("borrow.addButton", "Add Entry")
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

  title.textContent = tr("borrow.editEntry", "Edit borrowed entry")
  submitButton.textContent = tr("common.saveChanges", "Save Changes")
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
    DailyKitFeedback.error(tr("messages.enterPersonFirst", "Enter a person name first."))
    return
  }

  if(!Number.isFinite(amount) || amount <= 0){
    DailyKitFeedback.error(tr("messages.validAmount", "Enter a valid amount."))
    return
  }

  if(borrowState.editingId){
    DailyKitStorage.updateBorrow(borrowState.editingId, {person, amount})
    DailyKitFeedback.success(tr("messages.borrowUpdated", "Borrowed entry updated."))
  }else{
    DailyKitStorage.addBorrow({person, amount})
    DailyKitFeedback.success(tr("messages.borrowAdded", "Borrowed entry added."))
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
<button type="button" class="secondary-btn" ${borrowState.currentPage === 1 ? "disabled" : ""} onclick="changeBorrowPage(-1)">${tr("common.previous", "Previous")}</button>
<span class="pagination-status">${tr("common.pageOf", "Page {page} of {count}", {page: borrowState.currentPage, count: pageCount})}</span>
<button type="button" class="secondary-btn" ${borrowState.currentPage === pageCount ? "disabled" : ""} onclick="changeBorrowPage(1)">${tr("common.next", "Next")}</button>
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
      ? tr("borrow.meta", "Showing <strong>{count}</strong> entries - Pending total <strong>{total}</strong>", {
        count: filtered.length,
        total: formatBorrowCurrency(totalAmount)
      })
      : tr("borrow.noMatches", "No borrowed entries match the current search or date filter.")
  }

  list.innerHTML = ""

  if(!data.length){
    list.innerHTML = `<div class='list-empty'><strong>${tr("borrow.emptyTitle", "No borrowed entries yet.")}</strong><span>${tr("borrow.emptyCopy", "Add one to start tracking who owes what.")}</span></div>`
    renderBorrowPagination(0)
    setBorrowFormState()
    return
  }

  if(!filtered.length){
    list.innerHTML = `<div class='list-empty'>${tr("borrow.noMatches", "No borrowed entries match the current search or date filter.")}</div>`
    renderBorrowPagination(0)
    setBorrowFormState()
    return
  }

  currentItems.forEach((entry) => {
    list.innerHTML += `
<div class="list-item">
<div class="list-copy">
<strong>${escapeBorrowHtml(entry.person)}</strong>
<span>${tr("borrow.pendingSince", "Pending since {date}", {date: escapeBorrowHtml(formatBorrowDate(entry.date))})}</span>
</div>
<div class="list-actions">
<span class="list-amount">${formatBorrowCurrency(entry.amount)}</span>
<button class="secondary-btn" onclick='editBorrow(${JSON.stringify(entry.id)})'>${tr("common.edit", "Edit")}</button>
<button onclick='deleteBorrow(${JSON.stringify(entry.id)})'>${tr("common.delete", "Delete")}</button>
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
  DailyKitFeedback.show(tr("borrow.deleted", "Deleted {value}.", {value: entry.person}), {
    type: "info",
    actionLabel: tr("common.undo", "Undo"),
    onAction: () => {
      DailyKitStorage.addBorrow(entry)
      loadBorrow()
      refreshDashboard()
      DailyKitFeedback.success(tr("borrow.restored", "Borrowed entry restored."))
    }
  })
}
