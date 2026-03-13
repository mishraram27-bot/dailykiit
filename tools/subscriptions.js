const subscriptionState = {
  editingId: null,
  currentPage: 1,
  pageSize: 8
}

function formatSubscriptionCurrency(amount){
  return `\u20B9${Number(amount) || 0}`
}

function escapeSubscriptionHtml(value){
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function getNextDueLabel(billingDay){
  const today = new Date()
  const day = Math.max(1, Number(billingDay) || 1)
  const lastDayThisMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const currentMonthDue = new Date(today.getFullYear(), today.getMonth(), Math.min(day, lastDayThisMonth))
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  let nextDue = currentMonthDue

  if(currentMonthDue < todayOnly){
    const lastDayNextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0).getDate()
    nextDue = new Date(today.getFullYear(), today.getMonth() + 1, Math.min(day, lastDayNextMonth))
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short"
  }).format(nextDue)
}

function renderTool(){
  const area = document.getElementById("toolContainer")
  const total = DailyKitStorage.getSubscriptions().reduce((sum, item) => sum + item.amount, 0)
  const reminderSettings = DailyKitStorage.getReminderSettings().subscriptions
  const notificationStatus = "Notification" in window ? Notification.permission : "unsupported"

  area.innerHTML = `
<div class="tool-shell">
<div class="tool-heading">
<p class="section-kicker">Recurring</p>
<h2>Subscriptions</h2>
<p>Track monthly recurring costs so you always know what is due and how much they add up to.</p>
</div>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">Overview</p>
<h3>Recurring monthly load</h3>
</div>
<div class="metric-pills">
<span class="metric-pill">Monthly total ${formatSubscriptionCurrency(total)}</span>
</div>
</div>
</section>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">Reminders</p>
<h3>Upcoming due reminders</h3>
</div>
<p class="panel-copy">Set a local reminder time and how many days before the due date you want a heads-up.</p>
</div>
<div class="tool-form">
<input id="subscriptionReminderTime" type="time" value="${reminderSettings.time}">
<input id="subscriptionLeadDays" type="number" min="0" max="7" value="${reminderSettings.leadDays}">
<button type="button" class="secondary-btn" onclick="enableSubscriptionNotifications()">Notification permission: ${notificationStatus}</button>
<button type="button" onclick="saveSubscriptionReminderSettings()">${reminderSettings.enabled ? "Update Reminder" : "Enable Reminder"}</button>
</div>
</section>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">Add fast</p>
<h3 id="subscriptionFormTitle">Add subscription</h3>
</div>
</div>
<div class="tool-form">
<input id="subscriptionName" placeholder="Netflix">
<input id="subscriptionAmount" placeholder="Amount" inputmode="decimal">
<input id="subscriptionDay" placeholder="Billing day (1-31)" inputmode="numeric">
<button id="subscriptionSubmitBtn" type="button" onclick="saveSubscriptionEntry()">Add</button>
<button id="subscriptionCancelBtn" type="button" class="secondary-btn" onclick="cancelSubscriptionEdit()" hidden>Cancel</button>
</div>
</section>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">Archive</p>
<h3>Subscriptions list</h3>
</div>
<p class="panel-copy">Search and page through all recurring charges as your app grows.</p>
</div>
<div class="filters-grid filters-grid-two">
<input id="subscriptionSearchInput" placeholder="Search subscriptions" oninput="loadSubscriptions(1)">
<select id="subscriptionSort" onchange="loadSubscriptions(1)">
<option value="name">Sort by name</option>
<option value="amount">Sort by amount</option>
<option value="due">Sort by due date</option>
</select>
</div>
<div id="subscriptionMeta" class="history-meta"></div>
<div id="subscriptionList" class="list-group"></div>
<div id="subscriptionPagination" class="pagination"></div>
</section>
</div>
`

  loadSubscriptions()
}

function setSubscriptionFormState(){
  const title = document.getElementById("subscriptionFormTitle")
  const submit = document.getElementById("subscriptionSubmitBtn")
  const cancel = document.getElementById("subscriptionCancelBtn")
  const nameInput = document.getElementById("subscriptionName")
  const amountInput = document.getElementById("subscriptionAmount")
  const dayInput = document.getElementById("subscriptionDay")

  if(!title || !submit || !cancel || !nameInput || !amountInput || !dayInput){
    return
  }

  if(!subscriptionState.editingId){
    title.textContent = "Add subscription"
    submit.textContent = "Add"
    cancel.hidden = true
    nameInput.value = ""
    amountInput.value = ""
    dayInput.value = ""
    return
  }

  const entry = DailyKitStorage.getSubscriptions().find((item) => item.id === subscriptionState.editingId)

  if(!entry){
    subscriptionState.editingId = null
    setSubscriptionFormState()
    return
  }

  title.textContent = "Edit subscription"
  submit.textContent = "Save"
  cancel.hidden = false
  nameInput.value = entry.name
  amountInput.value = entry.amount
  dayInput.value = entry.billingDay
}

function cancelSubscriptionEdit(){
  subscriptionState.editingId = null
  setSubscriptionFormState()
}

function saveSubscriptionEntry(){
  const name = document.getElementById("subscriptionName")?.value.trim()
  const amount = Number(document.getElementById("subscriptionAmount")?.value)
  const billingDay = Number(document.getElementById("subscriptionDay")?.value)

  if(!name){
    DailyKitFeedback.error("Enter a subscription name.")
    return
  }

  if(!Number.isFinite(amount) || amount <= 0){
    DailyKitFeedback.error("Enter a valid amount.")
    return
  }

  if(!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31){
    DailyKitFeedback.error("Enter a billing day between 1 and 31.")
    return
  }

  const payload = {name, amount, billingDay}

  if(subscriptionState.editingId){
    DailyKitStorage.updateSubscription(subscriptionState.editingId, payload)
    DailyKitFeedback.success("Subscription updated.")
  }else{
    DailyKitStorage.addSubscription(payload)
    DailyKitFeedback.success("Subscription added.")
  }

  subscriptionState.editingId = null
  renderTool()
}

