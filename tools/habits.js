const habitState = {
  editingId: null,
  currentPage: 1,
  pageSize: 8
}

function tr(key, fallback, replacements){
  return window.t ? window.t(key, fallback, replacements) : fallback
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
  const reminderSettings = LifeOSStorage.getReminderSettings().habits
  const notificationStatus = "Notification" in window ? Notification.permission : "unsupported"

  area.innerHTML = `
<div class="tool-shell">
<div class="tool-heading">
<p class="section-kicker">${tr("tool.habitsKicker", "Routine")}</p>
<h2>${tr("tool.habits", "Habits")}</h2>
<p>${tr("tool.habitsIntro", "Track the habits you want to repeat daily, mark them done, and keep your momentum visible offline.")}</p>
</div>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">${tr("habits.build", "Build")}</p>
<h3 id="habitFormTitle">${tr("habits.addHabit", "Add habit")}</h3>
</div>
</div>
<div class="tool-form">
<input id="habitInput" placeholder="${tr("habits.name", "Habit name")}">
<button id="habitSubmitBtn" type="button" onclick="saveHabitEntry()">${tr("habits.addButton", "Add Habit")}</button>
<button id="habitCancelBtn" type="button" class="secondary-btn" onclick="cancelHabitEdit()" hidden>${tr("common.cancel", "Cancel")}</button>
</div>
</section>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">${tr("reminders.kicker", "Reminders")}</p>
<h3>${tr("habits.reminderTitle", "Daily habit reminder")}</h3>
</div>
<p class="panel-copy">${tr("habits.reminderCopy", "Best-effort local reminders using your device time while the app is installed or open.")}</p>
</div>
<div class="tool-form">
<input id="habitReminderTime" type="time" value="${reminderSettings.time}">
<button type="button" class="secondary-btn" onclick="enableHabitNotifications()">${tr("reminders.permission", "Notification permission")}: ${notificationStatus}</button>
<button type="button" onclick="saveHabitReminderSettings()">${reminderSettings.enabled ? tr("reminders.update", "Update Reminder") : tr("reminders.enable", "Enable Reminder")}</button>
</div>
</section>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">${tr("habits.progress", "Progress")}</p>
<h3>${tr("habits.list", "Habit list")}</h3>
</div>
<p class="panel-copy">${tr("habits.progressCopy", "Mark today's completion and browse older habits if your list grows.")}</p>
</div>
<div class="filters-grid filters-grid-two">
<input id="habitSearchInput" placeholder="${tr("habits.search", "Search habits")}" oninput="loadHabits(1)">
<select id="habitStatusFilter" onchange="loadHabits(1)">
<option value="all">${tr("habits.all", "All habits")}</option>
<option value="done">${tr("habits.doneToday", "Done today")}</option>
<option value="pending">${tr("habits.pendingToday", "Pending today")}</option>
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
    title.textContent = tr("habits.addHabit", "Add habit")
    submit.textContent = tr("habits.addButton", "Add Habit")
    cancel.hidden = true
    input.value = ""
    return
  }

  const entry = LifeOSStorage.getHabits().find((item) => item.id === habitState.editingId)

  if(!entry){
    habitState.editingId = null
    setHabitFormState()
    return
  }

  title.textContent = tr("habits.editHabit", "Edit habit")
  submit.textContent = tr("common.saveChanges", "Save Changes")
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
    LifeOSFeedback.error(tr("messages.enterHabitFirst", "Enter a habit name first."))
    return
  }

  if(habitState.editingId){
    LifeOSStorage.updateHabit(habitState.editingId, {name: value})
    LifeOSFeedback.success(tr("messages.habitUpdated", "Habit updated."))
  }else{
    LifeOSStorage.addHabit({name: value, completions: []})
    LifeOSFeedback.success(tr("messages.habitAdded", "Habit added."))
  }

  habitState.editingId = null
  setHabitFormState()
  loadHabits()
}

async function enableHabitNotifications(){
  await LifeOSReminders.requestPermission()
  renderTool()
}

function saveHabitReminderSettings(){
  const time = document.getElementById("habitReminderTime")?.value

  if(!/^\d{2}:\d{2}$/.test(String(time || ""))){
    LifeOSFeedback.error(tr("messages.validReminderTime", "Choose a valid reminder time."))
    return
  }

  LifeOSStorage.saveReminderSettings({
    habits: {
      enabled: true,
      time
    }
  })
  LifeOSReminders.runChecks()
  LifeOSFeedback.success(tr("messages.habitReminderSaved", "Habit reminder saved."))
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
<button type="button" class="secondary-btn" ${habitState.currentPage === 1 ? "disabled" : ""} onclick="changeHabitPage(-1)">${tr("common.previous", "Previous")}</button>
<span class="pagination-status">${tr("common.pageOf", "Page {page} of {count}", {page: habitState.currentPage, count: pageCount})}</span>
<button type="button" class="secondary-btn" ${habitState.currentPage === pageCount ? "disabled" : ""} onclick="changeHabitPage(1)">${tr("common.next", "Next")}</button>
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

  const data = LifeOSStorage.getHabits()
  const list = document.getElementById("habitList")
  const meta = document.getElementById("habitMeta")
  const query = String(document.getElementById("habitSearchInput")?.value || "").trim().toLowerCase()
  const status = document.getElementById("habitStatusFilter")?.value || "all"
  const today = LifeOSStorage.todayKey()

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
      ? tr("habits.meta", "Showing <strong>{count}</strong> habits", {count: filtered.length})
      : tr("habits.noMatches", "No habits match your current search or filter.")
  }

  list.innerHTML = ""

  if(!data.length){
    list.innerHTML = `<div class='list-empty'><strong>${tr("habits.emptyTitle", "No habits yet.")}</strong><span>${tr("habits.emptyCopy", "Add one like Gym, Reading, or Walk and start marking it daily.")}</span></div>`
    renderHabitPagination(0)
    setHabitFormState()
    return
  }

  if(!filtered.length){
    list.innerHTML = `<div class='list-empty'>${tr("habits.noMatches", "No habits match your current search or filter.")}</div>`
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
<span>${doneToday ? tr("habits.completedToday", "Completed today") : tr("habits.pendingToday", "Pending today")} - ${tr("habits.totalCheckins", "{count} total check-ins", {count: completionCount})}</span>
</div>
<div class="list-actions">
<button class="secondary-btn" onclick='toggleHabitToday(${JSON.stringify(entry.id)})'>${doneToday ? tr("habits.undoToday", "Undo Today") : tr("habits.markToday", "Mark Today")}</button>
<button class="secondary-btn" onclick='editHabit(${JSON.stringify(entry.id)})'>${tr("common.edit", "Edit")}</button>
<button onclick='deleteHabit(${JSON.stringify(entry.id)})'>${tr("common.delete", "Delete")}</button>
</div>
</div>
`
  })

  renderHabitPagination(filtered.length)
  setHabitFormState()
}

function toggleHabitToday(id){
  LifeOSStorage.toggleHabitCompletion(id)
  loadHabits()
  LifeOSFeedback.success(tr("messages.habitUpdatedToday", "Habit updated for today."))
}

function editHabit(id){
  habitState.editingId = id
  setHabitFormState()
  document.getElementById("habitInput")?.focus()
}

function deleteHabit(id){
  const entry = LifeOSStorage.getHabits().find((item) => item.id === id)

  if(!entry){
    return
  }

  LifeOSStorage.removeHabit(id)

  if(habitState.editingId === id){
    cancelHabitEdit()
  }

  loadHabits()
  LifeOSFeedback.show(tr("habits.deleted", "Deleted habit {value}.", {value: entry.name}), {
    type: "info",
    actionLabel: tr("common.undo", "Undo"),
    onAction: () => {
      LifeOSStorage.addHabit(entry)
      loadHabits()
      LifeOSFeedback.success(tr("habits.restored", "Habit restored."))
    }
  })
}

window.registerLifeOSTool?.({
  id: "habits",
  render: renderTool,
  refresh: renderTool
})
