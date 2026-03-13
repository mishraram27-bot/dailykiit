function renderTool(){

const area = document.getElementById("toolContainer")

area.innerHTML = `

<h2>Expenses</h2>

<input id="expenseInput" placeholder="item amount">

<button onclick="addExpense()">Add</button>

<div id="expenseList"></div>

`

loadExpenses()

renderExpenseChart()

}

function addExpense(){

let inputElement = document.getElementById("expenseInput")

if(!inputElement) return

let input = inputElement.value.trim()

if(!input) return alert("Enter expense")

let parts = input.split(" ")

let amount = parseFloat(parts.pop())
let name = parts.join(" ")

if(!name) return alert("Enter item name")
if(isNaN(amount) || amount <= 0) return alert("Invalid amount")

let today = new Date().toISOString().split("T")[0]

let data = JSON.parse(localStorage.getItem("expenses")) || []

data.push({
name:name,
amount:amount,
date:today
})

localStorage.setItem("expenses", JSON.stringify(data))

inputElement.value=""

loadExpenses()

renderExpenseChart()

}

function loadExpenses(){

let data=JSON.parse(localStorage.getItem("expenses"))||[]

let list=document.getElementById("expenseList")

if(!list) return

list.innerHTML=""

let today=new Date().toISOString().split("T")[0]

let total=0

data.forEach((e,index)=>{

if(e.date===today){

total+=e.amount

list.innerHTML+=`
<div class="list-item">
${e.name} ₹${e.amount}
<button onclick="deleteExpense(${index})">❌</button>
</div>
`
}

})

document.getElementById("todayExpense").innerText="₹"+total

renderExpenseChart()

}



function deleteExpense(index){

let data = JSON.parse(localStorage.getItem("expenses")) || []

data.splice(index,1)

localStorage.setItem("expenses", JSON.stringify(data))

loadExpenses()

renderExpenseChart()

}

function updateDashboard(){

let data = JSON.parse(localStorage.getItem("expenses")) || []

let today = new Date().toISOString().split("T")[0]

let total = 0

data.forEach(item=>{
 if(item.date === today){
  total += item.amount
 }
})

document.getElementById("todayExpense").innerText = "₹" + total

}