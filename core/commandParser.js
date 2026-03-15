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
    PlifeOSStorage.addExpense({
      name: command.name,
      amount: command.amount,
      category: PlifeOSStorage.inferExpenseCategory(command.name)
    })
    PlifeOSRouter.openTool("expenses")
    PlifeOSDashboard.refreshDashboard()
    PlifeOSFeedback.success(tr("messages.commandExpenseSaved", "Expense saved: {value}", {value: command.name}))
    return true
  }

  if(command.type === "borrow"){
    PlifeOSStorage.addBorrow({
      person: command.person,
      amount: command.amount
    })
    PlifeOSRouter.openTool("borrowed")
    PlifeOSDashboard.refreshDashboard()
    PlifeOSFeedback.success(tr("messages.commandBorrowSaved", "Borrowed entry saved for {value}", {value: command.person}))
    return true
  }

  if(command.type === "grocery"){
    PlifeOSStorage.addGrocery({
      name: command.name
    })
    PlifeOSRouter.openTool("grocery")
    PlifeOSDashboard.refreshDashboard()
    PlifeOSFeedback.success(tr("messages.commandGrocerySaved", "Grocery item added: {value}", {value: command.name}))
    return true
  }

  if(command.type === "habit"){
    PlifeOSStorage.addHabit({
      name: command.name,
      completions: []
    })
    PlifeOSRouter.openTool("habits")
    PlifeOSFeedback.success(tr("messages.commandHabitSaved", "Habit added: {value}", {value: command.name}))
    return true
  }

  if(command.type === "note"){
    PlifeOSStorage.addNote({
      title: command.text.slice(0, 48),
      body: command.text
    })
    PlifeOSRouter.openTool("notes")
    PlifeOSFeedback.success(tr("messages.quickNoteSaved", "Quick note saved."))
    return true
  }

  if(command.type === "subscription"){
    PlifeOSStorage.addSubscription({
      name: command.name,
      amount: command.amount,
      billingDay: new Date().getDate()
    })
    PlifeOSRouter.openTool("subscriptions")
    PlifeOSFeedback.success(tr("messages.commandSubscriptionSaved", "Subscription added: {value}", {value: command.name}))
    return true
  }

  if(command.type === "task"){
    PlifeOSStorage.addTask({
      title: command.titleText,
      priority: "medium",
      done: false
    })
    PlifeOSRouter.openTool("tasks")
    PlifeOSDashboard.refreshDashboard()
    PlifeOSFeedback.success(tr("messages.commandTaskSaved", "Task added: {value}", {value: command.titleText}))
    return true
  }

  if(command.type === "journal"){
    PlifeOSStorage.addJournal({
      title: command.text.slice(0, 48),
      body: command.text,
      mood: tr("journal.defaultMood", "Neutral")
    })
    PlifeOSRouter.openTool("journal")
    PlifeOSDashboard.refreshDashboard()
    PlifeOSFeedback.success(tr("messages.commandJournalSaved", "Journal entry saved."))
    return true
  }

  return false
}

window.PlifeOSCommands = {
  parse,
  execute
}
})()
