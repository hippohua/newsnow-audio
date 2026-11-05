import { SOURCES, MAX_ITEMS_PER_SOURCE, MAX_FEED_SIZE, SUMMARIZE_BATCH, OPENING } from "./config"
import { fetchSource } from "./newsnow"
import { dedupe, type DedupeCandidate } from "./dedupe"
import { summarizeBatch } from "./summarize"
import { synthesize } from "./tts"
import type { Env, FeedItem } from "./types"

/**
 * 归集管道（Cron 触发）：
 * 1. 并行拉取各源（newsnow /api/s）
 * 2. SimHash 标题去重聚类
 * 3. LLM 批量生成详讲播报稿
 * 4. TTS 预合成：标题播报 + 详讲两份音频 → R2
 * 5. 播报队列写 KV，供 /feed 消费
 */
export async function runPipeline(env: Env): Promise<{ clusters: number; feedSize: number }> {
  // 1. 并行拉源
  const sourceResults = await Promise.all(
    SOURCES.map(async (source) => {
      try {
        const items = await fetchSource(env, source)
        return items.map<DedupeCandidate>((item) => ({
          title: item.title,
          sourceName: source.name,
          weight: source.weight,
          publishedAt: Date.now(),
          url: item.url,
        }))
      } catch (e) {
        console.error(`source ${source.id} error`, e)
        return []
      }
    })
  )
  const candidates = sourceResults.flat()
  console.log(`fetched ${candidates.length} items from ${SOURCES.length} sources`)

  // 2. 去重聚类
  const clusters = dedupe(candidates).slice(0, MAX_FEED_SIZE)
  console.log(`deduped to ${clusters.length} clusters`)

  // 3. LLM 批量摘要
  const summaryMap = new Map<number, string>()
  for (let i = 0; i < clusters.length; i += SUMMARIZE_BATCH) {
    const batch = clusters.slice(i, i + SUMMARIZE_BATCH).map((c, j) => ({
      index: j,
      title: c.main.title,
      sources: [c.main.sourceName, ...c.alsoCoveredBy],
    }))
    const batchMap = await summarizeBatch(env, batch)
    for (const [idx, script] of batchMap) summaryMap.set(i + idx, script)
  }

  // 4. TTS 预合成（串行，避免触发限流；失败不阻塞整条流水线）
  const feed: FeedItem[] = []
  for (let i = 0; i < clusters.length; i++) {
    const cluster = clusters[i]
    const sources = [cluster.main.sourceName, ...cluster.alsoCoveredBy]
    const summary =
      summaryMap.get(i) ??
      `这条消息来自${sources.join("、")}：${cluster.main.title}。详细内容请稍后关注后续报道。`

    const item: FeedItem = {
      id: cluster.id,
      title: cluster.main.title,
      category: SOURCES.find((s) => s.name === cluster.main.sourceName)?.category ?? "社会",
      sources,
      url: cluster.main.url,
      summary,
      publishedAt: cluster.main.publishedAt,
    }

    // 标题音频
    const titleText = `${OPENING}${cluster.main.title}${
      cluster.alsoCoveredBy.length > 0 ? `，${cluster.alsoCoveredBy[0]} 等也有报道。` : ""
    }`
    const titleAudio = await synthesize(env, titleText)
    if (titleAudio) {
      await env.AUDIO.put(`t/${item.id}.mp3`, titleAudio, {
        httpMetadata: { contentType: "audio/mpeg" },
      })
      item.audioTitleKey = `t/${item.id}.mp3`
    }

    // 详讲音频
    const detailAudio = await synthesize(env, summary)
    if (detailAudio) {
      await env.AUDIO.put(`d/${item.id}.mp3`, detailAudio, {
        httpMetadata: { contentType: "audio/mpeg" },
      })
      item.audioDetailKey = `d/${item.id}.mp3`
    }

    feed.push(item)
  }

  // 5. 写 KV
  await env.FEED.put("feed", JSON.stringify({ updated: Date.now(), items: feed }))
  console.log(`feed written, ${feed.length} items`)
  return { clusters: clusters.length, feedSize: feed.length }
}

export { MAX_ITEMS_PER_SOURCE }
