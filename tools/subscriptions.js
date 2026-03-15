const subscriptionState = {
  editingId: null,
  currentPage: 1,
  pageSize: 8
}

function tr(key, fallback, replacements){
  return window.t ? window.t(key, fallback, replacements) : fallback
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

  return new Intl.DateTimeFormat(localStorage.getItem("language") === "hi" ? "hi-IN" : "en-IN", {
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
<p class="section-kicker">${tr("tool.subscriptionsKicker", "Recurring")}</p>
<h2>${tr("tool.subscriptions", "Subscriptions")}</h2>
<p>${tr("tool.subscriptionsIntro", "Track monthly recurring costs so you always know what is due and how much they add up to.")}</p>
</div>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">${tr("subscriptions.overview", "Overview")}</p>
<h3>${tr("subscriptions.monthlyLoad", "Recurring monthly load")}</h3>
</div>
<div class="metric-pills">
<span class="metric-pill">${tr("subscriptions.monthlyTotal", "Monthly total {total}", {total: formatSubscriptionCurrency(total)})}</span>
</div>
</div>
</section>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">${tr("reminders.kicker", "Reminders")}</p>
<h3>${tr("subscriptions.reminderTitle", "Upcoming due reminders")}</h3>
</div>
<p class="panel-copy">${tr("subscriptions.reminderCopy", "Set a local reminder time and how many days before the due date you want a heads-up.")}</p>
</div>
<div class="tool-form">
<input id="subscriptionReminderTime" type="time" value="${reminderSettings.time}">
<input id="subscriptionLeadDays" type="number" min="0" max="7" value="${reminderSettings.leadDays}">
<button type="button" class="secondary-btn" onclick="enableSubscriptionNotifications()">${tr("reminders.permission", "Notification permission")}: ${notificationStatus}</button>
<button type="button" onclick="saveSubscriptionReminderSettings()">${reminderSettings.enabled ? tr("reminders.update", "Update Reminder") : tr("reminders.enable", "Enable Reminder")}</button>
</div>
</section>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">${tr("common.addFast", "Add fast")}</p>
<h3 id="subscriptionFormTitle">${tr("subscriptions.add", "Add subscription")}</h3>
</div>
</div>
<div class="tool-form">
<input id="subscriptionName" placeholder="${tr("subscriptions.name", "Netflix")}">
<input id="subscriptionAmount" placeholder="${tr("common.amount", "Amount")}" inputmode="decimal">
<input id="subscriptionDay" placeholder="${tr("subscriptions.billingDay", "Billing day (1-31)")}" inputmode="numeric">
<button id="subscriptionSubmitBtn" type="button" onclick="saveSubscriptionEntry()">${tr("common.add", "Add")}</button>
<button id="subscriptionCancelBtn" type="button" class="secondary-btn" onclick="cancelSubscriptionEdit()" hidden>${tr("common.cancel", "Cancel")}</button>
</div>
</section>

<section class="feature-panel">
<div class="panel-heading">
<div>
<p class="section-kicker">${tr("common.archive", "Archive")}</p>
<h3>${tr("subscriptions.list", "Subscriptions list")}</h3>
</div>
<p class="panel-copy">${tr("subscriptions.listCopy", "Search and page through all recurring charges as your app grows.")}</p>
</div>
<div class="filters-grid filters-grid-two">
<input id="subscriptionSearchInput" placeholder="${tr("subscriptions.search", "Search subscriptions")}" oninput="loadSubscriptions(1)">
<select id="subscriptionSort" onchange="loadSubscriptions(1)">
<option value="name">${tr("subscriptions.sortName", "Sort by name")}</option>
<option value="amount">${tr("subscriptions.sortAmount", "Sort by amount")}</option>
<option value="due">${tr("subscriptions.sortDue", "Sort by due date")}</option>
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
    title.textContent = tr("subscriptions.add", "Add subscription")
    submit.textContent = tr("common.add", "Add")
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

  title.textContent = tr("subscriptions.edit", "Edit subscription")
  submit.textContent = tr("common.save", "Save")
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
    DailyKitFeedback.error(tr("messages.enterSubscriptionName", "Enter a subscription name."))
    return
  }

  if(!Number.isFinite(amount) || amount <= 0){
    DailyKitFeedback.error(tr("messages.validAmount", "Enter a valid amount."))
    return
  }

  if(!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31){
    DailyKitFeedback.error(tr("messages.billingDayRange", "Enter a billing day between 1 and 31."))
    return
  }

  const payload = {name, amount, billingDay}

  if(subscriptionState.editingId){
    DailyKitStorage.updateSubscription(subscriptionState.editingId, payload)
    DailyKitFeedback.success(tr("messages.subscriptionUpdated", "Subscription updated."))
  }else{
    DailyKitStorage.addSubscription(payload)
    DailyKitFeedback.success(tr("messages.subscriptionAdded", "Subscription added."))
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
    DailyKitFeedback.error(tr("messages.validReminderTime", "Choose a valid reminder time."))
    return
  }

  if(!Number.isInteger(leadDays) || leadDays < 0 || leadDays > 7){
    DailyKitFeedback.error(tr("messages.leadDaysRange", "Lead days must be between 0 and 7."))
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
  DailyKitFeedback.success(tr("messages.subscriptionReminderSaved", "Subscription reminder saved."))
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
<button type="button" class="secondary-btn" ${subscriptionState.currentPage === 1 ? "disabled" : ""} onclick="changeSubscriptionPage(-1)">${tr("common.previous", "Previous")}</button>
<span class="pagination-status">${tr("common.pageOf", "Page {page} of {count}", {page: subscriptionState.currentPage, count: pageCount})}</span>
<button type="button" class="secondary-btn" ${subscriptionState.currentPage === pageCount ? "disabled" : ""} onclick="changeSubscriptionPage(1)">${tr("common.next", "Next")}</button>
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
      ? tr("subscriptions.meta", "Showing <strong>{count}</strong> subscriptions - Monthly total <strong>{total}</strong>", {
        count: filtered.length,
        total: formatSubscriptionCurrency(total)
      })
      : tr("subscriptions.noMatches", "No subscriptions match the current search.")
  }

  list.innerHTML = ""

  if(!filtered.length){
    list.innerHTML = `<div class='list-empty'><strong>${tr("subscriptions.emptyTitle", "No subscriptions yet.")}</strong><span>${tr("subscriptions.emptyCopy", "Add monthly costs like Netflix, Spotify, or domains to see your recurring load.")}</span></div>`
    renderSubscriptionPagination(0)
    setSubscriptionFormState()
    return
  }

  currentItems.forEach((entry) => {
    list.innerHTML += `
<div class="list-item">
<div class="list-copy">
<strong>${escapeSubscriptionHtml(entry.name)}</strong>
<span>${tr("subscriptions.itemMeta", "{amount} monthly - Next due {due}", {
  amount: formatSubscriptionCurrency(entry.amount),
  due: escapeSubscriptionHtml(getNextDueLabel(entry.billingDay))
})}</span>
</div>
<div class="list-actions">
<button class="secondary-btn" onclick='editSubscription(${JSON.stringify(entry.id)})'>${tr("common.edit", "Edit")}</button>
<button onclick='deleteSubscription(${JSON.stringify(entry.id)})'>${tr("common.delete", "Delete")}</button>
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
  DailyKitFeedback.show(tr("subscriptions.deleted", "Deleted subscription {value}.", {value: entry.name}), {
    type: "info",
    actionLabel: tr("common.undo", "Undo"),
    onAction: () => {
      DailyKitStorage.addSubscription(entry)
      renderTool()
      DailyKitFeedback.success(tr("subscriptions.restored", "Subscription restored."))
    }
  })
}

window.registerDailyKitTool?.({
  id: "subscriptions",
  render: renderTool,
  refresh: renderTool
})
