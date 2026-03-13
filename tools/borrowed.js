function renderTool(){
  const area = document.getElementById("toolContainer")

  area.innerHTML = `
<h2>Borrowed Money</h2>
<input id="person" placeholder="Person">
<input id="amount" placeholder="Amount">
<button onclick="addBorrow()">Add</button>
<div id="borrowList"></div>
`

  loadBorrow()
}

function addBorrow(){
  const personInput = document.getElementById("person")
  const amountInput = document.getElementById("amount")
  const person = personInput.value.trim()
  const amount = Number(amountInput.value)

  if(!person){
    alert("Enter person name")
    return
  }

  if(!Number.isFinite(amount) || amount <= 0){
    alert("Invalid amount")
    return
  }

  DailyKitStorage.addBorrow({person, amount})
  personInput.value = ""
  amountInput.value = ""

  loadBorrow()

  if(typeof refreshDashboard === "function"){
    refreshDashboard()
  }
}

function loadBorrow(){
  const data = DailyKitStorage.getBorrow()
  const list = document.getElementById("borrowList")

  if(!list){
    return
  }

  list.innerHTML = ""

  data.forEach((entry) => {
    list.innerHTML += `
<div class="list-item">
${entry.person} owes \u20B9${entry.amount}
<button onclick='deleteBorrow(${JSON.stringify(entry.id)})'>Delete</button>
</div>
`
  })
}

function deleteBorrow(id){
  DailyKitStorage.removeBorrow(id)
  loadBorrow()

  if(typeof refreshDashboard === "function"){
    refreshDashboard()
  }
}
