import type { Env } from "./types"

/**
 * TTS 合成。
 * Provider: dashscope（qwen-tts，OpenAI 兼容格式，返回音频 URL）
 *   文档：https://help.aliyun.com/zh/model-studio/qwen-tts
 * 音色：Cherry（女声播报感）/ Ethan（男声）等，可在 wrangler.toml 换
 */
export async function synthesize(env: Env, text: string): Promise<ArrayBuffer | null> {
  if (!text.trim()) return null

  if (env.TTS_PROVIDER === "dashscope") {
    return synthesizeDashscope(env, text)
  }
  // 未来可扩展讯飞 / Edge-TTS 降级通道
  throw new Error(`Unknown TTS provider: ${env.TTS_PROVIDER}`)
}

async function synthesizeDashscope(env: Env, text: string): Promise<ArrayBuffer | null> {
  // qwen-tts 走 DashScope 兼容模式；返回消息里带 audio.url，再下载二进制
  const resp = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.TTS_API_KEY}`,
    },
    body: JSON.stringify({
      model: "qwen-tts",
      messages: [{ role: "user", content: text }],
      audio: { voice: env.TTS_VOICE, format: "mp3" },
    }),
  })
  if (!resp.ok) {
    console.error(`TTS failed: ${resp.status} ${await resp.text()}`)
    return null
  }
  const data = (await resp.json()) as {
    choices?: { message?: { audio?: { url?: string } } }[]
  }
  const audioUrl = data.choices?.[0]?.message?.audio?.url
  if (!audioUrl) return null
  const audioResp = await fetch(audioUrl)
  if (!audioResp.ok) {
    console.error(`TTS audio download failed: ${audioResp.status}`)
    return null
  }
  return audioResp.arrayBuffer()
}
