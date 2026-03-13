function showHome(){

document.getElementById("screenHome").style.display="block"
document.getElementById("toolArea").style.display="none"

renderExpenseChart()

}

function showSection(sectionId){

const sections = document.querySelectorAll(".page-section")

sections.forEach(section=>{
section.style.display="none"
})

document.getElementById(sectionId).style.display="block"

}

async function openTool(toolId){

const res = await fetch("tools/tools.json")
const tools = await res.json()

const tool = tools.find(t => t.id === toolId)

if(!tool) return

let container = document.getElementById("toolContainer")

container.innerHTML = ""

document.getElementById("screenHome").style.display="none"
document.getElementById("toolArea").style.display="block"

// remove old script
let oldScript = document.querySelector(`script[data-tool="${toolId}"]`)
if(oldScript) oldScript.remove()

// load fresh script
let script = document.createElement("script")
script.src = tool.script
script.dataset.tool = toolId

script.onload = ()=>{
if(typeof renderTool === "function"){
renderTool()
}
}

document.body.appendChild(script)

}



if("serviceWorker" in navigator){

window.addEventListener("load", ()=>{

navigator.serviceWorker.register("service-worker.js")
.then(()=>{

console.log("Service Worker Registered")

})

})

}

let languageData = {}

async function loadLanguage(lang){

const res = await fetch(`languages/${lang}.json`)
languageData = await res.json()

applyLanguage()

localStorage.setItem("language", lang)

}

function applyLanguage(){

document.querySelector('[data-text="todayExpense"]').innerText = languageData.todayExpense
document.querySelector('[data-text="borrowedPending"]').innerText = languageData.borrowedPending
document.querySelector('[data-text="quickTools"]').innerText = languageData.quickTools

}


window.addEventListener("load",()=>{

loadTools()

renderExpenseChart()

let lang = localStorage.getItem("language") || "en"

document.getElementById("languageSelect").value = lang

loadLanguage(lang)

document.getElementById("languageSelect").addEventListener("change",(e)=>{

loadLanguage(e.target.value)

})

document.getElementById("globalSearch").addEventListener("input", runSearch)

})

function exportData(){

let data = {

expenses: JSON.parse(localStorage.getItem("expenses")) || [],
borrow: JSON.parse(localStorage.getItem("borrow")) || [],
grocery: JSON.parse(localStorage.getItem("grocery")) || []

}

let json = JSON.stringify(data)

let blob = new Blob([json], {type:"application/json"})

let url = URL.createObjectURL(blob)

let a = document.createElement("a")

a.href = url
a.download = "dailykit-backup.json"

a.click()

}

async function loadTools(){

const res = await fetch("tools/tools.json")

const tools = await res.json()

const container = document.querySelector(".home-tools")

container.innerHTML=""

tools.forEach(tool=>{

const btn = document.createElement("button")

btn.innerHTML = tool.icon + " " + tool.name

btn.onclick = () => openTool(tool.id)

container.appendChild(btn)

})

}

window.addEventListener("load",()=>{

let importInput = document.getElementById("importFile")

if(importInput){

importInput.addEventListener("change", function(e){

let file = e.target.files[0]

if(!file) return

let reader = new FileReader()

reader.onload = function(event){

let data = JSON.parse(event.target.result)

localStorage.setItem("expenses", JSON.stringify(data.expenses || []))
localStorage.setItem("borrow", JSON.stringify(data.borrow || []))
localStorage.setItem("grocery", JSON.stringify(data.grocery || []))

alert("Backup Restored Successfully")

location.reload()

}

reader.readAsText(file)

})

}

})

let expenseChartInstance = null

function renderExpenseChart(){

let canvas = document.getElementById("expenseChart")

if(!canvas) return

let data = JSON.parse(localStorage.getItem("expenses")) || []

let categories = {}

data.forEach(item=>{

let name = item.name.toLowerCase()

let category="Other"

let transport = ["bus","train","flight","taxi","uber","auto","metro","petrol"]
let food = ["tea","coffee","lunch","dinner","breakfast","snack","food"]
let grocery = ["milk","bread","vegetable","fruit","rice","grocery"]

if(transport.some(t=>name.includes(t))) category="Transport"
if(food.some(t=>name.includes(t))) category="Food"
if(grocery.some(t=>name.includes(t))) category="Grocery"

if(!categories[category]) categories[category]=0

categories[category]+=item.amount

})

let labels = Object.keys(categories)

let values = Object.values(categories)

generateInsights(categories)

if(expenseChartInstance){
expenseChartInstance.destroy()
}

expenseChartInstance = new Chart(canvas,{
type:"pie",
data:{
labels:labels,
datasets:[{
data:values
}]
}
})

}

function generateInsights(categories){

let total = Object.values(categories).reduce((a,b)=>a+b,0)

let topCategory = Object.keys(categories).reduce((a,b)=>
categories[a]>categories[b]?a:b
)

let dailyAvg = Math.round(total/30)

document.getElementById("insights").innerHTML = `
<div class="insight-box">
<p><b>Top Category:</b> ${topCategory}</p>
<p><b>Monthly Spend:</b> ₹${total}</p>
<p><b>Daily Average:</b> ₹${dailyAvg}</p>
</div>
`
}

function runSearch(){

let input = document.getElementById("globalSearch")
let div = document.getElementById("searchResults")

if(!input || !div) return

let q = input.value.toLowerCase().trim()

if(q === ""){
div.style.display = "none"
div.innerHTML = ""
return
}

let results = []

let expenses = JSON.parse(localStorage.getItem("expenses")) || []

expenses.forEach(e=>{
let name = (e.name || "").toLowerCase()

if(name.includes(q)){
results.push("Expense: " + e.name + " ₹" + e.amount)
}
})

let grocery = JSON.parse(localStorage.getItem("grocery")) || []

grocery.forEach(g=>{
let item = (g.name || "").toLowerCase()

if(item.includes(q)){
results.push("Grocery: " + g.name)
}
})

let borrow = JSON.parse(localStorage.getItem("borrow")) || []

borrow.forEach(b=>{
let person = (b.person || "").toLowerCase()

if(person.includes(q)){
results.push("Borrow: " + b.person + " ₹" + b.amount)
}
})

if(results.length === 0){

div.innerHTML = "<div style='padding:10px'>No results found</div>"

}else{

div.innerHTML = results.map(r => `<div>${r}</div>`).join("")

}

div.style.display = "block"

}