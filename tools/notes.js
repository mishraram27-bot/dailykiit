const notesState = {
  editingId: null,
  currentPage: 1,
  pageSize: 8
}

function tr(key, fallback, replacements){
  return window.t ? window.t(key, fallback, replacements) : fallback
}

function escapeNoteHtml(value){
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function formatNoteDate(value){
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
<p class="section-kicker">${tr("tool.notesKicker", "Capture")}</p>
<h2>${tr("tool.notes", "Notes")}</h2>
<p>${tr("tool.notesIntro", "Save quick ideas, reminders, and reference notes without leaving your offline workspace.")}</p>
</div>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">${tr("notes.write", "Write")}</p>
<h3 id="noteFormTitle">${tr("notes.new", "New note")}</h3>
</div>
</div>
<div class="tool-form">
<input id="noteTitle" placeholder="${tr("notes.title", "Note title")}">
</div>
<div class="tool-form">
<textarea id="noteBody" rows="5" placeholder="${tr("notes.body", "Write your note here")}"></textarea>
</div>
<div class="tool-form">
<button id="noteSubmitBtn" type="button" onclick="saveNoteEntry()">${tr("notes.save", "Save Note")}</button>
<button id="noteCancelBtn" type="button" class="secondary-btn" onclick="cancelNoteEdit()" hidden>${tr("common.cancel", "Cancel")}</button>
</div>
</section>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">${tr("common.archive", "Archive")}</p>
<h3>${tr("notes.saved", "Saved notes")}</h3>
</div>
<p class="panel-copy">${tr("notes.savedCopy", "Search your notes, page through older ones, and keep your daily thoughts easy to find.")}</p>
</div>
<div class="filters-grid filters-grid-two">
<input id="noteSearchInput" placeholder="${tr("notes.search", "Search notes")}" oninput="loadNotes(1)">
<select id="noteDateFilter" onchange="loadNotes(1)">
<option value="all">${tr("filters.allTime", "All time")}</option>
<option value="today">${tr("filters.today", "Today")}</option>
<option value="week">${tr("filters.thisWeek", "This week")}</option>
<option value="month">${tr("filters.thisMonth", "This month")}</option>
</select>
</div>
<div id="noteMeta" class="history-meta"></div>
<div id="noteList" class="list-group"></div>
<div id="notePagination" class="pagination"></div>
</section>
</div>
`

  loadNotes()
}

function setNoteFormState(){
  const title = document.getElementById("noteFormTitle")
  const submit = document.getElementById("noteSubmitBtn")
  const cancel = document.getElementById("noteCancelBtn")
  const titleInput = document.getElementById("noteTitle")
  const bodyInput = document.getElementById("noteBody")

  if(!title || !submit || !cancel || !titleInput || !bodyInput){
    return
  }

  if(!notesState.editingId){
    title.textContent = tr("notes.new", "New note")
    submit.textContent = tr("notes.save", "Save Note")
    cancel.hidden = true
    titleInput.value = ""
    bodyInput.value = ""
    return
  }

  const entry = DailyKitStorage.getNotes().find((item) => item.id === notesState.editingId)

  if(!entry){
    notesState.editingId = null
    setNoteFormState()
    return
  }

  title.textContent = tr("notes.edit", "Edit note")
  submit.textContent = tr("common.saveChanges", "Save Changes")
  cancel.hidden = false
  titleInput.value = entry.title
  bodyInput.value = entry.body
}

function cancelNoteEdit(){
  notesState.editingId = null
  setNoteFormState()
}

function saveNoteEntry(){
  const titleInput = document.getElementById("noteTitle")
  const bodyInput = document.getElementById("noteBody")
  const title = titleInput?.value.trim()
  const body = bodyInput?.value.trim()

  if(!title && !body){
    DailyKitFeedback.error(tr("messages.noteFirst", "Write a title or note body first."))
    return
  }

  const payload = {
    title: title || tr("notes.untitled", "Untitled note"),
    body: body || ""
  }

  if(notesState.editingId){
    DailyKitStorage.updateNote(notesState.editingId, payload)
    DailyKitFeedback.success(tr("messages.noteUpdated", "Note updated."))
  }else{
    DailyKitStorage.addNote(payload)
    DailyKitFeedback.success(tr("messages.noteSaved", "Note saved."))
  }

  notesState.editingId = null
  setNoteFormState()
  loadNotes()
}

function matchesNoteDateFilter(entry, dateFilter, today){
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

function renderNotePagination(totalItems){
  const pagination = document.getElementById("notePagination")

  if(!pagination){
    return
  }

  const pageCount = Math.max(1, Math.ceil(totalItems / notesState.pageSize))
  notesState.currentPage = Math.min(notesState.currentPage, pageCount)

  if(pageCount <= 1){
    pagination.innerHTML = ""
    return
  }

  pagination.innerHTML = `
<button type="button" class="secondary-btn" ${notesState.currentPage === 1 ? "disabled" : ""} onclick="changeNotePage(-1)">${tr("common.previous", "Previous")}</button>
<span class="pagination-status">${tr("common.pageOf", "Page {page} of {count}", {page: notesState.currentPage, count: pageCount})}</span>
<button type="button" class="secondary-btn" ${notesState.currentPage === pageCount ? "disabled" : ""} onclick="changeNotePage(1)">${tr("common.next", "Next")}</button>
`
}

function changeNotePage(offset){
  notesState.currentPage = Math.max(1, notesState.currentPage + offset)
  loadNotes()
}

function loadNotes(resetPage){
  if(resetPage){
    notesState.currentPage = 1
  }

  const data = DailyKitStorage.getNotes().slice().sort((left, right) => {
    const leftDate = DailyKitStorage.parseDateKey(left.date)?.getTime() || 0
    const rightDate = DailyKitStorage.parseDateKey(right.date)?.getTime() || 0
    return rightDate - leftDate
  })
  const list = document.getElementById("noteList")
  const meta = document.getElementById("noteMeta")
  const query = String(document.getElementById("noteSearchInput")?.value || "").trim().toLowerCase()
  const dateFilter = document.getElementById("noteDateFilter")?.value || "all"
  const today = DailyKitStorage.parseDateKey(DailyKitStorage.todayKey())

  if(!list){
    return
  }

  const filtered = data.filter((entry) => {
    const haystack = `${entry.title} ${entry.body}`.toLowerCase()
    return (!query || haystack.includes(query)) && matchesNoteDateFilter(entry, dateFilter, today)
  })
  const pageCount = Math.max(1, Math.ceil(filtered.length / notesState.pageSize))
  notesState.currentPage = Math.min(notesState.currentPage, pageCount)
  const startIndex = (notesState.currentPage - 1) * notesState.pageSize
  const currentItems = filtered.slice(startIndex, startIndex + notesState.pageSize)

  if(meta){
    meta.innerHTML = filtered.length
      ? tr("notes.meta", "Showing <strong>{count}</strong> notes", {count: filtered.length})
      : tr("notes.noMatches", "No notes match your current search or date filter.")
  }

  list.innerHTML = ""

  if(!data.length){
    list.innerHTML = `<div class='list-empty'><strong>${tr("notes.emptyTitle", "No notes yet.")}</strong><span>${tr("notes.emptyCopy", "Use this for ideas, reminders, planning, and anything you want saved offline.")}</span></div>`
    renderNotePagination(0)
    setNoteFormState()
    return
  }

  if(!filtered.length){
    list.innerHTML = `<div class='list-empty'>${tr("notes.noMatches", "No notes match your current search or date filter.")}</div>`
    renderNotePagination(0)
    setNoteFormState()
    return
  }

  currentItems.forEach((entry) => {
    list.innerHTML += `
<div class="list-item note-item">
<div class="list-copy">
<strong>${escapeNoteHtml(entry.title)}</strong>
<span>${escapeNoteHtml(formatNoteDate(entry.date))}</span>
<span class="note-preview">${escapeNoteHtml(entry.body || tr("notes.noDetails", "No details added."))}</span>
</div>
<div class="list-actions">
<button class="secondary-btn" onclick='editNote(${JSON.stringify(entry.id)})'>${tr("common.edit", "Edit")}</button>
<button onclick='deleteNote(${JSON.stringify(entry.id)})'>${tr("common.delete", "Delete")}</button>
</div>
</div>
`
  })

  renderNotePagination(filtered.length)
  setNoteFormState()
}

function editNote(id){
  notesState.editingId = id
  setNoteFormState()
  document.getElementById("noteTitle")?.focus()
}

function deleteNote(id){
  const entry = DailyKitStorage.getNotes().find((item) => item.id === id)

  if(!entry){
    return
  }

  DailyKitStorage.removeNote(id)

  if(notesState.editingId === id){
    cancelNoteEdit()
  }

  loadNotes()
  DailyKitFeedback.show(tr("notes.deleted", "Deleted note {value}.", {value: entry.title}), {
    type: "info",
    actionLabel: tr("common.undo", "Undo"),
    onAction: () => {
      DailyKitStorage.addNote(entry)
      loadNotes()
      DailyKitFeedback.success(tr("notes.restored", "Note restored."))
    }
  })
}
