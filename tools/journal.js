const journalState = {
  editingId: null,
  currentPage: 1,
  pageSize: 8
}

function tr(key, fallback, replacements){
  return window.t ? window.t(key, fallback, replacements) : fallback
}

function escapeJournalHtml(value){
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function formatJournalDate(value){
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
<p class="section-kicker">${tr("tool.journalKicker", "Reflection")}</p>
<h2>${tr("tool.journal", "Journal")}</h2>
<p>${tr("tool.journalIntro", "Capture how the day felt, save quick reflections, and keep a simple offline memory of your progress.")}</p>
</div>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">${tr("journal.write", "Reflect")}</p>
<h3 id="journalFormTitle">${tr("journal.new", "New journal entry")}</h3>
</div>
</div>
<div class="tool-form">
<input id="journalTitleInput" placeholder="${tr("journal.title", "Entry title")}">
<select id="journalMoodInput">
<option value="Focused">${tr("journal.moodFocused", "Focused")}</option>
<option value="Good">${tr("journal.moodGood", "Good")}</option>
<option value="Neutral">${tr("journal.moodNeutral", "Neutral")}</option>
<option value="Tired">${tr("journal.moodTired", "Tired")}</option>
<option value="Stressed">${tr("journal.moodStressed", "Stressed")}</option>
</select>
</div>
<div class="tool-form">
<textarea id="journalBodyInput" rows="6" placeholder="${tr("journal.body", "What happened today?")}"></textarea>
</div>
<div class="tool-form">
<button id="journalSubmitBtn" type="button" onclick="saveJournalEntry()">${tr("journal.save", "Save Entry")}</button>
<button id="journalCancelBtn" type="button" class="secondary-btn" onclick="cancelJournalEdit()" hidden>${tr("common.cancel", "Cancel")}</button>
</div>
</section>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">${tr("common.archive", "Archive")}</p>
<h3>${tr("journal.saved", "Past entries")}</h3>
</div>
<p class="panel-copy">${tr("journal.savedCopy", "Search your reflections, filter by time, and revisit earlier entries whenever you need context.")}</p>
</div>
<div class="filters-grid filters-grid-two">
<input id="journalSearchInput" placeholder="${tr("journal.search", "Search journal entries")}" oninput="loadJournal(1)">
<select id="journalDateFilter" onchange="loadJournal(1)">
<option value="all">${tr("filters.allTime", "All time")}</option>
<option value="today">${tr("filters.today", "Today")}</option>
<option value="week">${tr("filters.thisWeek", "This week")}</option>
<option value="month">${tr("filters.thisMonth", "This month")}</option>
</select>
</div>
<div id="journalMeta" class="history-meta"></div>
<div id="journalList" class="list-group"></div>
<div id="journalPagination" class="pagination"></div>
</section>
</div>
`

  loadJournal()
}

function setJournalFormState(){
  const title = document.getElementById("journalFormTitle")
  const submit = document.getElementById("journalSubmitBtn")
  const cancel = document.getElementById("journalCancelBtn")
  const titleInput = document.getElementById("journalTitleInput")
  const moodInput = document.getElementById("journalMoodInput")
  const bodyInput = document.getElementById("journalBodyInput")

  if(!title || !submit || !cancel || !titleInput || !moodInput || !bodyInput){
    return
  }

  if(!journalState.editingId){
    title.textContent = tr("journal.new", "New journal entry")
    submit.textContent = tr("journal.save", "Save Entry")
    cancel.hidden = true
    titleInput.value = ""
    moodInput.value = tr("journal.defaultMood", "Neutral")
    bodyInput.value = ""
    return
  }

  const entry = DailyKitStorage.getJournal().find((item) => item.id === journalState.editingId)

  if(!entry){
    journalState.editingId = null
    setJournalFormState()
    return
  }

  title.textContent = tr("journal.edit", "Edit journal entry")
  submit.textContent = tr("common.saveChanges", "Save Changes")
  cancel.hidden = false
  titleInput.value = entry.title
  moodInput.value = entry.mood || tr("journal.defaultMood", "Neutral")
  bodyInput.value = entry.body
}

function cancelJournalEdit(){
  journalState.editingId = null
  setJournalFormState()
}

function saveJournalEntry(){
  const title = document.getElementById("journalTitleInput")?.value.trim()
  const mood = document.getElementById("journalMoodInput")?.value || tr("journal.defaultMood", "Neutral")
  const body = document.getElementById("journalBodyInput")?.value.trim()

  if(!title && !body){
    DailyKitFeedback.error(tr("messages.journalFirst", "Write a title or reflection first."))
    return
  }

  const payload = {
    title: title || tr("journal.defaultTitle", "Daily reflection"),
    mood,
    body: body || ""
  }

  if(journalState.editingId){
    DailyKitStorage.updateJournal(journalState.editingId, payload)
    DailyKitFeedback.success(tr("messages.journalUpdated", "Journal entry updated."))
  }else{
    DailyKitStorage.addJournal(payload)
    DailyKitFeedback.success(tr("messages.journalSaved", "Journal entry saved."))
  }

  journalState.editingId = null
  renderTool()
}

function matchesJournalDateFilter(entry, dateFilter, today){
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

function renderJournalPagination(totalItems){
  const pagination = document.getElementById("journalPagination")

  if(!pagination){
    return
  }

  const pageCount = Math.max(1, Math.ceil(totalItems / journalState.pageSize))
  journalState.currentPage = Math.min(journalState.currentPage, pageCount)

  if(pageCount <= 1){
    pagination.innerHTML = ""
    return
  }

  pagination.innerHTML = `
<button type="button" class="secondary-btn" ${journalState.currentPage === 1 ? "disabled" : ""} onclick="changeJournalPage(-1)">${tr("common.previous", "Previous")}</button>
<span class="pagination-status">${tr("common.pageOf", "Page {page} of {count}", {page: journalState.currentPage, count: pageCount})}</span>
<button type="button" class="secondary-btn" ${journalState.currentPage === pageCount ? "disabled" : ""} onclick="changeJournalPage(1)">${tr("common.next", "Next")}</button>
`
}

function changeJournalPage(offset){
  journalState.currentPage = Math.max(1, journalState.currentPage + offset)
  loadJournal()
}

function loadJournal(resetPage){
  if(resetPage){
    journalState.currentPage = 1
  }

  const list = document.getElementById("journalList")
  const meta = document.getElementById("journalMeta")

  if(!list){
    return
  }

  const query = String(document.getElementById("journalSearchInput")?.value || "").trim().toLowerCase()
  const dateFilter = document.getElementById("journalDateFilter")?.value || "all"
  const today = DailyKitStorage.parseDateKey(DailyKitStorage.todayKey())
  const data = DailyKitStorage.getJournal().slice().sort((left, right) => {
    const leftDate = DailyKitStorage.parseDateKey(left.date)?.getTime() || 0
    const rightDate = DailyKitStorage.parseDateKey(right.date)?.getTime() || 0
    return rightDate - leftDate
  })
  const filtered = data.filter((entry) => {
    const haystack = `${entry.title} ${entry.mood} ${entry.body}`.toLowerCase()
    return (!query || haystack.includes(query)) && matchesJournalDateFilter(entry, dateFilter, today)
  })
  const pageCount = Math.max(1, Math.ceil(filtered.length / journalState.pageSize))
  journalState.currentPage = Math.min(journalState.currentPage, pageCount)
  const startIndex = (journalState.currentPage - 1) * journalState.pageSize
  const currentItems = filtered.slice(startIndex, startIndex + journalState.pageSize)

  if(meta){
    meta.innerHTML = filtered.length
      ? tr("journal.meta", "Showing <strong>{count}</strong> entries", {count: filtered.length})
      : tr("journal.noMatches", "No journal entries match your current search or date filter.")
  }

  list.innerHTML = ""

  if(!data.length){
    list.innerHTML = `<div class='list-empty'><strong>${tr("journal.emptyTitle", "No journal entries yet.")}</strong><span>${tr("journal.emptyCopy", "Try <b>journal Today I learned something useful</b> and start building a simple reflection habit.")}</span></div>`
    renderJournalPagination(0)
    setJournalFormState()
    return
  }

  if(!filtered.length){
    list.innerHTML = `<div class='list-empty'>${tr("journal.noMatches", "No journal entries match your current search or date filter.")}</div>`
    renderJournalPagination(0)
    setJournalFormState()
    return
  }

  currentItems.forEach((entry) => {
    list.innerHTML += `
<div class="list-item note-item">
<div class="list-copy">
<strong>${escapeJournalHtml(entry.title)}</strong>
<span>${escapeJournalHtml(entry.mood || tr("journal.defaultMood", "Neutral"))} - ${escapeJournalHtml(formatJournalDate(entry.date))}</span>
<span class="note-preview">${escapeJournalHtml(entry.body || tr("journal.noDetails", "No details added."))}</span>
</div>
<div class="list-actions">
<button class="secondary-btn" onclick='editJournal(${JSON.stringify(entry.id)})'>${tr("common.edit", "Edit")}</button>
<button onclick='deleteJournal(${JSON.stringify(entry.id)})'>${tr("common.delete", "Delete")}</button>
</div>
</div>
`
  })

  renderJournalPagination(filtered.length)
  setJournalFormState()
}

function editJournal(id){
  journalState.editingId = id
  setJournalFormState()
  document.getElementById("journalTitleInput")?.focus()
}

function deleteJournal(id){
  const entry = DailyKitStorage.getJournal().find((item) => item.id === id)

  if(!entry){
    return
  }

  DailyKitStorage.removeJournal(id)

  if(journalState.editingId === id){
    cancelJournalEdit()
  }

  loadJournal()
  DailyKitFeedback.show(tr("journal.deleted", "Deleted journal entry {value}.", {value: entry.title}), {
    type: "info",
    actionLabel: tr("common.undo", "Undo"),
    onAction: () => {
      DailyKitStorage.addJournal(entry)
      renderTool()
      DailyKitFeedback.success(tr("journal.restored", "Journal entry restored."))
    }
  })
}

window.registerDailyKitTool?.({
  id: "journal",
  render: renderTool,
  refresh: renderTool
})
