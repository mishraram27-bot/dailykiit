;(function(){
const DEFAULT_EXPENSE_CATEGORIES = ["Transport", "Food", "Grocery", "Other"]
const STORAGE_VERSION = 3
const STORAGE_VERSION_KEY = "storageVersion"
const ERROR_LOG_LIMIT = 25
const CATEGORY_MEMORY_LIMIT = 120
const TEXT_LIMITS = {
  short: 80,
  medium: 140,
  note: 5000,
  category: 40
}

function normalizeText(value, maxLength){
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength)
}

function formatDateKey(date){
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function parseDateKey(value){
  if(value instanceof Date && !Number.isNaN(value.getTime())){
    return new Date(value.getFullYear(), value.getMonth(), value.getDate())
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim())

  if(match){
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  }

  const parsed = new Date(value)

  if(Number.isNaN(parsed.getTime())){
    return null
  }

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
}

function today(){
  return formatDateKey(new Date())
}

function normalizeDateKey(value){
  const parsed = parseDateKey(value)
  return parsed ? formatDateKey(parsed) : today()
}

function safeParse(value, fallback){
  if(!value){
    return fallback
  }

  try{
    const parsed = JSON.parse(value)
    return parsed ?? fallback
  }catch(error){
    return fallback
  }
}

function createId(prefix){
  if(typeof crypto !== "undefined" && crypto.randomUUID){
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizeCategoryName(value){
  return normalizeText(value, TEXT_LIMITS.category)
}

function normalizeCategoryList(value){
  const unique = []
  const source = Array.isArray(value) ? value : []

  DEFAULT_EXPENSE_CATEGORIES.concat(source.map(normalizeCategoryName)).forEach((entry) => {
    if(entry && !unique.some((item) => item.toLowerCase() === entry.toLowerCase())){
      unique.push(entry)
    }
  })

  return unique
}

function normalizeCategoryMemory(value){
  const source = value && typeof value === "object" ? value : {}
  const pairs = Object.entries(source)
    .map(([name, category]) => [
      normalizeText(name, TEXT_LIMITS.short).toLowerCase(),
      normalizeCategoryName(category)
    ])
    .filter(([name, category]) => name && category)
    .slice(-CATEGORY_MEMORY_LIMIT)

  return Object.fromEntries(pairs)
}

function inferExpenseCategory(name){
  const normalizedName = normalizeText(name, TEXT_LIMITS.short)
  const value = normalizedName.toLowerCase()
  const rememberedCategory = storage?.getBudgetSettings?.().categoryMemory?.[value]

  if(rememberedCategory){
    return rememberedCategory
  }

  const transport = ["bus", "train", "flight", "taxi", "uber", "auto", "metro", "petrol"]
  const food = ["tea", "coffee", "lunch", "dinner", "breakfast", "snack", "food"]
  const grocery = ["milk", "bread", "vegetable", "fruit", "rice", "grocery"]

  if(transport.some((item) => value.includes(item))) return "Transport"
  if(food.some((item) => value.includes(item))) return "Food"
  if(grocery.some((item) => value.includes(item))) return "Grocery"

  return "Other"
}

function normalizeExpense(entry){
  if(!entry || typeof entry !== "object"){
    return null
  }

  const name = normalizeText(entry.name, TEXT_LIMITS.short)
  const amount = Number(entry.amount)

  if(!name || !Number.isFinite(amount) || amount <= 0){
    return null
  }

  const category = normalizeCategoryName(entry.category) || inferExpenseCategory(name)

  return {
    id: entry.id || createId("expense"),
    name,
    amount,
    date: normalizeDateKey(entry.date),
    category
  }
}

function normalizeBorrow(entry){
  if(!entry || typeof entry !== "object"){
    return null
  }

  const person = normalizeText(entry.person, TEXT_LIMITS.short)
  const amount = Number(entry.amount)

  if(!person || !Number.isFinite(amount) || amount <= 0){
    return null
  }

  return {
    id: entry.id || createId("borrow"),
    person,
    amount,
    date: normalizeDateKey(entry.date)
  }
}

function normalizeGrocery(entry){
  if(typeof entry === "string"){
    const name = normalizeText(entry, TEXT_LIMITS.short)

    if(!name){
      return null
    }

    return {
      id: createId("grocery"),
      name,
      done: false,
      date: today()
    }
  }

  if(!entry || typeof entry !== "object"){
    return null
  }

  const name = normalizeText(entry.name, TEXT_LIMITS.short)

  if(!name){
    return null
  }

  return {
    id: entry.id || createId("grocery"),
    name,
    done: Boolean(entry.done),
    date: normalizeDateKey(entry.date)
  }
}

function normalizeSettings(value){
  const source = value && typeof value === "object" ? value : {}
  const monthlyBudget = Number(source.monthlyBudget)
  const reminders = source.reminders && typeof source.reminders === "object" ? source.reminders : {}
  const habitTime = /^\d{2}:\d{2}$/.test(String(reminders.habits?.time || "")) ? reminders.habits.time : "20:00"
  const subscriptionTime = /^\d{2}:\d{2}$/.test(String(reminders.subscriptions?.time || "")) ? reminders.subscriptions.time : "09:00"
  const subscriptionLeadDays = Number(reminders.subscriptions?.leadDays)
  const sentLog = reminders.sentLog && typeof reminders.sentLog === "object" ? reminders.sentLog : {}

  return {
    monthlyBudget: Number.isFinite(monthlyBudget) && monthlyBudget > 0 ? monthlyBudget : null,
    expenseCategories: normalizeCategoryList(source.expenseCategories),
    categoryMemory: normalizeCategoryMemory(source.categoryMemory),
    reminders: {
      habits: {
        enabled: Boolean(reminders.habits?.enabled),
        time: habitTime
      },
      subscriptions: {
        enabled: Boolean(reminders.subscriptions?.enabled),
        time: subscriptionTime,
        leadDays: Number.isInteger(subscriptionLeadDays) && subscriptionLeadDays >= 0 && subscriptionLeadDays <= 7
          ? subscriptionLeadDays
          : 1
      },
      sentLog
    }
  }
}

function normalizeHabit(entry){
  if(!entry || typeof entry !== "object"){
    return null
  }

  const name = normalizeText(entry.name, TEXT_LIMITS.short)

  if(!name){
    return null
  }

  const completions = Array.isArray(entry.completions)
    ? entry.completions.map(normalizeDateKey).filter(Boolean)
    : []

  return {
    id: entry.id || createId("habit"),
    name,
    completions: [...new Set(completions)].sort()
  }
}

function normalizeNote(entry){
  if(!entry || typeof entry !== "object"){
    return null
  }

  const title = normalizeText(entry.title, TEXT_LIMITS.medium)
  const body = String(entry.body || "").trim().slice(0, TEXT_LIMITS.note)

  if(!title && !body){
    return null
  }

  return {
    id: entry.id || createId("note"),
    title: title || "Untitled note",
    body,
    date: normalizeDateKey(entry.date)
  }
}

function normalizeTaskPriority(value){
  const priority = normalizeText(value, TEXT_LIMITS.short).toLowerCase()
  return ["low", "medium", "high"].includes(priority) ? priority : "medium"
}

function normalizeTask(entry){
  if(!entry || typeof entry !== "object"){
    return null
  }

  const title = normalizeText(entry.title, TEXT_LIMITS.medium)

  if(!title){
    return null
  }

  return {
    id: entry.id || createId("task"),
    title,
    done: Boolean(entry.done),
    priority: normalizeTaskPriority(entry.priority),
    date: normalizeDateKey(entry.date)
  }
}

function normalizeJournal(entry){
  if(!entry || typeof entry !== "object"){
    return null
  }

  const title = normalizeText(entry.title, TEXT_LIMITS.medium)
  const mood = normalizeText(entry.mood, TEXT_LIMITS.short)
  const body = String(entry.body || "").trim().slice(0, TEXT_LIMITS.note)

  if(!title && !body){
    return null
  }

  return {
    id: entry.id || createId("journal"),
    title: title || "Daily reflection",
    mood: mood || "Neutral",
    body,
    date: normalizeDateKey(entry.date)
  }
}

function normalizeSubscription(entry){
  if(!entry || typeof entry !== "object"){
    return null
  }

  const name = normalizeText(entry.name, TEXT_LIMITS.short)
  const amount = Number(entry.amount)

  if(!name || !Number.isFinite(amount) || amount <= 0){
    return null
  }

  return {
    id: entry.id || createId("subscription"),
    name,
    amount,
    billingDay: Math.max(1, Math.min(31, Number(entry.billingDay) || 1)),
    date: normalizeDateKey(entry.date)
  }
}

function normalizeList(value, normalizer){
  if(!Array.isArray(value)){
    return []
  }

  return value.map(normalizer).filter(Boolean)
}

function getScopedKey(key, userId){
  return `plifeos:${userId}:${key}`
}

function resolveKey(key){
  const userId = window.PlifeOSAuth?.getStorageNamespace?.()

  if(!userId){
    return key
  }

  const scopedKey = getScopedKey(key, userId)
  const scopedValue = localStorage.getItem(scopedKey)
  const legacyValue = localStorage.getItem(key)

  if(scopedValue == null && legacyValue != null){
    localStorage.setItem(scopedKey, legacyValue)
  }

  return scopedKey
}

function resolveRawKey(key){
  return resolveKey(key)
}

function read(key, fallback){
  return safeParse(localStorage.getItem(resolveKey(key)), fallback)
}

function write(key, value){
  localStorage.setItem(resolveKey(key), JSON.stringify(value))
  window.PlifeOSEvents?.emit?.("storage:changed", {key, value})
  return value
}

function readStorageVersion(){
  const raw = Number(localStorage.getItem(resolveRawKey(STORAGE_VERSION_KEY)))
  return Number.isInteger(raw) && raw > 0 ? raw : 1
}

function writeStorageVersion(version){
  localStorage.setItem(resolveRawKey(STORAGE_VERSION_KEY), String(version))
  return version
}

function normalizeErrorLog(entry){
  if(!entry || typeof entry !== "object"){
    return null
  }

  const message = String(entry.message || "").trim().slice(0, 500)

  if(!message){
    return null
  }

  return {
    id: entry.id || createId("error"),
    type: normalizeText(entry.type, TEXT_LIMITS.short) || "error",
    message,
    source: normalizeText(entry.source, TEXT_LIMITS.medium),
    stack: String(entry.stack || "").slice(0, 2000),
    timestamp: Number(entry.timestamp) || Date.now()
  }
}

function getNormalized(key, fallback, normalizer){
  const raw = read(key, fallback)
  const normalized = normalizer(raw)

  if(JSON.stringify(raw) !== JSON.stringify(normalized)){
    write(key, normalized)
  }

  return normalized
}

function transferUserData(fromUserId, toUserId){
  if(!fromUserId || !toUserId || fromUserId === toUserId){
    return
  }

  ;["expenses", "borrow", "grocery", "habits", "notes", "tasks", "journal", "subscriptions", "settings"].forEach((key) => {
    const fromKey = getScopedKey(key, fromUserId)
    const toKey = getScopedKey(key, toUserId)
    const fromValue = localStorage.getItem(fromKey)
    const toValue = localStorage.getItem(toKey)

    if(fromValue && !toValue){
      localStorage.setItem(toKey, fromValue)
    }
  })
}

const storage = {
  todayKey: today,
  formatDateKey,
  parseDateKey,
  inferExpenseCategory,
  ensureReady(){
    ensureStorageVersion()
    storage.validateAllData()
    return true
  },
  getStorageVersion(){
    return readStorageVersion()
  },
  getExpenses(){
    return getNormalized("expenses", [], (value) => normalizeList(value, normalizeExpense))
  },
  saveExpenses(items){
    return write("expenses", normalizeList(items, normalizeExpense))
  },
  addExpense(entry){
    const items = storage.getExpenses()
    const nextEntry = normalizeExpense(entry)

    if(!nextEntry){
      return null
    }

    items.push(nextEntry)
    storage.saveExpenses(items)
    storage.addExpenseCategory(nextEntry.category)
    storage.rememberExpenseCategory(nextEntry.name, nextEntry.category)
    return nextEntry
  },
  updateExpense(id, nextEntry){
    let updatedEntry = null
    const result = storage.saveExpenses(
      storage.getExpenses().map((entry) => {
        if(entry.id !== id){
          return entry
        }

        updatedEntry = {
          ...entry,
          ...nextEntry,
          id: entry.id
        }

        return updatedEntry
      })
    )

    if(updatedEntry){
      storage.addExpenseCategory(updatedEntry.category)
      storage.rememberExpenseCategory(updatedEntry.name, updatedEntry.category)
    }

    return result
  },
  removeExpense(id){
    return storage.saveExpenses(
      storage.getExpenses().filter((entry) => entry.id !== id)
    )
  },
  getBorrow(){
    return getNormalized("borrow", [], (value) => normalizeList(value, normalizeBorrow))
  },
  saveBorrow(items){
    return write("borrow", normalizeList(items, normalizeBorrow))
  },
  addBorrow(entry){
    const items = storage.getBorrow()
    const nextEntry = normalizeBorrow(entry)

    if(!nextEntry){
      return null
    }

    items.push(nextEntry)
    storage.saveBorrow(items)
    return nextEntry
  },
  updateBorrow(id, nextEntry){
    return storage.saveBorrow(
      storage.getBorrow().map((entry) => {
        if(entry.id !== id){
          return entry
        }

        return {
          ...entry,
          ...nextEntry,
          id: entry.id
        }
      })
    )
  },
  removeBorrow(id){
    return storage.saveBorrow(
      storage.getBorrow().filter((entry) => entry.id !== id)
    )
  },
  getGrocery(){
    return getNormalized("grocery", [], (value) => normalizeList(value, normalizeGrocery))
  },
  saveGrocery(items){
    return write("grocery", normalizeList(items, normalizeGrocery))
  },
  addGrocery(entry){
    const items = storage.getGrocery()
    const nextEntry = normalizeGrocery(entry)

    if(!nextEntry){
      return null
    }

    items.push(nextEntry)
    storage.saveGrocery(items)
    return nextEntry
  },
  updateGrocery(id, nextEntry){
    return storage.saveGrocery(
      storage.getGrocery().map((entry) => {
        if(entry.id !== id){
          return entry
        }

        return {
          ...entry,
          ...nextEntry,
          id: entry.id
        }
      })
    )
  },
  removeGrocery(id){
    return storage.saveGrocery(
      storage.getGrocery().filter((entry) => entry.id !== id)
    )
  },
  getHabits(){
    return getNormalized("habits", [], (value) => normalizeList(value, normalizeHabit))
  },
  saveHabits(items){
    return write("habits", normalizeList(items, normalizeHabit))
  },
  addHabit(entry){
    const items = storage.getHabits()
    const nextEntry = normalizeHabit(entry)

    if(!nextEntry){
      return null
    }

    items.push(nextEntry)
    storage.saveHabits(items)
    return nextEntry
  },
  updateHabit(id, nextEntry){
    return storage.saveHabits(
      storage.getHabits().map((entry) => {
        if(entry.id !== id){
          return entry
        }

        return {
          ...entry,
          ...nextEntry,
          id: entry.id
        }
      })
    )
  },
  toggleHabitCompletion(id, dateKey = today()){
    return storage.saveHabits(
      storage.getHabits().map((entry) => {
        if(entry.id !== id){
          return entry
        }

        const completions = new Set(entry.completions || [])

        if(completions.has(dateKey)){
          completions.delete(dateKey)
        }else{
          completions.add(dateKey)
        }

        return {
          ...entry,
          completions: [...completions].sort()
        }
      })
    )
  },
  removeHabit(id){
    return storage.saveHabits(
      storage.getHabits().filter((entry) => entry.id !== id)
    )
  },
  getNotes(){
    return getNormalized("notes", [], (value) => normalizeList(value, normalizeNote))
  },
  saveNotes(items){
    return write("notes", normalizeList(items, normalizeNote))
  },
  addNote(entry){
    const items = storage.getNotes()
    const nextEntry = normalizeNote(entry)

    if(!nextEntry){
      return null
    }

    items.push(nextEntry)
    storage.saveNotes(items)
    return nextEntry
  },
  updateNote(id, nextEntry){
    return storage.saveNotes(
      storage.getNotes().map((entry) => {
        if(entry.id !== id){
          return entry
        }

        return {
          ...entry,
          ...nextEntry,
          id: entry.id
        }
      })
    )
  },
  removeNote(id){
    return storage.saveNotes(
      storage.getNotes().filter((entry) => entry.id !== id)
    )
  },
  getTasks(){
    return getNormalized("tasks", [], (value) => normalizeList(value, normalizeTask))
  },
  saveTasks(items){
    return write("tasks", normalizeList(items, normalizeTask))
  },
  addTask(entry){
    const items = storage.getTasks()
    const nextEntry = normalizeTask(entry)

    if(!nextEntry){
      return null
    }

    items.push(nextEntry)
    storage.saveTasks(items)
    return nextEntry
  },
  updateTask(id, nextEntry){
    return storage.saveTasks(
      storage.getTasks().map((entry) => {
        if(entry.id !== id){
          return entry
        }

        return {
          ...entry,
          ...nextEntry,
          id: entry.id
        }
      })
    )
  },
  toggleTaskCompletion(id){
    return storage.saveTasks(
      storage.getTasks().map((entry) => {
        if(entry.id !== id){
          return entry
        }

        return {
          ...entry,
          done: !entry.done
        }
      })
    )
  },
  removeTask(id){
    return storage.saveTasks(
      storage.getTasks().filter((entry) => entry.id !== id)
    )
  },
  getJournal(){
    return getNormalized("journal", [], (value) => normalizeList(value, normalizeJournal))
  },
  saveJournal(items){
    return write("journal", normalizeList(items, normalizeJournal))
  },
  addJournal(entry){
    const items = storage.getJournal()
    const nextEntry = normalizeJournal(entry)

    if(!nextEntry){
      return null
    }

    items.push(nextEntry)
    storage.saveJournal(items)
    return nextEntry
  },
  updateJournal(id, nextEntry){
    return storage.saveJournal(
      storage.getJournal().map((entry) => {
        if(entry.id !== id){
          return entry
        }

        return {
          ...entry,
          ...nextEntry,
          id: entry.id
        }
      })
    )
  },
  removeJournal(id){
    return storage.saveJournal(
      storage.getJournal().filter((entry) => entry.id !== id)
    )
  },
  getSubscriptions(){
    return getNormalized("subscriptions", [], (value) => normalizeList(value, normalizeSubscription))
  },
  saveSubscriptions(items){
    return write("subscriptions", normalizeList(items, normalizeSubscription))
  },
  addSubscription(entry){
    const items = storage.getSubscriptions()
    const nextEntry = normalizeSubscription(entry)

    if(!nextEntry){
      return null
    }

    items.push(nextEntry)
    storage.saveSubscriptions(items)
    return nextEntry
  },
  updateSubscription(id, nextEntry){
    return storage.saveSubscriptions(
      storage.getSubscriptions().map((entry) => {
        if(entry.id !== id){
          return entry
        }

        return {
          ...entry,
          ...nextEntry,
          id: entry.id
        }
      })
    )
  },
  removeSubscription(id){
    return storage.saveSubscriptions(
      storage.getSubscriptions().filter((entry) => entry.id !== id)
    )
  },
  getBudgetSettings(){
    return getNormalized("settings", {}, normalizeSettings)
  },
  saveBudgetSettings(nextSettings){
    const merged = normalizeSettings({
      ...storage.getBudgetSettings(),
      ...(nextSettings || {})
    })

    return write("settings", merged)
  },
  getReminderSettings(){
    return storage.getBudgetSettings().reminders
  },
  saveReminderSettings(nextReminderSettings){
    return storage.saveBudgetSettings({
      reminders: {
        ...storage.getReminderSettings(),
        ...(nextReminderSettings || {}),
        habits: {
          ...storage.getReminderSettings().habits,
          ...(nextReminderSettings?.habits || {})
        },
        subscriptions: {
          ...storage.getReminderSettings().subscriptions,
          ...(nextReminderSettings?.subscriptions || {})
        },
        sentLog: {
          ...storage.getReminderSettings().sentLog,
          ...(nextReminderSettings?.sentLog || {})
        }
      }
    })
  },
  getExpenseCategoriesList(){
    return storage.getBudgetSettings().expenseCategories
  },
  getExpenseCategoryMemory(){
    return storage.getBudgetSettings().categoryMemory
  },
  rememberExpenseCategory(name, category){
    const normalizedName = normalizeText(name, TEXT_LIMITS.short).toLowerCase()
    const normalizedCategory = normalizeCategoryName(category)

    if(!normalizedName || !normalizedCategory){
      return storage.getBudgetSettings()
    }

    return storage.saveBudgetSettings({
      categoryMemory: {
        ...storage.getExpenseCategoryMemory(),
        [normalizedName]: normalizedCategory
      }
    })
  },
  removeExpenseCategoryMemory(name){
    const normalizedName = normalizeText(name, TEXT_LIMITS.short).toLowerCase()
    const nextMemory = {...storage.getExpenseCategoryMemory()}

    delete nextMemory[normalizedName]

    return storage.saveBudgetSettings({
      categoryMemory: nextMemory
    })
  },
  clearExpenseCategoryMemory(){
    return storage.saveBudgetSettings({
      categoryMemory: {}
    })
  },
  addExpenseCategory(name){
    const category = normalizeCategoryName(name)

    if(!category){
      return storage.getBudgetSettings()
    }

    return storage.saveBudgetSettings({
      expenseCategories: [
        ...storage.getExpenseCategoriesList(),
        category
      ]
    })
  },
  exportBackup(){
    return {
      expenses: storage.getExpenses(),
      borrow: storage.getBorrow(),
      grocery: storage.getGrocery(),
      habits: storage.getHabits(),
      notes: storage.getNotes(),
      tasks: storage.getTasks(),
      journal: storage.getJournal(),
      subscriptions: storage.getSubscriptions(),
      settings: storage.getBudgetSettings()
    }
  },
  importBackup(data){
    if(!data || typeof data !== "object"){
      throw new Error("Invalid backup file.")
    }

    storage.saveExpenses(data.expenses || [])
    storage.saveBorrow(data.borrow || [])
    storage.saveGrocery(data.grocery || [])
    storage.saveHabits(data.habits || [])
    storage.saveNotes(data.notes || [])
    storage.saveTasks(data.tasks || [])
    storage.saveJournal(data.journal || [])
    storage.saveSubscriptions(data.subscriptions || [])
    storage.saveBudgetSettings(data.settings || {})

    storage.getExpenses().forEach((entry) => {
      storage.rememberExpenseCategory(entry.name, entry.category)
    })
  },
  getErrorLogs(){
    return getNormalized("errorLogs", [], (value) => normalizeList(value, normalizeErrorLog)).slice(-ERROR_LOG_LIMIT)
  },
  saveErrorLogs(items){
    return write("errorLogs", normalizeList(items, normalizeErrorLog).slice(-ERROR_LOG_LIMIT))
  },
  addErrorLog(entry){
    const items = storage.getErrorLogs()
    const nextEntry = normalizeErrorLog(entry)

    if(!nextEntry){
      return null
    }

    items.push(nextEntry)
    storage.saveErrorLogs(items)
    return nextEntry
  },
  clearErrorLogs(){
    return storage.saveErrorLogs([])
  },
  resetWorkspaceData(){
    ;[
      "expenses",
      "borrow",
      "grocery",
      "habits",
      "notes",
      "tasks",
      "journal",
      "subscriptions",
      "settings",
      "errorLogs",
      STORAGE_VERSION_KEY
    ].forEach((key) => {
      localStorage.removeItem(resolveRawKey(key))
    })

    ensureStorageVersion()
    storage.validateAllData()
    window.PlifeOSEvents?.emit?.("storage:changed", {key: "workspace-reset"})
    return true
  },
  validateAllData(){
    storage.getExpenses()
    storage.getBorrow()
    storage.getGrocery()
    storage.getHabits()
    storage.getNotes()
    storage.getTasks()
    storage.getJournal()
    storage.getSubscriptions()
    storage.getBudgetSettings()
    storage.getErrorLogs()
    return true
  },
  transferUserData
}

function migrateToVersion2(){
  const settings = normalizeSettings(read("settings", {}))
  const categoryMemory = {...settings.categoryMemory}

  storage.getExpenses().forEach((entry) => {
    const normalizedName = normalizeText(entry.name, TEXT_LIMITS.short).toLowerCase()
    const normalizedCategory = normalizeCategoryName(entry.category)

    if(normalizedName && normalizedCategory && !categoryMemory[normalizedName]){
      categoryMemory[normalizedName] = normalizedCategory
    }
  })

  write("settings", normalizeSettings({
    ...settings,
    categoryMemory
  }))
}

function ensureStorageVersion(){
  let version = readStorageVersion()

  while(version < STORAGE_VERSION){
    if(version === 1){
      migrateToVersion2()
      version = 2
      writeStorageVersion(version)
      continue
    }

    version += 1
    writeStorageVersion(version)
  }

  if(version !== STORAGE_VERSION){
    writeStorageVersion(STORAGE_VERSION)
  }

  return STORAGE_VERSION
}

ensureStorageVersion()
storage.validateAllData()

window.PlifeOSStorage = storage
})()
