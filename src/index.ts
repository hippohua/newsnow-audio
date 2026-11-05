import { runPipeline } from "./pipeline"
import type { Env, FeedItem } from "./types"

/**
 * newsnow-audio 入口
 * - GET  /feed          播报队列（App 主接口）
 * - GET  /audio/:key    音频流（key 形如 t/<id>.mp3 或 d/<id>.mp3）
 * - POST /run           手动触发归集（Header: Authorization: Bearer <RUN_TOKEN>）
 * - scheduled           Cron 定时触发
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const { pathname } = url

    // CORS（App 端 WebView 调试用）
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders })
    }

    if (pathname === "/feed" && request.method === "GET") {
      const raw = await env.FEED.get("feed")
      if (!raw) {
        return json({ status: "empty", items: [] })
      }
      const feed = JSON.parse(raw) as { updated: number; items: FeedItem[] }
      const limit = Number(url.searchParams.get("limit") ?? 0)
      const items = limit > 0 ? feed.items.slice(0, limit) : feed.items
      return json({
        status: "success",
        updated: feed.updated,
        items: items.map((item) => ({
          ...item,
          audioTitle: item.audioTitleKey ? audioUrl(url, item.audioTitleKey) : null,
          audioDetail: item.audioDetailKey ? audioUrl(url, item.audioDetailKey) : null,
        })),
      })
    }

    const audioMatch = /^\/audio\/(.+\.mp3)$/.exec(pathname)
    if (audioMatch && request.method === "GET") {
      const obj = await env.AUDIO.get(audioMatch[1])
      if (!obj) return new Response("Not Found", { status: 404 })
      return new Response(obj.body, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "public, max-age=604800",
          "Accept-Ranges": "bytes",
        },
      })
    }

    if (pathname === "/run" && request.method === "POST") {
      const auth = request.headers.get("Authorization") ?? ""
      if (auth !== `Bearer ${env.RUN_TOKEN}`) {
        return new Response("Unauthorized", { status: 401 })
      }
      const result = await runPipeline(env)
      return json({ status: "success", ...result })
    }

    if (pathname === "/health") {
      return json({ status: "ok" })
    }

    return new Response("Not Found", { status: 404 })
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      runPipeline(env).then((r) => console.log("cron done:", r))
    )
  },
} satisfies ExportedHandler<Env>

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
  })
}

function audioUrl(base: URL, key: string): string {
  return `${base.origin}/audio/${key}`
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}
