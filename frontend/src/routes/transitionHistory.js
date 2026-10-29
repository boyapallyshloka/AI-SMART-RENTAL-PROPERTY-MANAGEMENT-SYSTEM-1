import { flushSync } from 'react-dom'
import { UNSAFE_createBrowserHistory } from 'react-router-dom'

let activeTransition = null

function completeRouteTransition() {
  activeTransition?.finishCommit()
}

function startViewTransition(update = () => {}) {
  if (
    typeof document === 'undefined' ||
    typeof document.startViewTransition !== 'function' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    activeTransition
  ) {
    update()
    return
  }

  let resolveCommit
  const committed = new Promise((resolve) => {
    resolveCommit = resolve
  })
  const transition = {
    finishCommit: resolveCommit,
  }

  activeTransition = transition

  const timeout = window.setTimeout(resolveCommit, 1000)

  try {
    const viewTransition = document.startViewTransition(async () => {
      update()
      await committed
    })

    viewTransition.finished.finally(() => {
      window.clearTimeout(timeout)
      if (activeTransition === transition) activeTransition = null
    })
  } catch {
    window.clearTimeout(timeout)
    activeTransition = null
    update()
  }
}

export function createTransitionHistory() {
  const history = UNSAFE_createBrowserHistory({ window, v5Compat: true })
  const push = history.push.bind(history)
  const replace = history.replace.bind(history)
  const listen = history.listen.bind(history)

  const navigateWithTransition = (navigate, args) => {
    const [to] = args
    const targetPath = typeof to === 'string' ? to.split(/[?#]/, 1)[0] : to?.pathname
    if (targetPath && targetPath !== history.location.pathname) {
      startViewTransition(() => navigate(...args))
      return
    }

    navigate(...args)
  }

  history.push = (...args) => navigateWithTransition(push, args)
  history.replace = (...args) => navigateWithTransition(replace, args)

  history.listen = (listener) => listen((update) => {
    if (activeTransition) {
      flushSync(() => listener(update))
      return
    }
    listener(update)
  })

  // A capture listener runs before the router's popstate listener, preserving
  // the current screen for the outgoing half of browser back/forward motion.
  window.addEventListener('popstate', () => startViewTransition(), true)

  return history
}

export { completeRouteTransition }
