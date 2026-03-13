;(function(){
let toolRegistry = []
let toolRegistryPromise = null
let activeToolId = null
const SCREEN_REVEAL_MS = 360

function syncNavState(activeId){
  document.querySelectorAll(".bottom-nav button[data-nav]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.nav === activeId)
  })
}

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

function revealScreen(element){
  if(!element){
    return
  }

  element.hidden = false
  element.classList.add("is-active")
  element.classList.remove("is-entering")

  void element.offsetWidth
  element.classList.add("is-entering")

  window.clearTimeout(element._revealTimer)
  element._revealTimer = window.setTimeout(() => {
    element.classList.remove("is-entering")
  }, SCREEN_REVEAL_MS)
}

function hideScreen(element){
  if(!element){
    return
  }

  element.classList.remove("is-active", "is-entering")
  element.hidden = true
}

function showHome(){
  const home = document.getElementById("screenHome")
  const toolArea = document.getElementById("toolArea")

  activeToolId = null
  revealScreen(home)
  hideScreen(toolArea)
  syncNavState("home")

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
  const home = document.getElementById("screenHome")
  const toolArea = document.getElementById("toolArea")

  if(!tool){
    return
  }

  activeToolId = toolId

  const container = document.getElementById("toolContainer")
  container.innerHTML = ""

  hideScreen(home)
  revealScreen(toolArea)
  syncNavState(toolId)

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
  loadTools,
  syncNavState
}

window.showHome = showHome
window.showSection = showSection
window.openTool = openTool
})()
