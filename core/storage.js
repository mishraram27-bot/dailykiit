;(function(){
const DEFAULT_EXPENSE_CATEGORIES = ["Transport", "Food", "Grocery", "Other"]

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
  return String(value || "").trim().replace(/\s+/g, " ")
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

function inferExpenseCategory(name){
  const value = String(name || "").toLowerCase()

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

  const name = String(entry.name || "").trim()
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

  const person = String(entry.person || "").trim()
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
    const name = entry.trim()

    if(!name){
      return null
    }

    return {
      id: createId("grocery"),
      name,
      done: false
    }
  }

  if(!entry || typeof entry !== "object"){
    return null
  }

  const name = String(entry.name || "").trim()

  if(!name){
    return null
  }

  return {
    id: entry.id || createId("grocery"),
    name,
    done: Boolean(entry.done)
  }
}

function normalizeSettings(value){
  const source = value && typeof value === "object" ? value : {}
  const monthlyBudget = Number(source.monthlyBudget)

  return {
    monthlyBudget: Number.isFinite(monthlyBudget) && monthlyBudget > 0 ? monthlyBudget : null,
    expenseCategories: normalizeCategoryList(source.expenseCategories)
  }
}

function normalizeList(value, normalizer){
  if(!Array.isArray(value)){
    return []
  }

  return value.map(normalizer).filter(Boolean)
}

function getScopedKey(key, userId){
  return `dailykit:${userId}:${key}`
}

function resolveKey(key){
  const userId = window.DailyKitAuth?.getStorageNamespace?.()

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

function read(key, fallback){
  return safeParse(localStorage.getItem(resolveKey(key)), fallback)
}

function write(key, value){
  localStorage.setItem(resolveKey(key), JSON.stringify(value))
  return value
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

  ;["expenses", "borrow", "grocery", "settings"].forEach((key) => {
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
    return nextEntry
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
  removeGrocery(id){
    return storage.saveGrocery(
      storage.getGrocery().filter((entry) => entry.id !== id)
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
  getExpenseCategoriesList(){
    return storage.getBudgetSettings().expenseCategories
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
    storage.saveBudgetSettings(data.settings || {})
  },
  transferUserData
}

window.DailyKitStorage = storage
})()
