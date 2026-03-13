;(function(){
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
      title: `Add borrowed entry for ${match[1].trim()}`,
      subtitle: `Command: save ${match[1].trim()} owing \u20B9${match[2]}`
    }
  }

  match = /^(?:grocery|buy|add grocery)\s+(.+)$/i.exec(value)

  if(match){
    return {
      type: "grocery",
      name: match[1].trim(),
      title: `Add grocery item ${match[1].trim()}`,
      subtitle: `Command: add ${match[1].trim()} to Grocery`
    }
  }

  match = /^habit\s+(.+)$/i.exec(value)

  if(match){
    return {
      type: "habit",
      name: match[1].trim(),
      title: `Add habit ${match[1].trim()}`,
      subtitle: `Command: create habit ${match[1].trim()}`
    }
  }

  match = /^note\s+(.+)$/i.exec(value)

  if(match){
    return {
      type: "note",
      text: match[1].trim(),
      title: `Create note ${match[1].trim()}`,
      subtitle: `Command: save quick note`
    }
  }

  match = /^(?:subscription|sub)\s+(.+)\s+(\d+(?:\.\d+)?)$/i.exec(value)

  if(match){
    return {
      type: "subscription",
      name: match[1].trim(),
      amount: Number(match[2]),
      title: `Add subscription ${match[1].trim()}`,
      subtitle: `Command: save ${match[1].trim()} for \u20B9${match[2]}`
    }
  }

  match = /^(.+)\s+(\d+(?:\.\d+)?)$/i.exec(value)

  if(match){
    return {
      type: "expense",
      name: match[1].trim(),
      amount: Number(match[2]),
      title: `Add expense ${match[1].trim()}`,
      subtitle: `Command: save ${match[1].trim()} for \u20B9${match[2]}`
    }
  }

  return null
}

function execute(command){
  if(!command){
    return false
  }

  if(command.type === "expense"){
    DailyKitStorage.addExpense({
      name: command.name,
      amount: command.amount,
      category: DailyKitStorage.inferExpenseCategory(command.name)
    })
    DailyKitRouter.openTool("expenses")
    DailyKitDashboard.refreshDashboard()
    DailyKitFeedback.success(`Expense saved: ${command.name}`)
    return true
  }

  if(command.type === "borrow"){
    DailyKitStorage.addBorrow({
      person: command.person,
      amount: command.amount
    })
    DailyKitRouter.openTool("borrowed")
    DailyKitDashboard.refreshDashboard()
    DailyKitFeedback.success(`Borrowed entry saved for ${command.person}`)
    return true
  }

  if(command.type === "grocery"){
    DailyKitStorage.addGrocery({
      name: command.name
    })
    DailyKitRouter.openTool("grocery")
    DailyKitDashboard.refreshDashboard()
    DailyKitFeedback.success(`Grocery item added: ${command.name}`)
    return true
  }

  if(command.type === "habit"){
    DailyKitStorage.addHabit({
      name: command.name,
      completions: []
    })
    DailyKitRouter.openTool("habits")
    DailyKitFeedback.success(`Habit added: ${command.name}`)
    return true
  }

  if(command.type === "note"){
    DailyKitStorage.addNote({
      title: command.text.slice(0, 48),
      body: command.text
    })
    DailyKitRouter.openTool("notes")
    DailyKitFeedback.success("Quick note saved.")
    return true
  }

  if(command.type === "subscription"){
    DailyKitStorage.addSubscription({
      name: command.name,
      amount: command.amount,
      billingDay: new Date().getDate()
    })
    DailyKitRouter.openTool("subscriptions")
    DailyKitFeedback.success(`Subscription added: ${command.name}`)
    return true
  }

  return false
}

window.DailyKitCommands = {
  parse,
  execute
}
})()
