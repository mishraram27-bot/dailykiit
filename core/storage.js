;(function(){
function today(){
  return new Date().toISOString().slice(0, 10)
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

function inferExpenseCategory(name){
  const value = String(name || "").toLowerCase()

  const transport = ["bus","train","flight","taxi","uber","auto","metro","petrol"]
  const food = ["tea","coffee","lunch","dinner","breakfast","snack","food"]
  const grocery = ["milk","bread","vegetable","fruit","rice","grocery"]

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

  return {
    id: entry.id || createId("expense"),
    name,
    amount,
    date: entry.date || today(),
    category: entry.category || inferExpenseCategory(name)
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
    date: entry.date || today()
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

function normalizeList(value, normalizer){
  if(!Array.isArray(value)){
    return []
  }

  return value.map(normalizer).filter(Boolean)
}

function read(key){
  return safeParse(localStorage.getItem(key), [])
}

function write(key, value){
  localStorage.setItem(key, JSON.stringify(value))
  return value
}

function getNormalized(key, normalizer){
  const raw = read(key)
  const normalized = normalizeList(raw, normalizer)

  if(JSON.stringify(raw) !== JSON.stringify(normalized)){
    write(key, normalized)
  }

  return normalized
}

const storage = {
  inferExpenseCategory,
  getExpenses(){
    return getNormalized("expenses", normalizeExpense)
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
    return nextEntry
  },
  removeExpense(id){
    return storage.saveExpenses(
      storage.getExpenses().filter((entry) => entry.id !== id)
    )
  },
  getBorrow(){
    return getNormalized("borrow", normalizeBorrow)
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
    return getNormalized("grocery", normalizeGrocery)
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
  exportBackup(){
    return {
      expenses: storage.getExpenses(),
      borrow: storage.getBorrow(),
      grocery: storage.getGrocery()
    }
  },
  importBackup(data){
    if(!data || typeof data !== "object"){
      throw new Error("Invalid backup file.")
    }

    storage.saveExpenses(data.expenses || [])
    storage.saveBorrow(data.borrow || [])
    storage.saveGrocery(data.grocery || [])
  }
}

window.DailyKitStorage = storage
})()
