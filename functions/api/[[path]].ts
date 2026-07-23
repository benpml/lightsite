type PagesFunctionContext = {
  request: Request
  params: {
    path?: string | string[]
  }
  env?: {
    HANDOUT_API_ORIGIN?: string
    ORIGIN_AUTH_SECRET?: string
  }
}

const DEFAULT_API_ORIGIN = "https://api.handout.link"

export async function onRequest(context: PagesFunctionContext) {
  const upstreamOrigin = context.env?.HANDOUT_API_ORIGIN || DEFAULT_API_ORIGIN
  const requestUrl = new URL(context.request.url)
  const path = Array.isArray(context.params.path)
    ? context.params.path.join("/")
    : context.params.path ?? ""
  const upstreamUrl = new URL(`/api/${path}${requestUrl.search}`, upstreamOrigin)
  const headers = new Headers(context.request.headers)

  headers.delete("host")
  headers.set("x-handout-origin-auth", context.env?.ORIGIN_AUTH_SECRET ?? "")
  headers.set("x-forwarded-host", requestUrl.host)
  headers.set("x-forwarded-proto", requestUrl.protocol.replace(":", ""))

  return fetch(upstreamUrl, {
    method: context.request.method,
    headers,
    body: context.request.body,
    redirect: "manual",
  })
}
