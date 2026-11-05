import type { Env } from "./types"

/**
 * LLM 批量摘要（OpenAI 兼容接口：DeepSeek / GLM 均可直接用）
 * 每批 8 条打包总结，输出 JSON，成本极低。
 * 摘要即"详讲播报稿"：口播风格，150~250 字，自动带上多源佐证。
 */

export interface SummaryRequest {
  index: number
  title: string
  sources: string[]
}

export async function summarizeBatch(
  env: Env,
  items: SummaryRequest[]
): Promise<Map<number, string>> {
  if (items.length === 0) return new Map()

  const prompt = `你是一位中文新闻播报编辑。下面是一组新闻标题（部分有多个来源）。请为每条生成一段「口播详讲稿」：
- 100~200 字，口语化，适合 TTS 朗读
- 基于你的知识补充背景信息；不确定的内容不要编造具体数字
- 如果该新闻有多个来源，结尾加一句「${items[0].sources.length > 1 ? "多家媒体均有报道" : ""}」类表述（仅当来源≥2条时）
- 只输出 JSON 数组，格式 [{"index":0,"script":"..."},...]，不要输出其他任何文字

新闻列表：
${items.map((it) => `${it.index}. 标题：${it.title}（来源：${it.sources.join("、")}）`).join("\n")}`

  const resp = await fetch(`${env.LLM_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.LLM_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      response_format: { type: "json_object" },
    }),
  })
  if (!resp.ok) {
    console.error(`LLM failed: ${resp.status} ${await resp.text()}`)
    return new Map()
  }
  const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] }
  const content = data.choices?.[0]?.message?.content ?? ""
  try {
    // 兼容裸数组或 {"items":[...]} 两种返回
    const parsed = JSON.parse(content)
    const arr: { index: number; script: string }[] = Array.isArray(parsed)
      ? parsed
      : (parsed.items ?? parsed.results ?? [])
    return new Map(arr.map((x) => [x.index, x.script]))
  } catch {
    console.error("LLM JSON parse failed:", content.slice(0, 200))
    return new Map()
  }
}