async function enableSubscriptionNotifications(){
  await DailyKitReminders.requestPermission()
  renderTool()
}

function saveSubscriptionReminderSettings(){
  const time = document.getElementById("subscriptionReminderTime")?.value
  const leadDays = Number(document.getElementById("subscriptionLeadDays")?.value)

  if(!/^\d{2}:\d{2}$/.test(String(time || ""))){
    DailyKitFeedback.error("Choose a valid reminder time.")
    return
  }

  if(!Number.isInteger(leadDays) || leadDays < 0 || leadDays > 7){
    DailyKitFeedback.error("Lead days must be between 0 and 7.")
    return
  }

  DailyKitStorage.saveReminderSettings({
    subscriptions: {
      enabled: true,
      time,
      leadDays
    }
  })
  DailyKitReminders.runChecks()
  DailyKitFeedback.success("Subscription reminder saved.")
}

function renderSubscriptionPagination(totalItems){
  const pagination = document.getElementById("subscriptionPagination")

  if(!pagination){
    return
  }

  const pageCount = Math.max(1, Math.ceil(totalItems / subscriptionState.pageSize))
  subscriptionState.currentPage = Math.min(subscriptionState.currentPage, pageCount)

  if(pageCount <= 1){
    pagination.innerHTML = ""
    return
  }

  pagination.innerHTML = `
<button type="button" class="secondary-btn" ${subscriptionState.currentPage === 1 ? "disabled" : ""} onclick="changeSubscriptionPage(-1)">Previous</button>
<span class="pagination-status">Page ${subscriptionState.currentPage} of ${pageCount}</span>
<button type="button" class="secondary-btn" ${subscriptionState.currentPage === pageCount ? "disabled" : ""} onclick="changeSubscriptionPage(1)">Next</button>
`
}

function changeSubscriptionPage(offset){
  subscriptionState.currentPage = Math.max(1, subscriptionState.currentPage + offset)
  loadSubscriptions()
}

function loadSubscriptions(resetPage){
  if(resetPage){
    subscriptionState.currentPage = 1
  }

  const sortBy = document.getElementById("subscriptionSort")?.value || "name"
  const query = String(document.getElementById("subscriptionSearchInput")?.value || "").trim().toLowerCase()
  const list = document.getElementById("subscriptionList")
  const meta = document.getElementById("subscriptionMeta")

  if(!list){
    return
  }

  const filtered = DailyKitStorage.getSubscriptions()
    .filter((entry) => !query || entry.name.toLowerCase().includes(query))
    .sort((left, right) => {
      if(sortBy === "amount"){
        return right.amount - left.amount
      }

      if(sortBy === "due"){
        return left.billingDay - right.billingDay
      }

      return left.name.localeCompare(right.name)
    })

  const total = filtered.reduce((sum, entry) => sum + entry.amount, 0)
  const pageCount = Math.max(1, Math.ceil(filtered.length / subscriptionState.pageSize))
  subscriptionState.currentPage = Math.min(subscriptionState.currentPage, pageCount)
  const startIndex = (subscriptionState.currentPage - 1) * subscriptionState.pageSize
  const currentItems = filtered.slice(startIndex, startIndex + subscriptionState.pageSize)

  if(meta){
    meta.innerHTML = filtered.length
      ? `Showing <strong>${filtered.length}</strong> subscriptions - Monthly total <strong>${formatSubscriptionCurrency(total)}</strong>`
      : "No subscriptions match the current search."
  }

  list.innerHTML = ""

  if(!filtered.length){
    list.innerHTML = "<div class='list-empty'><strong>No subscriptions yet.</strong><span>Add monthly costs like Netflix, Spotify, or domains to see your recurring load.</span></div>"
    renderSubscriptionPagination(0)
    setSubscriptionFormState()
    return
  }

  currentItems.forEach((entry) => {
    list.innerHTML += `
<div class="list-item">
<div class="list-copy">
<strong>${escapeSubscriptionHtml(entry.name)}</strong>
<span>${formatSubscriptionCurrency(entry.amount)} monthly - Next due ${escapeSubscriptionHtml(getNextDueLabel(entry.billingDay))}</span>
</div>
<div class="list-actions">
<button class="secondary-btn" onclick='editSubscription(${JSON.stringify(entry.id)})'>Edit</button>
<button onclick='deleteSubscription(${JSON.stringify(entry.id)})'>Delete</button>
</div>
</div>
`
  })

  renderSubscriptionPagination(filtered.length)
  setSubscriptionFormState()
}

function editSubscription(id){
  subscriptionState.editingId = id
  setSubscriptionFormState()
  document.getElementById("subscriptionName")?.focus()
}

function deleteSubscription(id){
  const entry = DailyKitStorage.getSubscriptions().find((item) => item.id === id)

  if(!entry){
    return
  }

  DailyKitStorage.removeSubscription(id)
  loadSubscriptions()
  DailyKitFeedback.show(`Deleted subscription ${entry.name}.`, {
    type: "info",
    actionLabel: "Undo",
    onAction: () => {
      DailyKitStorage.addSubscription(entry)
      renderTool()
      DailyKitFeedback.success("Subscription restored.")
    }
  })
}
