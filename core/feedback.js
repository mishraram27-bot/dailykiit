;(function(){
let hideTimer = null
let activeAction = null

function ensureHost(){
  return document.getElementById("snackbarHost")
}

function hide(){
  const host = ensureHost()

  window.clearTimeout(hideTimer)
  activeAction = null

  if(host){
    host.classList.remove("is-visible")
    host.innerHTML = ""
  }
}

function show(message, options = {}){
  const host = ensureHost()

  if(!host){
    return
  }

  const {
    type = "info",
    actionLabel = "",
    duration = actionLabel ? 7000 : 3600,
    onAction = null
  } = options

  activeAction = typeof onAction === "function" ? onAction : null
  const closeText = window.t ? window.t("common.close", "Close") : "Close"
  const closeLabel = window.t ? window.t("common.closeNotification", "Close notification") : "Close notification"
  host.innerHTML = `
<div class="snackbar snackbar-${type}">
  <span class="snackbar-message">${message}</span>
  <div class="snackbar-actions">
    ${actionLabel ? `<button type="button" class="snackbar-action">${actionLabel}</button>` : ""}
    <button type="button" class="snackbar-close" aria-label="${closeLabel}">${closeText}</button>
  </div>
</div>
`
  host.classList.add("is-visible")

  const actionButton = host.querySelector(".snackbar-action")
  const closeButton = host.querySelector(".snackbar-close")

  if(actionButton){
    actionButton.addEventListener("click", () => {
      const action = activeAction
      hide()

      if(action){
        action()
      }
    }, {once: true})
  }

  if(closeButton){
    closeButton.addEventListener("click", hide, {once: true})
  }

  window.clearTimeout(hideTimer)
  hideTimer = window.setTimeout(hide, duration)
}

window.LifeOSFeedback = {
  show,
  hide,
  success(message, options = {}){
    show(message, {...options, type: "success"})
  },
  error(message, options = {}){
    show(message, {...options, type: "error"})
  }
}
})()
