const notesState = {
  editingId: null,
  currentPage: 1,
  pageSize: 8
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
<p class="section-kicker">Capture</p>
<h2>Notes</h2>
<p>Save quick ideas, reminders, and reference notes without leaving your offline workspace.</p>
</div>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">Write</p>
<h3 id="noteFormTitle">New note</h3>
</div>
</div>
<div class="tool-form">
<input id="noteTitle" placeholder="Note title">
</div>
<div class="tool-form">
<textarea id="noteBody" rows="5" placeholder="Write your note here"></textarea>
</div>
<div class="tool-form">
<button id="noteSubmitBtn" type="button" onclick="saveNoteEntry()">Save Note</button>
<button id="noteCancelBtn" type="button" class="secondary-btn" onclick="cancelNoteEdit()" hidden>Cancel</button>
</div>
</section>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">Archive</p>
<h3>Saved notes</h3>
</div>
<p class="panel-copy">Search your notes, page through older ones, and keep your daily thoughts easy to find.</p>
</div>
<div class="filters-grid filters-grid-two">
<input id="noteSearchInput" placeholder="Search notes" oninput="loadNotes(1)">
<select id="noteDateFilter" onchange="loadNotes(1)">
<option value="all">All time</option>
<option value="today">Today</option>
<option value="week">This week</option>
<option value="month">This month</option>
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
    title.textContent = "New note"
    submit.textContent = "Save Note"
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

  title.textContent = "Edit note"
  submit.textContent = "Save Changes"
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
    DailyKitFeedback.error("Write a title or note body first.")
    return
  }

  const payload = {
    title: title || "Untitled note",
    body: body || ""
  }

  if(notesState.editingId){
    DailyKitStorage.updateNote(notesState.editingId, payload)
    DailyKitFeedback.success("Note updated.")
  }else{
    DailyKitStorage.addNote(payload)
    DailyKitFeedback.success("Note saved.")
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
<button type="button" class="secondary-btn" ${notesState.currentPage === 1 ? "disabled" : ""} onclick="changeNotePage(-1)">Previous</button>
<span class="pagination-status">Page ${notesState.currentPage} of ${pageCount}</span>
<button type="button" class="secondary-btn" ${notesState.currentPage === pageCount ? "disabled" : ""} onclick="changeNotePage(1)">Next</button>
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
      ? `Showing <strong>${filtered.length}</strong> notes`
      : "No notes match your current search or date filter."
  }

  list.innerHTML = ""

  if(!data.length){
    list.innerHTML = "<div class='list-empty'><strong>No notes yet.</strong><span>Use this for ideas, reminders, planning, and anything you want saved offline.</span></div>"
    renderNotePagination(0)
    setNoteFormState()
    return
  }

  if(!filtered.length){
    list.innerHTML = "<div class='list-empty'>No notes match your current search or date filter.</div>"
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
<span class="note-preview">${escapeNoteHtml(entry.body || "No details added.")}</span>
</div>
<div class="list-actions">
<button class="secondary-btn" onclick='editNote(${JSON.stringify(entry.id)})'>Edit</button>
<button onclick='deleteNote(${JSON.stringify(entry.id)})'>Delete</button>
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
  DailyKitFeedback.show(`Deleted note ${entry.title}.`, {
    type: "info",
    actionLabel: "Undo",
    onAction: () => {
      DailyKitStorage.addNote(entry)
      loadNotes()
      DailyKitFeedback.success("Note restored.")
    }
  })
}
