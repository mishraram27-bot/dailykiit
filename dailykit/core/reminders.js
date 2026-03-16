;(function(){
let reminderInterval = null

function tr(key, fallback, replacements){
  if(!window.t){
    return fallback
  }

  return window.t(key, fallback, replacements)
}

function getNow(){
  return new Date()
}

function getTodayKey(){
  return PlifeOSStorage.todayKey()
}

function getMinutesFromTime(value){
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || "").trim())

  if(!match){
    return null
  }

  return Number(match[1]) * 60 + Number(match[2])
}

function getCurrentMinutes(){
  const now = getNow()
  return now.getHours() * 60 + now.getMinutes()
}

function canNotify(){
  return "Notification" in window && Notification.permission === "granted"
}

async function requestPermission(){
  if(!("Notification" in window)){
    PlifeOSFeedback.error(tr("reminders.unsupported", "Notifications are not supported in this browser."))
    return "unsupported"
  }

  const permission = await Notification.requestPermission()

  if(permission === "granted"){
    PlifeOSFeedback.success(tr("reminders.enabled", "Notifications enabled for PlifeOS."))
  }else{
    PlifeOSFeedback.error(tr("reminders.notGranted", "Notification permission was not granted."))
  }

  return permission
}

async function showNotification(title, body){
  if(!canNotify()){
    return false
  }

  try{
    const registration = await navigator.serviceWorker?.getRegistration?.()

    if(registration && registration.showNotification){
      await registration.showNotification(title, {
        body,
        icon: "icons/icon-192.png",
        badge: "icons/icon-192.png",
        tag: `plifeos-${title.toLowerCase().replace(/\s+/g, "-")}`
      })
      return true
    }

    new Notification(title, {body})
    return true
  }catch(error){
    return false
  }
}

function markSent(reminderKey){
  const settings = PlifeOSStorage.getReminderSettings()
  const sentLog = {...settings.sentLog}
  sentLog[reminderKey] = getTodayKey()
  PlifeOSStorage.saveReminderSettings({sentLog})
}

function wasSent(reminderKey){
  return PlifeOSStorage.getReminderSettings().sentLog[reminderKey] === getTodayKey()
}

function pruneSentLog(){
  const settings = PlifeOSStorage.getReminderSettings()
  const entries = Object.entries(settings.sentLog || {})
  const today = PlifeOSStorage.parseDateKey(getTodayKey())
  const nextLog = {}

  entries.forEach(([key, value]) => {
    const date = PlifeOSStorage.parseDateKey(value)

    if(!date){
      return
    }

    const age = (today.getTime() - date.getTime()) / 86400000

    if(age <= 45){
      nextLog[key] = value
    }
  })

  if(JSON.stringify(nextLog) !== JSON.stringify(settings.sentLog || {})){
    PlifeOSStorage.saveReminderSettings({sentLog: nextLog})
  }
}

function getHabitReminderPayload(){
  const reminderSettings = PlifeOSStorage.getReminderSettings().habits

  if(!reminderSettings.enabled){
    return null
  }

  const reminderMinutes = getMinutesFromTime(reminderSettings.time)

  if(reminderMinutes == null || getCurrentMinutes() < reminderMinutes){
    return null
  }

  const todayKey = getTodayKey()
  const pendingHabits = PlifeOSStorage.getHabits().filter((entry) => !(entry.completions || []).includes(todayKey))

  if(!pendingHabits.length || wasSent(`habit-daily:${todayKey}`)){
    return null
  }

  return {
    key: `habit-daily:${todayKey}`,
    title: tr("reminders.habitTitle", "PlifeOS habits reminder"),
    body: pendingHabits.length === 1
      ? tr("reminders.habitBodyOne", "You still have 1 habit pending today.")
      : tr("reminders.habitBodyMany", "You still have {count} habits pending today.", {count: pendingHabits.length})
  }
}

function getSubscriptionDueDate(entry){
  const now = getNow()
  const billingDay = Math.max(1, Number(entry.billingDay) || 1)
  const lastDayThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dueThisMonth = new Date(now.getFullYear(), now.getMonth(), Math.min(billingDay, lastDayThisMonth))
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if(dueThisMonth >= today){
    return dueThisMonth
  }

  const lastDayNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate()
  return new Date(now.getFullYear(), now.getMonth() + 1, Math.min(billingDay, lastDayNextMonth))
}

function getSubscriptionReminderPayload(){
  const reminderSettings = PlifeOSStorage.getReminderSettings().subscriptions

  if(!reminderSettings.enabled){
    return null
  }

  const reminderMinutes = getMinutesFromTime(reminderSettings.time)

  if(reminderMinutes == null || getCurrentMinutes() < reminderMinutes){
    return null
  }

  const today = PlifeOSStorage.parseDateKey(getTodayKey())
  const dueEntries = PlifeOSStorage.getSubscriptions().filter((entry) => {
    const dueDate = getSubscriptionDueDate(entry)
    const diffDays = Math.round((dueDate.getTime() - today.getTime()) / 86400000)
    return diffDays === reminderSettings.leadDays
  })

  const pendingEntries = dueEntries.filter((entry) => !wasSent(`subscription:${entry.id}:${getTodayKey()}`))

  if(!pendingEntries.length){
    return null
  }

  return {
    entries: pendingEntries,
    title: tr("reminders.subscriptionTitle", "PlifeOS subscription reminder"),
    body: pendingEntries.length === 1
      ? tr("reminders.subscriptionBodyOne", "{name} is coming due soon.", {name: pendingEntries[0].name})
      : tr("reminders.subscriptionBodyMany", "{count} subscriptions need attention soon.", {count: pendingEntries.length})
  }
}

async function sendReminder(title, body, fallbackMessage){
  const notified = await showNotification(title, body)

  if(!notified){
    PlifeOSFeedback.show(fallbackMessage || body, {type: "info", duration: 6000})
  }
}

async function runChecks(){
  if(!window.PlifeOSAuth?.hasSession?.()){
    return
  }

  pruneSentLog()

  const habitReminder = getHabitReminderPayload()

  if(habitReminder){
    await sendReminder(habitReminder.title, habitReminder.body, habitReminder.body)
    markSent(habitReminder.key)
  }

  const subscriptionReminder = getSubscriptionReminderPayload()

  if(subscriptionReminder){
    await sendReminder(subscriptionReminder.title, subscriptionReminder.body, subscriptionReminder.body)
    subscriptionReminder.entries.forEach((entry) => {
      markSent(`subscription:${entry.id}:${getTodayKey()}`)
    })
  }
}

function start(){
  stop()
  runChecks()
  reminderInterval = window.setInterval(runChecks, 60000)
}

function stop(){
  if(reminderInterval){
    window.clearInterval(reminderInterval)
    reminderInterval = null
  }
}

window.addEventListener("visibilitychange", () => {
  if(!document.hidden){
    runChecks()
  }
})

window.addEventListener("focus", runChecks)

window.PlifeOSReminders = {
  start,
  stop,
  runChecks,
  requestPermission,
  canNotify
}
})()
