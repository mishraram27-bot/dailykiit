function renderTool(){
  const area = document.getElementById("toolContainer")

  area.innerHTML = `
<div class="tool-shell">
<div class="tool-heading">
<p class="section-kicker">Money</p>
<h2>Expenses</h2>
<p>Capture a spend in one line. Try entries like <strong>coffee 50</strong>.</p>
</div>
<div class="tool-form">
<input id="expenseInput" placeholder="item amount">
<button onclick="addExpense()">Add Expense</button>
</div>
<div id="expenseList" class="list-group"></div>
</div>
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

  if(!todayExpenses.length){
    list.innerHTML = "<div class='list-empty'>No expenses added for today yet.</div>"
    return
  }

  todayExpenses.forEach((entry) => {
    list.innerHTML += `
<div class="list-item">
<div class="list-copy">
<strong>${entry.name}</strong>
<span>Added today</span>
</div>
<div class="list-actions">
<span class="list-amount">\u20B9${entry.amount}</span>
<button onclick='deleteExpense(${JSON.stringify(entry.id)})'>Delete</button>
</div>
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
