;(function(){
const listeners = new Map()

function on(eventName, handler){
  if(typeof handler !== "function"){
    return () => {}
  }

  const handlers = listeners.get(eventName) || new Set()
  handlers.add(handler)
  listeners.set(eventName, handlers)

  return () => off(eventName, handler)
}

function once(eventName, handler){
  const unsubscribe = on(eventName, (payload) => {
    unsubscribe()
    handler(payload)
  })

  return unsubscribe
}

function off(eventName, handler){
  const handlers = listeners.get(eventName)

  if(!handlers){
    return
  }

  handlers.delete(handler)

  if(!handlers.size){
    listeners.delete(eventName)
  }
}

function emit(eventName, payload){
  const handlers = listeners.get(eventName)

  if(!handlers){
    return
  }

  ;[...handlers].forEach((handler) => {
    try{
      handler(payload)
    }catch(error){
      console.error("DailyKit event handler failed", eventName, error)
    }
  })
}

window.DailyKitEvents = {
  on,
  once,
  off,
  emit
}
})()
