function renderTool(){
  const area = document.getElementById("toolContainer")

  area.innerHTML = `
<div class="tool-shell">
<div class="tool-heading">
<p class="section-kicker">Shopping</p>
<h2>Grocery List</h2>
<p>Drop in items fast and keep a clean, ready-to-use list for the next run.</p>
</div>
<div class="tool-form">
<input id="groceryInput" placeholder="Item name">
<button onclick="addGrocery()">Add Item</button>
</div>
<div id="groceryList" class="list-group"></div>
</div>
`

  loadGroceries()
}

function addGrocery(){
  const input = document.getElementById("groceryInput")

  if(!input){
    return
  }

  const value = input.value.trim()

  if(!value){
    return
  }

  DailyKitStorage.addGrocery({name: value})
  input.value = ""
  loadGroceries()

  if(typeof refreshDashboard === "function"){
    refreshDashboard()
  }
}

function loadGroceries(){
  const data = DailyKitStorage.getGrocery()
  const list = document.getElementById("groceryList")

  if(!list){
    return
  }

  list.innerHTML = ""

  if(!data.length){
    list.innerHTML = "<div class='list-empty'>No grocery items yet. Add your first item above.</div>"
    return
  }

  data.forEach((item) => {
    const div = document.createElement("div")
    div.className = "list-item"
    div.innerHTML = `
<div class="list-copy">
<strong>${item.name}</strong>
<span>Ready to buy</span>
</div>
<div class="list-actions">
<button onclick='removeGrocery(${JSON.stringify(item.id)})'>Delete</button>
</div>
`
    list.appendChild(div)
  })
}

function removeGrocery(id){
  DailyKitStorage.removeGrocery(id)
  loadGroceries()

  if(typeof refreshDashboard === "function"){
    refreshDashboard()
  }
}
