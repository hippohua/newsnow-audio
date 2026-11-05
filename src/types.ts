/** newsnow /api/s 返回的单条数据 */
export interface NewsnowItem {
  id: string
  title: string
  url: string
  extra?: string
}

/** 中间层归一化后的新闻条目 */
export interface FeedItem {
  id: string // 稳定 ID：simhash 值 hex，同事件多源共用一个簇 ID
  title: string // 主条目标题（保留最早来源的）
  category: Category
  sources: string[] // 所有报道该事件的来源名（播报时口播提及）
  url: string // 主条目链接
  summary: string // LLM 摘要（详讲播报稿）
  publishedAt: number
  // 播报音频（R2 对象 key，App 拼接 /audio/ 前缀）
  audioTitleKey?: string
  audioDetailKey?: string
}

export type Category = "科技" | "财经" | "时政" | "社会" | "国际" | "汽车" | "体育" | "娱乐"

export interface Env {
  AUDIO: R2Bucket
  FEED: KVNamespace
  NEWSNOW_BASE: string
  LLM_BASE_URL: string
  LLM_MODEL: string
  LLM_API_KEY: string
  TTS_PROVIDER: string
  TTS_VOICE: string
  TTS_SPEED_TITLE: string
  TTS_API_KEY: string
  RUN_TOKEN: string
}

/** 源配置：newsnow 源 ID → 类别 / 显示名 / 优先级 */
export interface SourceConfig {
  id: string // newsnow 的 source id
  name: string // 显示名
  category: Category
  weight: number // 数字越小优先级越高（去重"高权重优先"策略用）
}
