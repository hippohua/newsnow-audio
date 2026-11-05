import type { Env, NewsnowItem, SourceConfig } from "./types"

/**
 * 从 newsnow 拉取单个源。
 * newsnow 接口：GET {NEWSNOW_BASE}/api/s?id={sourceId}
 * 返回 { status, id, updatedTime, items: [{ id, title, url, extra }] }
 */
export async function fetchSource(env: Env, source: SourceConfig): Promise<NewsnowItem[]> {
  const url = `${env.NEWSNOW_BASE.replace(/\/$/, "")}/api/s?id=${encodeURIComponent(source.id)}`
  const resp = await fetch(url, {
    cf: { cacheTtl: 0, cacheEverything: false },
  })
  if (!resp.ok) {
    console.error(`fetchSource ${source.id} failed: ${resp.status}`)
    return []
  }
  const data = (await resp.json()) as { status: string; items?: NewsnowItem[] }
  if (data.status !== "success" && data.status !== "cache") return []
  return (data.items ?? []).slice(0, 20)
}
