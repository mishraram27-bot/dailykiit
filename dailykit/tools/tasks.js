const taskState = {
  editingId: null,
  currentPage: 1,
  pageSize: 8
}

function tr(key, fallback, replacements){
  return window.t ? window.t(key, fallback, replacements) : fallback
}

function escapeTaskHtml(value){
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function formatTaskDate(value){
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

function getTaskPriorityLabel(priority){
  const map = {
    low: tr("tasks.priorityLow", "Low"),
    medium: tr("tasks.priorityMedium", "Medium"),
    high: tr("tasks.priorityHigh", "High")
  }

  return map[priority] || map.medium
}

function renderTool(){
  const area = document.getElementById("toolContainer")
  const tasks = PlifeOSStorage.getTasks()
  const openCount = tasks.filter((entry) => !entry.done).length
  const doneCount = tasks.filter((entry) => entry.done).length

  area.innerHTML = `
<div class="tool-shell">
<div class="tool-heading">
<p class="section-kicker">${tr("tool.tasksKicker", "Execution")}</p>
<h2>${tr("tool.tasks", "Tasks")}</h2>
<p>${tr("tool.tasksIntro", "Keep a simple today list, mark things done, and stay focused without opening a separate task app.")}</p>
</div>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">${tr("tasks.overview", "Overview")}</p>
<h3>${tr("tasks.todayList", "Today list")}</h3>
</div>
<div class="metric-pills">
<span class="metric-pill">${tr("tasks.openCount", "{count} open", {count: openCount})}</span>
<span class="metric-pill">${tr("tasks.doneCount", "{count} done", {count: doneCount})}</span>
</div>
</div>
</section>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">${tr("common.addFast", "Add fast")}</p>
<h3 id="taskFormTitle">${tr("tasks.addTask", "Add task")}</h3>
</div>
</div>
<div class="tool-form">
<input id="taskTitleInput" placeholder="${tr("tasks.title", "Task title")}">
<select id="taskPriorityInput">
<option value="medium">${tr("tasks.priorityMedium", "Medium")}</option>
<option value="high">${tr("tasks.priorityHigh", "High")}</option>
<option value="low">${tr("tasks.priorityLow", "Low")}</option>
</select>
<button id="taskSubmitBtn" type="button" onclick="saveTaskEntry()">${tr("tasks.addButton", "Add Task")}</button>
<button id="taskCancelBtn" type="button" class="secondary-btn" onclick="cancelTaskEdit()" hidden>${tr("common.cancel", "Cancel")}</button>
</div>
</section>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">${tr("common.history", "History")}</p>
<h3>${tr("tasks.list", "Task archive")}</h3>
</div>
<p class="panel-copy">${tr("tasks.listCopy", "Search through open and completed tasks, then page through older items as your list grows.")}</p>
</div>
<div class="filters-grid filters-grid-two">
<input id="taskSearchInput" placeholder="${tr("tasks.search", "Search tasks")}" oninput="loadTasks(1)">
<select id="taskStatusFilter" onchange="loadTasks(1)">
<option value="all">${tr("tasks.all", "All tasks")}</option>
<option value="open">${tr("tasks.openOnly", "Open only")}</option>
<option value="done">${tr("tasks.doneOnly", "Done only")}</option>
</select>
</div>
<div id="taskMeta" class="history-meta"></div>
<div id="taskList" class="list-group"></div>
<div id="taskPagination" class="pagination"></div>
</section>
</div>
`

  loadTasks()
}

function setTaskFormState(){
  const title = document.getElementById("taskFormTitle")
  const submit = document.getElementById("taskSubmitBtn")
  const cancel = document.getElementById("taskCancelBtn")
  const input = document.getElementById("taskTitleInput")
  const priority = document.getElementById("taskPriorityInput")

  if(!title || !submit || !cancel || !input || !priority){
    return
  }

  if(!taskState.editingId){
    title.textContent = tr("tasks.addTask", "Add task")
    submit.textContent = tr("tasks.addButton", "Add Task")
    cancel.hidden = true
    input.value = ""
    priority.value = "medium"
    return
  }

  const entry = PlifeOSStorage.getTasks().find((item) => item.id === taskState.editingId)

  if(!entry){
    taskState.editingId = null
    setTaskFormState()
    return
  }

  title.textContent = tr("tasks.editTask", "Edit task")
  submit.textContent = tr("common.saveChanges", "Save Changes")
  cancel.hidden = false
  input.value = entry.title
  priority.value = entry.priority || "medium"
}

function cancelTaskEdit(){
  taskState.editingId = null
  setTaskFormState()
}

function saveTaskEntry(){
  const title = document.getElementById("taskTitleInput")?.value.trim()
  const priority = document.getElementById("taskPriorityInput")?.value || "medium"

  if(!title){
    PlifeOSFeedback.error(tr("messages.enterTaskFirst", "Enter a task title first."))
    return
  }

  const payload = {
    title,
    priority
  }

  if(taskState.editingId){
    PlifeOSStorage.updateTask(taskState.editingId, payload)
    PlifeOSFeedback.success(tr("messages.taskUpdated", "Task updated."))
  }else{
    PlifeOSStorage.addTask({
      ...payload,
      done: false
    })
    PlifeOSFeedback.success(tr("messages.taskAdded", "Task added."))
  }

  taskState.editingId = null
  renderTool()
}

function renderTaskPagination(totalItems){
  const pagination = document.getElementById("taskPagination")

  if(!pagination){
    return
  }

  const pageCount = Math.max(1, Math.ceil(totalItems / taskState.pageSize))
  taskState.currentPage = Math.min(taskState.currentPage, pageCount)

  if(pageCount <= 1){
    pagination.innerHTML = ""
    return
  }

  pagination.innerHTML = `
<button type="button" class="secondary-btn" ${taskState.currentPage === 1 ? "disabled" : ""} onclick="changeTaskPage(-1)">${tr("common.previous", "Previous")}</button>
<span class="pagination-status">${tr("common.pageOf", "Page {page} of {count}", {page: taskState.currentPage, count: pageCount})}</span>
<button type="button" class="secondary-btn" ${taskState.currentPage === pageCount ? "disabled" : ""} onclick="changeTaskPage(1)">${tr("common.next", "Next")}</button>
`
}

function changeTaskPage(offset){
  taskState.currentPage = Math.max(1, taskState.currentPage + offset)
  loadTasks()
}

function loadTasks(resetPage){
  if(resetPage){
    taskState.currentPage = 1
  }

  const list = document.getElementById("taskList")
  const meta = document.getElementById("taskMeta")

  if(!list){
    return
  }

  const query = String(document.getElementById("taskSearchInput")?.value || "").trim().toLowerCase()
  const status = document.getElementById("taskStatusFilter")?.value || "all"
  const data = PlifeOSStorage.getTasks().slice().sort((left, right) => {
    const leftDate = PlifeOSStorage.parseDateKey(left.date)?.getTime() || 0
    const rightDate = PlifeOSStorage.parseDateKey(right.date)?.getTime() || 0
    return rightDate - leftDate
  })
  const filtered = data.filter((entry) => {
    const matchesQuery = !query || `${entry.title} ${entry.priority}`.toLowerCase().includes(query)
    const matchesStatus =
      status === "all" ||
      (status === "done" ? entry.done : !entry.done)

    return matchesQuery && matchesStatus
  })
  const pageCount = Math.max(1, Math.ceil(filtered.length / taskState.pageSize))
  taskState.currentPage = Math.min(taskState.currentPage, pageCount)
  const startIndex = (taskState.currentPage - 1) * taskState.pageSize
  const currentItems = filtered.slice(startIndex, startIndex + taskState.pageSize)

  if(meta){
    meta.innerHTML = filtered.length
      ? tr("tasks.meta", "Showing <strong>{count}</strong> tasks", {count: filtered.length})
      : tr("tasks.noMatches", "No tasks match your current search or filter.")
  }

  list.innerHTML = ""

  if(!data.length){
    list.innerHTML = `<div class='list-empty'><strong>${tr("tasks.emptyTitle", "No tasks yet.")}</strong><span>${tr("tasks.emptyCopy", "Start with something simple like <b>task call bank</b> and keep your day list in one place.")}</span></div>`
    renderTaskPagination(0)
    setTaskFormState()
    return
  }

  if(!filtered.length){
    list.innerHTML = `<div class='list-empty'>${tr("tasks.noMatches", "No tasks match your current search or filter.")}</div>`
    renderTaskPagination(0)
    setTaskFormState()
    return
  }

  currentItems.forEach((entry) => {
    list.innerHTML += `
<div class="list-item">
<div class="list-copy">
<strong>${escapeTaskHtml(entry.title)}</strong>
<span>${tr("tasks.itemMeta", "{priority} priority - {date}", {
  priority: escapeTaskHtml(getTaskPriorityLabel(entry.priority)),
  date: escapeTaskHtml(formatTaskDate(entry.date))
})}</span>
</div>
<div class="list-actions">
<button class="secondary-btn" onclick='toggleTaskDone(${JSON.stringify(entry.id)})'>${entry.done ? tr("tasks.undoDone", "Mark Open") : tr("tasks.markDone", "Mark Done")}</button>
<button class="secondary-btn" onclick='editTask(${JSON.stringify(entry.id)})'>${tr("common.edit", "Edit")}</button>
<button onclick='deleteTask(${JSON.stringify(entry.id)})'>${tr("common.delete", "Delete")}</button>
</div>
</div>
`
  })

  renderTaskPagination(filtered.length)
  setTaskFormState()
}

function toggleTaskDone(id){
  PlifeOSStorage.toggleTaskCompletion(id)
  loadTasks()
  PlifeOSFeedback.success(tr("messages.taskToggled", "Task updated."))
}

function editTask(id){
  taskState.editingId = id
  setTaskFormState()
  document.getElementById("taskTitleInput")?.focus()
}

function deleteTask(id){
  const entry = PlifeOSStorage.getTasks().find((item) => item.id === id)

  if(!entry){
    return
  }

  PlifeOSStorage.removeTask(id)

  if(taskState.editingId === id){
    cancelTaskEdit()
  }

  loadTasks()
  PlifeOSFeedback.show(tr("tasks.deleted", "Deleted task {value}.", {value: entry.title}), {
    type: "info",
    actionLabel: tr("common.undo", "Undo"),
    onAction: () => {
      PlifeOSStorage.addTask(entry)
      renderTool()
      PlifeOSFeedback.success(tr("tasks.restored", "Task restored."))
    }
  })
}

window.registerPlifeOSTool?.({
  id: "tasks",
  render: renderTool,
  refresh: renderTool
})
