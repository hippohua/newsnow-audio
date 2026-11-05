import type { SourceConfig } from "./types"

/**
 * 内容源配置（对应设计稿「内容源排序与去重」页）
 * 顺序即默认播报优先级；用户在 App 端可自行调整，此处为服务端默认值。
 */
export const SOURCES: SourceConfig[] = [
  { id: "wallstreetcn-news", name: "华尔街见闻", category: "财经", weight: 10 },
  { id: "36kr", name: "36氪", category: "科技", weight: 20 },
  { id: "zhihu", name: "知乎热榜", category: "社会", weight: 30 },
  { id: "bilibili-hot-search", name: "B站热搜", category: "社会", weight: 40 },
  { id: "weibo", name: "微博热搜", category: "社会", weight: 50 },
  { id: "ithome", name: "IT之家", category: "科技", weight: 60 },
  { id: "cls-telegraph", name: "财联社电报", category: "财经", weight: 70 },
  { id: "solidot", name: "Solidot", category: "科技", weight: 80 },
]

/** 每源最多取条数（热榜前 N 条） */
export const MAX_ITEMS_PER_SOURCE = 20
/** 播报队列总上限 */
export const MAX_FEED_SIZE = 40
/** LLM 每批总结条数 */
export const SUMMARIZE_BATCH = 8
/** 标题音频前缀话术 */
export const OPENING = "接下来这条消息。"
