/**
 * HTTP 클라이언트 추상화
 *
 * - 모바일(Capacitor): CapacitorHttp 사용 → CORS 우회
 * - 웹 브라우저: fetch 사용 (CORS 제약 있음, 웹 데모용)
 */
import { Capacitor, CapacitorHttp } from '@capacitor/core'

export interface HttpOptions {
  url: string
  params?: Record<string, string | number | boolean | undefined | null>
  headers?: Record<string, string>
  timeoutMs?: number
}

export interface HttpResponse<T = any> {
  status: number
  data: T
}

function buildUrl(url: string, params?: HttpOptions['params']): string {
  if (!params) return url
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    qs.set(k, String(v))
  }
  const s = qs.toString()
  if (!s) return url
  return url + (url.includes('?') ? '&' : '?') + s
}

export function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

/**
 * 웹 브라우저 dev 환경에서 CORS 제약이 있는 외부 API를
 * Vite dev 서버 프록시 경로로 재작성.
 * 네이티브(Capacitor) / 프로덕션 빌드에서는 원본 URL 그대로 사용.
 */
function devRewriteUrl(url: string): string {
  // @ts-ignore
  const isDev = typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV
  if (!isDev || isNative()) return url
  if (/https?:\/\/apis\.data\.go\.kr/.test(url)) {
    return url.replace(/https?:\/\/apis\.data\.go\.kr/, '/proxy-apis-data-go-kr')
  }
  if (/https?:\/\/api\.data\.go\.kr/.test(url)) {
    return url.replace(/https?:\/\/api\.data\.go\.kr/, '/proxy-api-data-go-kr')
  }
  if (/http:\/\/openapi\.seoul\.go\.kr:8088/.test(url)) {
    return url.replace(/http:\/\/openapi\.seoul\.go\.kr:8088/, '/proxy-openapi-seoul')
  }
  return url
}

export async function httpGet<T = any>(opts: HttpOptions): Promise<HttpResponse<T>> {
  if (isNative()) {
    const res = await CapacitorHttp.get({
      url: opts.url,
      params: opts.params as any,
      headers: opts.headers,
      readTimeout: opts.timeoutMs || 15000,
      connectTimeout: opts.timeoutMs || 15000,
    })
    return { status: res.status, data: res.data as T }
  }
  const rewritten = devRewriteUrl(opts.url)
  const full = buildUrl(rewritten, opts.params)
  const res = await fetch(full, {
    headers: opts.headers,
    signal: opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined,
  })
  let data: any = null
  try {
    data = await res.json()
  } catch {
    data = await res.text().catch(() => null)
  }
  return { status: res.status, data: data as T }
}

export async function httpPost<T = any>(
  opts: HttpOptions & { body: unknown }
): Promise<HttpResponse<T>> {
  if (isNative()) {
    const res = await CapacitorHttp.post({
      url: opts.url,
      params: opts.params as any,
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      data: opts.body,
      readTimeout: opts.timeoutMs || 30000,
      connectTimeout: opts.timeoutMs || 15000,
    })
    return { status: res.status, data: res.data as T }
  }
  const rewritten = devRewriteUrl(opts.url)
  const full = buildUrl(rewritten, opts.params)
  const res = await fetch(full, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    body: JSON.stringify(opts.body),
    signal: opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined,
  })
  let data: any = null
  try {
    data = await res.json()
  } catch {
    data = await res.text().catch(() => null)
  }
  return { status: res.status, data: data as T }
}
