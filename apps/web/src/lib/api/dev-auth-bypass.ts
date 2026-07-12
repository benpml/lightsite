export const DEV_AUTH_BYPASS_HEADER = "x-lightsite-dev-auth"

const DEV_AUTH_BYPASS_STORAGE_KEY = "lightsite.devAuthBypass"
let devAuthBypassEnabledInMemory = false

export function isDevAuthBypassAvailable() {
  return import.meta.env.DEV
}

export function enableDevAuthBypass() {
  if (!isDevAuthBypassAvailable() || typeof window === "undefined") {
    return
  }

  devAuthBypassEnabledInMemory = true
  getLocalStorage()?.setItem(DEV_AUTH_BYPASS_STORAGE_KEY, "1")
}

export function disableDevAuthBypass() {
  devAuthBypassEnabledInMemory = false

  if (typeof window === "undefined") {
    return
  }

  getLocalStorage()?.removeItem(DEV_AUTH_BYPASS_STORAGE_KEY)
}

export function isDevAuthBypassActive() {
  return (
    isDevAuthBypassAvailable() &&
    typeof window !== "undefined" &&
    (devAuthBypassEnabledInMemory || getLocalStorage()?.getItem(DEV_AUTH_BYPASS_STORAGE_KEY) === "1")
  )
}

export function getDevAuthBypassHeaders(): Record<string, string> {
  return isDevAuthBypassActive() ? { [DEV_AUTH_BYPASS_HEADER]: "1" } : {}
}

function getLocalStorage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}
