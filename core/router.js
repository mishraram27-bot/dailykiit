;(function(){
let toolRegistry = []
let toolRegistryPromise = null
let activeToolId = null

async function ensureToolRegistry(){
  if(toolRegistry.length){
    return toolRegistry
  }

  if(!toolRegistryPromise){
    toolRegistryPromise = fetch("tools/tools.json")
      .then((response) => response.json())
      .then((tools) => {
        toolRegistry = Array.isArray(tools) ? tools : []
        return toolRegistry
      })
      .catch((error) => {
        toolRegistryPromise = null
        throw error
      })
  }

  return toolRegistryPromise
}

function getToolRegistry(){
  return toolRegistry.slice()
}

function getActiveToolId(){
  return activeToolId
}

function showHome(){
  activeToolId = null
  document.getElementById("screenHome").style.display = "block"
  document.getElementById("toolArea").style.display = "none"

  if(typeof window.refreshDashboard === "function"){
    window.refreshDashboard()
  }
}

function showSection(sectionId){
  const sections = document.querySelectorAll(".page-section")

  sections.forEach((section) => {
    section.style.display = "none"
  })

  const target = document.getElementById(sectionId)

  if(target){
    target.style.display = "block"
  }
}

async function openTool(toolId){
  const tools = await ensureToolRegistry()
  const tool = tools.find((entry) => entry.id === toolId)

  if(!tool){
    return
  }

  activeToolId = toolId

  const container = document.getElementById("toolContainer")
  container.innerHTML = ""

  document.getElementById("screenHome").style.display = "none"
  document.getElementById("toolArea").style.display = "block"

  document.querySelectorAll("script[data-tool]").forEach((script) => script.remove())

  const script = document.createElement("script")
  script.src = tool.script
  script.dataset.tool = toolId
  script.onload = () => {
    if(typeof renderTool === "function"){
      renderTool()
    }
  }

  document.body.appendChild(script)
}

async function loadTools(){
  const tools = await ensureToolRegistry()
  const container = document.querySelector(".home-tools")
  const descriptions = {
    expenses: "Capture spends fast",
    borrowed: "Track who owes what",
    grocery: "Keep your list ready"
  }

  if(!container){
    return
  }

  container.innerHTML = ""

  tools.forEach((tool) => {
    const button = document.createElement("button")
    const description = descriptions[tool.id] || "Open this tool"

    button.innerHTML = `
<span class="tool-icon">${tool.icon}</span>
<span class="tool-copy">
<strong>${tool.name}</strong>
<span>${description}</span>
</span>
`
    button.onclick = () => openTool(tool.id)
    container.appendChild(button)
  })
}

window.DailyKitRouter = {
  ensureToolRegistry,
  getToolRegistry,
  getActiveToolId,
  showHome,
  showSection,
  openTool,
  loadTools
}

window.showHome = showHome
window.showSection = showSection
window.openTool = openTool
})()
