function renderTool(){
  const area = document.getElementById("toolContainer")

  area.innerHTML = `
<div class="tool-shell">
<div class="tool-heading">
<p class="section-kicker">Shared money</p>
<h2>Borrowed Money</h2>
<p>Keep a neat running view of who owes what and how much is still open.</p>
</div>
<div class="tool-form">
<input id="person" placeholder="Person">
<input id="amount" placeholder="Amount" inputmode="decimal">
<button onclick="addBorrow()">Add Entry</button>
</div>
<div id="borrowList" class="list-group"></div>
</div>
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

  if(!data.length){
    list.innerHTML = "<div class='list-empty'>No borrowed entries yet. Add one to start tracking.</div>"
    return
  }

  data.forEach((entry) => {
    list.innerHTML += `
<div class="list-item">
<div class="list-copy">
<strong>${entry.person}</strong>
<span>Pending amount</span>
</div>
<div class="list-actions">
<span class="list-amount">\u20B9${entry.amount}</span>
<button onclick='deleteBorrow(${JSON.stringify(entry.id)})'>Delete</button>
</div>
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
