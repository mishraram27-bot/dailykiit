;(function(){
let toolRegistry = []
let toolRegistryPromise = null
let activeToolId = null
let activeToolApi = null
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

function getActiveToolApi(){
  return activeToolApi
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

function resetToolGlobals(){
  window.LifeOSTool = undefined
  window.renderTool = undefined
}

function destroyActiveTool(){
  if(activeToolApi?.destroy){
    try{
      activeToolApi.destroy()
    }catch(error){
      console.error("Life OS tool destroy failed", error)
      window.LifeOSStorage?.addErrorLog?.({
        type: "tool-destroy",
        message: error?.message || "Tool destroy failed",
        source: activeToolId || "unknown-tool",
        stack: error?.stack || ""
      })
    }
  }

  if(activeToolId){
    window.LifeOSEvents?.emit?.("tool:destroyed", {toolId: activeToolId})
  }

  activeToolApi = null
  document.querySelectorAll("script[data-tool]").forEach((script) => script.remove())
  resetToolGlobals()
}

function resolveToolApi(toolId){
  if(window.LifeOSTool && typeof window.LifeOSTool.render === "function"){
    return {
      id: window.LifeOSTool.id || toolId,
      init: typeof window.LifeOSTool.init === "function" ? window.LifeOSTool.init : () => {},
      render: window.LifeOSTool.render,
      refresh: typeof window.LifeOSTool.refresh === "function" ? window.LifeOSTool.refresh : window.LifeOSTool.render,
      destroy: typeof window.LifeOSTool.destroy === "function" ? window.LifeOSTool.destroy : () => {}
    }
  }

  if(typeof window.renderTool === "function"){
    return {
      id: toolId,
      init(){},
      render: window.renderTool,
      refresh: window.renderTool,
      destroy(){}
    }
  }

  return null
}

function refreshActiveTool(){
  if(!activeToolApi){
    return
  }

  const refresh = typeof activeToolApi.refresh === "function" ? activeToolApi.refresh : activeToolApi.render

  if(typeof refresh !== "function"){
    return
  }

  try{
    refresh()
  }catch(error){
    console.error("Life OS tool refresh failed", error)
    window.LifeOSStorage?.addErrorLog?.({
      type: "tool-refresh",
      message: error?.message || "Tool refresh failed",
      source: activeToolId || "unknown-tool",
      stack: error?.stack || ""
    })
  }
}

function showHome(){
  const home = document.getElementById("screenHome")
  const toolArea = document.getElementById("toolArea")
  const diagnosticsArea = document.getElementById("diagnosticsArea")
  const settingsArea = document.getElementById("settingsArea")

  destroyActiveTool()
  activeToolId = null
  window.toggleToolsPanel?.(false)
  revealScreen(home)
  hideScreen(toolArea)
  hideScreen(diagnosticsArea)
  hideScreen(settingsArea)
  syncNavState("home")

  if(typeof window.refreshDashboard === "function"){
    window.refreshDashboard()
  }

  window.setTimeout(() => {
    document.getElementById("globalSearch")?.focus()
  }, 180)
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
  const diagnosticsArea = document.getElementById("diagnosticsArea")
  const settingsArea = document.getElementById("settingsArea")

  if(!tool){
    return
  }

  if(activeToolId && activeToolId !== toolId){
    destroyActiveTool()
  }else if(activeToolId === toolId && activeToolApi){
    refreshActiveTool()
    return
  }

  activeToolId = toolId

  const container = document.getElementById("toolContainer")
  container.innerHTML = ""

  window.toggleToolsPanel?.(false)
  hideScreen(home)
  hideScreen(diagnosticsArea)
  hideScreen(settingsArea)
  revealScreen(toolArea)
  syncNavState(toolId)
  resetToolGlobals()

  const script = document.createElement("script")
  script.src = tool.script
  script.dataset.tool = toolId
  script.onload = () => {
    activeToolApi = resolveToolApi(toolId)

    if(!activeToolApi){
      console.error("Life OS tool did not register correctly", toolId)
      window.LifeOSStorage?.addErrorLog?.({
        type: "tool-load",
        message: `Tool failed to register: ${toolId}`,
        source: tool.script
      })
      return
    }

    try{
      activeToolApi.init?.()
      activeToolApi.render?.()
      window.LifeOSEvents?.emit?.("tool:opened", {toolId, tool})
    }catch(error){
      console.error("Life OS tool render failed", error)
      window.LifeOSStorage?.addErrorLog?.({
        type: "tool-render",
        message: error?.message || "Tool render failed",
        source: tool.script,
        stack: error?.stack || ""
      })
    }
  }

  document.body.appendChild(script)
}

function showDiagnostics(){
  const home = document.getElementById("screenHome")
  const toolArea = document.getElementById("toolArea")
  const diagnosticsArea = document.getElementById("diagnosticsArea")
  const settingsArea = document.getElementById("settingsArea")

  destroyActiveTool()
  activeToolId = null
  window.toggleToolsPanel?.(false)
  hideScreen(home)
  hideScreen(toolArea)
  hideScreen(settingsArea)
  revealScreen(diagnosticsArea)
  syncNavState("recovery")
}

function showSettings(){
  const home = document.getElementById("screenHome")
  const toolArea = document.getElementById("toolArea")
  const diagnosticsArea = document.getElementById("diagnosticsArea")
  const settingsArea = document.getElementById("settingsArea")

  destroyActiveTool()
  activeToolId = null
  window.toggleToolsPanel?.(false)
  hideScreen(home)
  hideScreen(toolArea)
  hideScreen(diagnosticsArea)
  revealScreen(settingsArea)
  syncNavState("settings")
}

async function loadTools(){
  const tools = await ensureToolRegistry()
  const container = document.querySelector(".home-tools")

  if(!container){
    return
  }

  container.innerHTML = ""

  tools.forEach((tool) => {
    const button = document.createElement("button")
    const description = window.t
      ? window.t(`toolDesc.${tool.id}`, tool.description || "Open this tool")
      : (tool.description || "Open this tool")
    const title = window.t ? window.t(`tool.${tool.id}`, tool.name) : tool.name

    button.innerHTML = `
<span class="tool-icon">${tool.icon}</span>
<span class="tool-copy">
<strong>${title}</strong>
<span>${description}</span>
</span>
`
    button.onclick = () => openTool(tool.id)
    container.appendChild(button)
  })
}

window.LifeOSRouter = {
  ensureToolRegistry,
  getToolRegistry,
  getActiveToolId,
  getActiveToolApi,
  showHome,
  showDiagnostics,
  showSettings,
  showSection,
  openTool,
  refreshActiveTool,
  destroyActiveTool,
  loadTools,
  syncNavState
}

window.registerLifeOSTool = (toolDefinition) => {
  window.LifeOSTool = toolDefinition
  return toolDefinition
}

window.showHome = showHome
window.showDiagnostics = showDiagnostics
window.showSettings = showSettings
window.showSection = showSection
window.openTool = openTool
})()
