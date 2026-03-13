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

let person=document.getElementById("person").value.trim()

if(!person) return alert("Enter person name")

let amount=parseFloat(document.getElementById("amount").value)

if(!amount) return alert("Invalid amount")

let data=JSON.parse(localStorage.getItem("borrow"))||[]

data.push({person,amount})

localStorage.setItem("borrow",JSON.stringify(data))

loadBorrow()

}

function loadBorrow(){

let data=JSON.parse(localStorage.getItem("borrow"))||[]

let list=document.getElementById("borrowList")

if(!list) return

list.innerHTML=""

let total=0

data.forEach((b,index)=>{

total+=b.amount

list.innerHTML+=`
<div class="list-item">
${b.person} owes ₹${b.amount}
<button onclick="deleteBorrow(${index})">❌</button>
</div>
`

})

document.getElementById("borrowedTotal").innerText="₹"+total

}

function deleteBorrow(index){

let data=JSON.parse(localStorage.getItem("borrow"))||[]

data.splice(index,1)

localStorage.setItem("borrow",JSON.stringify(data))

loadBorrow()

}