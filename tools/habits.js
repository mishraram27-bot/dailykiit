const habitState = {
  editingId: null,
  currentPage: 1,
  pageSize: 8
}

function escapeHabitHtml(value){
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function renderTool(){
  const area = document.getElementById("toolContainer")
  const reminderSettings = DailyKitStorage.getReminderSettings().habits
  const notificationStatus = "Notification" in window ? Notification.permission : "unsupported"

  area.innerHTML = `
<div class="tool-shell">
<div class="tool-heading">
<p class="section-kicker">Routine</p>
<h2>Habits</h2>
<p>Track the habits you want to repeat daily, mark them done, and keep your momentum visible offline.</p>
</div>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">Build</p>
<h3 id="habitFormTitle">Add habit</h3>
</div>
</div>
<div class="tool-form">
<input id="habitInput" placeholder="Habit name">
<button id="habitSubmitBtn" type="button" onclick="saveHabitEntry()">Add Habit</button>
<button id="habitCancelBtn" type="button" class="secondary-btn" onclick="cancelHabitEdit()" hidden>Cancel</button>
</div>
</section>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">Reminders</p>
<h3>Daily habit reminder</h3>
</div>
<p class="panel-copy">Best-effort local reminders using your device time while the app is installed or open.</p>
</div>
<div class="tool-form">
<input id="habitReminderTime" type="time" value="${reminderSettings.time}">
<button type="button" class="secondary-btn" onclick="enableHabitNotifications()">Notification permission: ${notificationStatus}</button>
<button type="button" onclick="saveHabitReminderSettings()">${reminderSettings.enabled ? "Update Reminder" : "Enable Reminder"}</button>
</div>
</section>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">Progress</p>
<h3>Habit list</h3>
</div>
<p class="panel-copy">Mark today's completion and browse older habits if your list grows.</p>
</div>
<div class="filters-grid filters-grid-two">
<input id="habitSearchInput" placeholder="Search habits" oninput="loadHabits(1)">
<select id="habitStatusFilter" onchange="loadHabits(1)">
<option value="all">All habits</option>
<option value="done">Done today</option>
<option value="pending">Pending today</option>
</select>
</div>
<div id="habitMeta" class="history-meta"></div>
<div id="habitList" class="list-group"></div>
<div id="habitPagination" class="pagination"></div>
</section>
</div>
`

  loadHabits()
}

function setHabitFormState(){
  const title = document.getElementById("habitFormTitle")
  const submit = document.getElementById("habitSubmitBtn")
  const cancel = document.getElementById("habitCancelBtn")
  const input = document.getElementById("habitInput")

  if(!title || !submit || !cancel || !input){
    return
  }

  if(!habitState.editingId){
    title.textContent = "Add habit"
    submit.textContent = "Add Habit"
    cancel.hidden = true
    input.value = ""
    return
  }

  const entry = DailyKitStorage.getHabits().find((item) => item.id === habitState.editingId)

  if(!entry){
    habitState.editingId = null
    setHabitFormState()
    return
  }

  title.textContent = "Edit habit"
  submit.textContent = "Save Changes"
  cancel.hidden = false
  input.value = entry.name
}

function cancelHabitEdit(){
  habitState.editingId = null
  setHabitFormState()
}

function saveHabitEntry(){
  const input = document.getElementById("habitInput")
  const value = input?.value.trim()

  if(!value){
    DailyKitFeedback.error("Enter a habit name first.")
    return
  }

  if(habitState.editingId){
    DailyKitStorage.updateHabit(habitState.editingId, {name: value})
    DailyKitFeedback.success("Habit updated.")
  }else{
    DailyKitStorage.addHabit({name: value, completions: []})
    DailyKitFeedback.success("Habit added.")
  }

  habitState.editingId = null
  setHabitFormState()
  loadHabits()
}

async function enableHabitNotifications(){
  await DailyKitReminders.requestPermission()
  renderTool()
}

function saveHabitReminderSettings(){
  const time = document.getElementById("habitReminderTime")?.value

  if(!/^\d{2}:\d{2}$/.test(String(time || ""))){
    DailyKitFeedback.error("Choose a valid reminder time.")
    return
  }

  DailyKitStorage.saveReminderSettings({
    habits: {
      enabled: true,
      time
    }
  })
  DailyKitReminders.runChecks()
  DailyKitFeedback.success("Habit reminder saved.")
}

function renderHabitPagination(totalItems){
  const pagination = document.getElementById("habitPagination")

  if(!pagination){
    return
  }

  const pageCount = Math.max(1, Math.ceil(totalItems / habitState.pageSize))
  habitState.currentPage = Math.min(habitState.currentPage, pageCount)

  if(pageCount <= 1){
    pagination.innerHTML = ""
    return
  }

  pagination.innerHTML = `
<button type="button" class="secondary-btn" ${habitState.currentPage === 1 ? "disabled" : ""} onclick="changeHabitPage(-1)">Previous</button>
<span class="pagination-status">Page ${habitState.currentPage} of ${pageCount}</span>
<button type="button" class="secondary-btn" ${habitState.currentPage === pageCount ? "disabled" : ""} onclick="changeHabitPage(1)">Next</button>
`
}

function changeHabitPage(offset){
  habitState.currentPage = Math.max(1, habitState.currentPage + offset)
  loadHabits()
}

function loadHabits(resetPage){
  if(resetPage){
    habitState.currentPage = 1
  }

  const data = DailyKitStorage.getHabits()
  const list = document.getElementById("habitList")
  const meta = document.getElementById("habitMeta")
  const query = String(document.getElementById("habitSearchInput")?.value || "").trim().toLowerCase()
  const status = document.getElementById("habitStatusFilter")?.value || "all"
  const today = DailyKitStorage.todayKey()

  if(!list){
    return
  }

  const filtered = data.filter((entry) => {
    const matchesQuery = !query || entry.name.toLowerCase().includes(query)
    const doneToday = (entry.completions || []).includes(today)
    const matchesStatus = status === "all" || (status === "done" ? doneToday : !doneToday)
    return matchesQuery && matchesStatus
  })
  const pageCount = Math.max(1, Math.ceil(filtered.length / habitState.pageSize))
  habitState.currentPage = Math.min(habitState.currentPage, pageCount)
  const startIndex = (habitState.currentPage - 1) * habitState.pageSize
  const currentItems = filtered.slice(startIndex, startIndex + habitState.pageSize)

  if(meta){
    meta.innerHTML = filtered.length
      ? `Showing <strong>${filtered.length}</strong> habits`
      : "No habits match your current search or filter."
  }

  list.innerHTML = ""

  if(!data.length){
    list.innerHTML = "<div class='list-empty'><strong>No habits yet.</strong><span>Add one like Gym, Reading, or Walk and start marking it daily.</span></div>"
    renderHabitPagination(0)
    setHabitFormState()
    return
  }

  if(!filtered.length){
    list.innerHTML = "<div class='list-empty'>No habits match your current search or filter.</div>"
    renderHabitPagination(0)
    setHabitFormState()
    return
  }

  currentItems.forEach((entry) => {
    const doneToday = (entry.completions || []).includes(today)
    const completionCount = (entry.completions || []).length

    list.innerHTML += `
<div class="list-item">
<div class="list-copy">
<strong>${escapeHabitHtml(entry.name)}</strong>
<span>${doneToday ? "Completed today" : "Pending today"} - ${completionCount} total check-ins</span>
</div>
<div class="list-actions">
<button class="secondary-btn" onclick='toggleHabitToday(${JSON.stringify(entry.id)})'>${doneToday ? "Undo Today" : "Mark Today"}</button>
<button class="secondary-btn" onclick='editHabit(${JSON.stringify(entry.id)})'>Edit</button>
<button onclick='deleteHabit(${JSON.stringify(entry.id)})'>Delete</button>
</div>
</div>
`
  })

  renderHabitPagination(filtered.length)
  setHabitFormState()
}

function toggleHabitToday(id){
  DailyKitStorage.toggleHabitCompletion(id)
  loadHabits()
  DailyKitFeedback.success("Habit updated for today.")
}

function editHabit(id){
  habitState.editingId = id
  setHabitFormState()
  document.getElementById("habitInput")?.focus()
}

function deleteHabit(id){
  const entry = DailyKitStorage.getHabits().find((item) => item.id === id)

  if(!entry){
    return
  }

  DailyKitStorage.removeHabit(id)

  if(habitState.editingId === id){
    cancelHabitEdit()
  }

  loadHabits()
  DailyKitFeedback.show(`Deleted habit ${entry.name}.`, {
    type: "info",
    actionLabel: "Undo",
    onAction: () => {
      DailyKitStorage.addHabit(entry)
      loadHabits()
      DailyKitFeedback.success("Habit restored.")
    }
  })
}
