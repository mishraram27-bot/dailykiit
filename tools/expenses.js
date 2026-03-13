function renderTool(){
  const area = document.getElementById("toolContainer")

  area.innerHTML = `
<h2>Expenses</h2>
<input id="expenseInput" placeholder="item amount">
<button onclick="addExpense()">Add</button>
<div id="expenseList"></div>
`

  loadExpenses()
}

function addExpense(){
  const inputElement = document.getElementById("expenseInput")

  if(!inputElement){
    return
  }

  const input = inputElement.value.trim()

  if(!input){
    alert("Enter expense")
    return
  }

  const parts = input.split(/\s+/)
  const amount = Number(parts.pop())
  const name = parts.join(" ").trim()

  if(!name){
    alert("Enter item name")
    return
  }

  if(!Number.isFinite(amount) || amount <= 0){
    alert("Invalid amount")
    return
  }

  DailyKitStorage.addExpense({name, amount})
  inputElement.value = ""

  loadExpenses()

  if(typeof refreshDashboard === "function"){
    refreshDashboard()
  }
}

function loadExpenses(){
  const data = DailyKitStorage.getExpenses()
  const list = document.getElementById("expenseList")

  if(!list){
    return
  }

  list.innerHTML = ""

  const today = new Date().toISOString().slice(0, 10)
  const todayExpenses = data.filter((entry) => entry.date === today)

  todayExpenses.forEach((entry) => {
    list.innerHTML += `
<div class="list-item">
${entry.name} \u20B9${entry.amount}
<button onclick='deleteExpense(${JSON.stringify(entry.id)})'>Delete</button>
</div>
`
  })
}

function deleteExpense(id){
  DailyKitStorage.removeExpense(id)
  loadExpenses()

  if(typeof refreshDashboard === "function"){
    refreshDashboard()
  }
}
