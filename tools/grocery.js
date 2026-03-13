function renderTool(){
  const area = document.getElementById("toolContainer")

  area.innerHTML = `
<h2>Grocery List</h2>
<input id="groceryInput" placeholder="Item name">
<button onclick="addGrocery()">Add</button>
<div id="groceryList"></div>
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

  data.forEach((item) => {
    const div = document.createElement("div")
    div.className = "list-item"
    div.innerHTML = `${item.name} <button onclick='removeGrocery(${JSON.stringify(item.id)})'>Delete</button>`
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
