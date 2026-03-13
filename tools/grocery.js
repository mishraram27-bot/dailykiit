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

let input = document.getElementById("groceryInput")

if(!input) return

let value = input.value.trim()

if(!value) return

let data = JSON.parse(localStorage.getItem("grocery")) || []

data.push(value)

localStorage.setItem("grocery", JSON.stringify(data))

input.value=""

loadGroceries()

}



function loadGroceries(){

let data = JSON.parse(localStorage.getItem("grocery")) || []

let list = document.getElementById("groceryList")

if(!list) return

list.innerHTML=""

data.forEach((item,index)=>{

let div = document.createElement("div")

div.className="list-item"

div.innerHTML = item + ` <button onclick="removeGrocery(${index})">❌</button>`

list.appendChild(div)

})

}



function removeGrocery(index){

let data = JSON.parse(localStorage.getItem("grocery")) || []

data.splice(index,1)

localStorage.setItem("grocery", JSON.stringify(data))

loadGroceries()

}