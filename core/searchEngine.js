;(function(){
function formatCurrency(amount){
  return `\u20B9${amount}`
}

function buildResults(query, tools){
  const value = String(query || "").trim().toLowerCase()

  if(!value){
    return []
  }

  const results = []

  DailyKitStorage.getExpenses().forEach((expense) => {
    if(expense.name.toLowerCase().includes(value)){
      results.push({
        type: "expense",
        toolId: "expenses",
        title: expense.name,
        subtitle: `Expense: ${expense.name} ${formatCurrency(expense.amount)}`
      })
    }
  })

  DailyKitStorage.getGrocery().forEach((item) => {
    if(item.name.toLowerCase().includes(value)){
      results.push({
        type: "grocery",
        toolId: "grocery",
        title: item.name,
        subtitle: `Grocery: ${item.name}`
      })
    }
  })

  DailyKitStorage.getBorrow().forEach((entry) => {
    if(entry.person.toLowerCase().includes(value)){
      results.push({
        type: "borrow",
        toolId: "borrowed",
        title: entry.person,
        subtitle: `Borrow: ${entry.person} ${formatCurrency(entry.amount)}`
      })
    }
  })

  tools.forEach((tool) => {
    const label = `${tool.name} ${tool.id}`.toLowerCase()

    if(label.includes(value)){
      results.push({
        type: "tool",
        toolId: tool.id,
        title: tool.name,
        subtitle: `Open tool: ${tool.name}`
      })
    }
  })

  return results.slice(0, 8)
}

window.DailyKitSearch = {
  buildResults
}
})()
