;(function(){
function tr(key, fallback, replacements){
  if(!window.t){
    return fallback
  }

  return window.t(key, fallback, replacements)
}

function parse(query){
  const value = String(query || "").trim()

  if(!value){
    return null
  }

  let match = /^borrow\s+(.+)\s+(\d+(?:\.\d+)?)$/i.exec(value)

  if(match){
    return {
      type: "borrow",
      person: match[1].trim(),
      amount: Number(match[2]),
      title: tr("commands.borrowTitle", "Add borrowed entry for {value}", {value: match[1].trim()}),
      subtitle: tr("commands.borrowSubtitle", "Command: save {value} owing \u20B9{amount}", {
        value: match[1].trim(),
        amount: match[2]
      })
    }
  }

  match = /^(?:grocery|buy|add grocery)\s+(.+)$/i.exec(value)

  if(match){
    return {
      type: "grocery",
      name: match[1].trim(),
      title: tr("commands.groceryTitle", "Add grocery item {value}", {value: match[1].trim()}),
      subtitle: tr("commands.grocerySubtitle", "Command: add {value} to Grocery", {value: match[1].trim()})
    }
  }

  match = /^habit\s+(.+)$/i.exec(value)

  if(match){
    return {
      type: "habit",
      name: match[1].trim(),
      title: tr("commands.habitTitle", "Add habit {value}", {value: match[1].trim()}),
      subtitle: tr("commands.habitSubtitle", "Command: create habit {value}", {value: match[1].trim()})
    }
  }

  match = /^note\s+(.+)$/i.exec(value)

  if(match){
    return {
      type: "note",
      text: match[1].trim(),
      title: tr("commands.noteTitle", "Create note {value}", {value: match[1].trim()}),
      subtitle: tr("commands.noteSubtitle", "Command: save quick note")
    }
  }

  match = /^(?:task|todo)\s+(.+)$/i.exec(value)

  if(match){
    return {
      type: "task",
      titleText: match[1].trim(),
      title: tr("commands.taskTitle", "Add task {value}", {value: match[1].trim()}),
      subtitle: tr("commands.taskSubtitle", "Command: save task for today")
    }
  }

  match = /^journal\s+(.+)$/i.exec(value)

  if(match){
    return {
      type: "journal",
      text: match[1].trim(),
      title: tr("commands.journalTitle", "Create journal entry"),
      subtitle: tr("commands.journalSubtitle", "Command: save today's reflection")
    }
  }

  match = /^(?:subscription|sub)\s+(.+)\s+(\d+(?:\.\d+)?)$/i.exec(value)

  if(match){
    return {
      type: "subscription",
      name: match[1].trim(),
      amount: Number(match[2]),
      title: tr("commands.subscriptionTitle", "Add subscription {value}", {value: match[1].trim()}),
      subtitle: tr("commands.subscriptionSubtitle", "Command: save {value} for \u20B9{amount}", {
        value: match[1].trim(),
        amount: match[2]
      })
    }
  }

  match = /^(.+)\s+(\d+(?:\.\d+)?)$/i.exec(value)

  if(match){
    return {
      type: "expense",
      name: match[1].trim(),
      amount: Number(match[2]),
      title: tr("commands.expenseTitle", "Add expense {value}", {value: match[1].trim()}),
      subtitle: tr("commands.expenseSubtitle", "Command: save {value} for \u20B9{amount}", {
        value: match[1].trim(),
        amount: match[2]
      })
    }
  }

  return null
}

function execute(command){
  if(!command){
    return false
  }

  if(command.type === "expense"){
    LifeOSStorage.addExpense({
      name: command.name,
      amount: command.amount,
      category: LifeOSStorage.inferExpenseCategory(command.name)
    })
    LifeOSRouter.openTool("expenses")
    LifeOSDashboard.refreshDashboard()
    LifeOSFeedback.success(tr("messages.commandExpenseSaved", "Expense saved: {value}", {value: command.name}))
    return true
  }

  if(command.type === "borrow"){
    LifeOSStorage.addBorrow({
      person: command.person,
      amount: command.amount
    })
    LifeOSRouter.openTool("borrowed")
    LifeOSDashboard.refreshDashboard()
    LifeOSFeedback.success(tr("messages.commandBorrowSaved", "Borrowed entry saved for {value}", {value: command.person}))
    return true
  }

  if(command.type === "grocery"){
    LifeOSStorage.addGrocery({
      name: command.name
    })
    LifeOSRouter.openTool("grocery")
    LifeOSDashboard.refreshDashboard()
    LifeOSFeedback.success(tr("messages.commandGrocerySaved", "Grocery item added: {value}", {value: command.name}))
    return true
  }

  if(command.type === "habit"){
    LifeOSStorage.addHabit({
      name: command.name,
      completions: []
    })
    LifeOSRouter.openTool("habits")
    LifeOSFeedback.success(tr("messages.commandHabitSaved", "Habit added: {value}", {value: command.name}))
    return true
  }

  if(command.type === "note"){
    LifeOSStorage.addNote({
      title: command.text.slice(0, 48),
      body: command.text
    })
    LifeOSRouter.openTool("notes")
    LifeOSFeedback.success(tr("messages.quickNoteSaved", "Quick note saved."))
    return true
  }

  if(command.type === "subscription"){
    LifeOSStorage.addSubscription({
      name: command.name,
      amount: command.amount,
      billingDay: new Date().getDate()
    })
    LifeOSRouter.openTool("subscriptions")
    LifeOSFeedback.success(tr("messages.commandSubscriptionSaved", "Subscription added: {value}", {value: command.name}))
    return true
  }

  if(command.type === "task"){
    LifeOSStorage.addTask({
      title: command.titleText,
      priority: "medium",
      done: false
    })
    LifeOSRouter.openTool("tasks")
    LifeOSDashboard.refreshDashboard()
    LifeOSFeedback.success(tr("messages.commandTaskSaved", "Task added: {value}", {value: command.titleText}))
    return true
  }

  if(command.type === "journal"){
    LifeOSStorage.addJournal({
      title: command.text.slice(0, 48),
      body: command.text,
      mood: tr("journal.defaultMood", "Neutral")
    })
    LifeOSRouter.openTool("journal")
    LifeOSDashboard.refreshDashboard()
    LifeOSFeedback.success(tr("messages.commandJournalSaved", "Journal entry saved."))
    return true
  }

  return false
}

window.LifeOSCommands = {
  parse,
  execute
}
})()
