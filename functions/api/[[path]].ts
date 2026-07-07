type PagesFunctionContext = {
  request: Request
  params: {
    path?: string | string[]
  }
  env?: {
    LIGHTSITE_API_ORIGIN?: string
  }
}

const DEFAULT_API_ORIGIN = "https://lightsite-api.onrender.com"

export async function onRequest(context: PagesFunctionContext) {
  const upstreamOrigin = context.env?.LIGHTSITE_API_ORIGIN || DEFAULT_API_ORIGIN
  const requestUrl = new URL(context.request.url)
  const path = Array.isArray(context.params.path)
    ? context.params.path.join("/")
    : context.params.path ?? ""
  const upstreamUrl = new URL(`/api/${path}${requestUrl.search}`, upstreamOrigin)
  const headers = new Headers(context.request.headers)

  headers.delete("host")
  headers.set("x-forwarded-host", requestUrl.host)
  headers.set("x-forwarded-proto", requestUrl.protocol.replace(":", ""))

  return fetch(upstreamUrl, {
    method: context.request.method,
    headers,
    body: context.request.body,
    redirect: "manual",
  })
}

