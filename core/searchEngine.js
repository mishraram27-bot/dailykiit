;(function(){
function tr(key, fallback, replacements){
  if(!window.t){
    return fallback
  }

  return window.t(key, fallback, replacements)
}

let cachedFingerprint = ""
let cachedIndex = []

function formatCurrency(amount){
  return `\u20B9${amount}`
}

function createFingerprint(tools){
  const expenses = LifeOSStorage.getExpenses()
  const borrow = LifeOSStorage.getBorrow()
  const grocery = LifeOSStorage.getGrocery()
  const habits = LifeOSStorage.getHabits()
  const notes = LifeOSStorage.getNotes()
  const tasks = LifeOSStorage.getTasks()
  const journal = LifeOSStorage.getJournal()
  const subscriptions = LifeOSStorage.getSubscriptions()

  return JSON.stringify({
    expenses: expenses.map((entry) => [entry.id, entry.name, entry.amount, entry.date, entry.category]),
    borrow: borrow.map((entry) => [entry.id, entry.person, entry.amount, entry.date]),
    grocery: grocery.map((entry) => [entry.id, entry.name, entry.date]),
    habits: habits.map((entry) => [entry.id, entry.name, entry.completions]),
    notes: notes.map((entry) => [entry.id, entry.title, entry.body, entry.date]),
    tasks: tasks.map((entry) => [entry.id, entry.title, entry.priority, entry.done, entry.date]),
    journal: journal.map((entry) => [entry.id, entry.title, entry.mood, entry.body, entry.date]),
    subscriptions: subscriptions.map((entry) => [entry.id, entry.name, entry.amount, entry.billingDay]),
    tools: tools.map((tool) => [tool.id, tool.name, tool.category, tool.version, tool.commands, tool.description])
  })
}

function getCommandToolId(command){
  const map = {
    expense: "expenses",
    borrow: "borrowed",
    grocery: "grocery",
    habit: "habits",
    note: "notes",
    task: "tasks",
    journal: "journal",
    subscription: "subscriptions"
  }

  return map[command.type] || "expenses"
}

function buildIndex(tools){
  const fingerprint = createFingerprint(tools)

  if(fingerprint === cachedFingerprint){
    return cachedIndex
  }

  const items = []

  LifeOSStorage.getExpenses().forEach((expense) => {
    items.push({
      type: "expense",
      toolId: "expenses",
      title: expense.name,
      subtitle: tr("search.expenseResult", "Expense: {name} {amount}", {
        name: expense.name,
        amount: formatCurrency(expense.amount)
      }),
      keywords: `${expense.name} ${expense.category} ${expense.date}`.toLowerCase()
    })
  })

  LifeOSStorage.getGrocery().forEach((item) => {
    items.push({
      type: "grocery",
      toolId: "grocery",
      title: item.name,
      subtitle: tr("search.groceryResult", "Grocery: {name}", {name: item.name}),
      keywords: `${item.name} ${item.date || ""}`.toLowerCase()
    })
  })

  LifeOSStorage.getBorrow().forEach((entry) => {
    items.push({
      type: "borrow",
      toolId: "borrowed",
      title: entry.person,
      subtitle: tr("search.borrowResult", "Borrow: {name} {amount}", {
        name: entry.person,
        amount: formatCurrency(entry.amount)
      }),
      keywords: `${entry.person} ${entry.amount} ${entry.date}`.toLowerCase()
    })
  })

  LifeOSStorage.getHabits().forEach((entry) => {
    items.push({
      type: "habit",
      toolId: "habits",
      title: entry.name,
      subtitle: tr("search.habitResult", "Habit: {name}", {name: entry.name}),
      keywords: `${entry.name} ${(entry.completions || []).join(" ")}`.toLowerCase()
    })
  })

  LifeOSStorage.getNotes().forEach((entry) => {
    items.push({
      type: "note",
      toolId: "notes",
      title: entry.title,
      subtitle: tr("search.noteResult", "Note: {name}", {name: entry.title}),
      keywords: `${entry.title} ${entry.body} ${entry.date}`.toLowerCase()
    })
  })

  LifeOSStorage.getTasks().forEach((entry) => {
    items.push({
      type: "task",
      toolId: "tasks",
      title: entry.title,
      subtitle: tr("search.taskResult", "Task: {name}", {name: entry.title}),
      keywords: `${entry.title} ${entry.priority} ${entry.date} ${entry.done ? "done" : "pending"}`.toLowerCase()
    })
  })

  LifeOSStorage.getJournal().forEach((entry) => {
    items.push({
      type: "journal",
      toolId: "journal",
      title: entry.title,
      subtitle: tr("search.journalResult", "Journal: {name}", {name: entry.title}),
      keywords: `${entry.title} ${entry.mood} ${entry.body} ${entry.date}`.toLowerCase()
    })
  })

  LifeOSStorage.getSubscriptions().forEach((entry) => {
    items.push({
      type: "subscription",
      toolId: "subscriptions",
      title: entry.name,
      subtitle: tr("search.subscriptionResult", "Subscription: {name} {amount}", {
        name: entry.name,
        amount: formatCurrency(entry.amount)
      }),
      keywords: `${entry.name} ${entry.amount} ${entry.billingDay}`.toLowerCase()
    })
  })

  tools.filter((tool) => tool.searchable !== false).forEach((tool) => {
    items.push({
      type: "tool",
      toolId: tool.id,
      title: tr(`tool.${tool.id}`, tool.name),
      subtitle: tr("search.openTool", "Open tool: {name}", {name: tr(`tool.${tool.id}`, tool.name)}),
      keywords: `${tool.name} ${tool.id} ${tool.category || ""} ${(tool.commands || []).join(" ")} ${tool.description || ""}`.toLowerCase()
    })
  })

  cachedFingerprint = fingerprint
  cachedIndex = items
  return cachedIndex
}

function buildResults(query, tools){
  const rawValue = String(query || "").trim()
  const value = rawValue.toLowerCase()

  if(!value){
    return []
  }

  const results = []
  const command = window.LifeOSCommands?.parse(rawValue)

  if(command){
    results.push({
      type: "command",
      toolId: getCommandToolId(command),
      title: command.title,
      subtitle: command.subtitle,
      action: () => window.LifeOSCommands.execute(command)
    })
  }

  const indexedResults = buildIndex(tools)
    .filter((entry) => entry.keywords.includes(value))
    .slice(0, 7)

  return results.concat(indexedResults).slice(0, 8)
}

window.LifeOSSearch = {
  buildResults,
  buildIndex
}
})()
