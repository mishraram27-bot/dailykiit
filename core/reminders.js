;(function(){
let reminderInterval = null

function getNow(){
  return new Date()
}

function getTodayKey(){
  return DailyKitStorage.todayKey()
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
    DailyKitFeedback.error("Notifications are not supported in this browser.")
    return "unsupported"
  }

  const permission = await Notification.requestPermission()

  if(permission === "granted"){
    DailyKitFeedback.success("Notifications enabled for DailyKit.")
  }else{
    DailyKitFeedback.error("Notification permission was not granted.")
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
        tag: `dailykit-${title.toLowerCase().replace(/\s+/g, "-")}`
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
  const settings = DailyKitStorage.getReminderSettings()
  const sentLog = {...settings.sentLog}
  sentLog[reminderKey] = getTodayKey()
  DailyKitStorage.saveReminderSettings({sentLog})
}

function wasSent(reminderKey){
  return DailyKitStorage.getReminderSettings().sentLog[reminderKey] === getTodayKey()
}

function pruneSentLog(){
  const settings = DailyKitStorage.getReminderSettings()
  const entries = Object.entries(settings.sentLog || {})
  const today = DailyKitStorage.parseDateKey(getTodayKey())
  const nextLog = {}

  entries.forEach(([key, value]) => {
    const date = DailyKitStorage.parseDateKey(value)

    if(!date){
      return
    }

    const age = (today.getTime() - date.getTime()) / 86400000

    if(age <= 45){
      nextLog[key] = value
    }
  })

  if(JSON.stringify(nextLog) !== JSON.stringify(settings.sentLog || {})){
    DailyKitStorage.saveReminderSettings({sentLog: nextLog})
  }
}

function getHabitReminderPayload(){
  const reminderSettings = DailyKitStorage.getReminderSettings().habits

  if(!reminderSettings.enabled){
    return null
  }

  const reminderMinutes = getMinutesFromTime(reminderSettings.time)

  if(reminderMinutes == null || getCurrentMinutes() < reminderMinutes){
    return null
  }

  const todayKey = getTodayKey()
  const pendingHabits = DailyKitStorage.getHabits().filter((entry) => !(entry.completions || []).includes(todayKey))

  if(!pendingHabits.length || wasSent(`habit-daily:${todayKey}`)){
    return null
  }

  return {
    key: `habit-daily:${todayKey}`,
    title: "DailyKit habits reminder",
    body: `You still have ${pendingHabits.length} habit${pendingHabits.length > 1 ? "s" : ""} pending today.`
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
  const reminderSettings = DailyKitStorage.getReminderSettings().subscriptions

  if(!reminderSettings.enabled){
    return null
  }

  const reminderMinutes = getMinutesFromTime(reminderSettings.time)

  if(reminderMinutes == null || getCurrentMinutes() < reminderMinutes){
    return null
  }

  const today = DailyKitStorage.parseDateKey(getTodayKey())
  const dueEntries = DailyKitStorage.getSubscriptions().filter((entry) => {
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
    title: "DailyKit subscription reminder",
    body: pendingEntries.length === 1
      ? `${pendingEntries[0].name} is coming due soon.`
      : `${pendingEntries.length} subscriptions need attention soon.`
  }
}

async function sendReminder(title, body, fallbackMessage){
  const notified = await showNotification(title, body)

  if(!notified){
    DailyKitFeedback.show(fallbackMessage || body, {type: "info", duration: 6000})
  }
}

async function runChecks(){
  if(!window.DailyKitAuth?.hasSession?.()){
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

window.DailyKitReminders = {
  start,
  stop,
  runChecks,
  requestPermission,
  canNotify
}
})()
