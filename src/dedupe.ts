/**
 * 标题去重：SimHash（字符 bigram）+ 汉明距离聚类
 * 同一事件被多个源报道 → 标题高度相似 → 聚成一个簇，只播主条目
 */

const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193

function fnv1a(str: string): number {
  let h = FNV_OFFSET
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, FNV_PRIME)
  }
  return h >>> 0
}

/** 归一化：去标点/空白/全角转半角/小写 */
function normalize(title: string): string {
  return title
    .replace(/[\p{P}\p{S}\s]+/gu, "")
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .toLowerCase()
}

/** SimHash 主函数（64 位，用两个 32 位整数存） */
export function simhash(title: string): [number, number] {
  const text = normalize(title)
  const v: number[] = new Array(64).fill(0)
  for (let i = 0; i < text.length - 1; i++) {
    const gram = text.slice(i, i + 2)
    const h1 = fnv1a(gram)
    const h2 = fnv1a(gram + "#") // 第二个哈希凑 64 位
    for (let b = 0; b < 32; b++) {
      const mask = 1 << b
      v[b] += h1 & mask ? 1 : -1
      v[b + 32] += h2 & mask ? 1 : -1
    }
  }
  let hi = 0
  let lo = 0
  for (let b = 0; b < 32; b++) {
    if (v[b] > 0) lo |= 1 << b
    if (v[b + 32] > 0) hi |= 1 << b
  }
  return [hi, lo]
}

function hamming([a1, a2]: [number, number], [b1, b2]: [number, number]): number {
  let d = 0
  let x = a1 ^ b1
  x = x - ((x >> 1) & 0x55555555)
  x = (x & 0x33333333) + ((x >> 2) & 0x33333333)
  d += ((x + (x >> 4) & 0x0f0f0f0f) * 0x01010101) >>> 24
  let y = a2 ^ b2
  y = y - ((y >> 1) & 0x55555555)
  y = (y & 0x33333333) + ((y >> 2) & 0x33333333)
  d += ((y + (y >> 4) & 0x0f0f0f0f) * 0x01010101) >>> 24
  return d
}

export interface DedupeCandidate {
  title: string
  sourceName: string
  weight: number
  publishedAt: number
  url: string
}

export interface Cluster {
  /** 簇 ID = 主条目 simhash 的 hex */
  id: string
  main: DedupeCandidate
  /** 其余来源（播报时口播提及「XX 等也有报道」） */
  alsoCoveredBy: string[]
}

/**
 * 贪心聚类：O(n²)，n≈160 条（8 源 × 20 条）完全够用
 * 主条目选取策略：先按源权重（用户排的源顺序），再按发布时间
 */
export function dedupe(candidates: DedupeCandidate[]): Cluster[] {
  const entries = candidates.map((c) => ({ ...c, hash: simhash(c.title) }))
  const used = new Set<number>()
  const clusters: Cluster[] = []

  for (let i = 0; i < entries.length; i++) {
    if (used.has(i)) continue
    const main = entries[i]
    const alsoCoveredBy: string[] = []
    for (let j = i + 1; j < entries.length; j++) {
      if (used.has(j)) continue
      const other = entries[j]
      if (hamming(main.hash, other.hash) <= 3) {
        used.add(j)
        if (!alsoCoveredBy.includes(other.sourceName)) alsoCoveredBy.push(other.sourceName)
      }
    }
    clusters.push({
      id: main.hash.map((n) => n.toString(16).padStart(8, "0")).join(""),
      main,
      alsoCoveredBy,
    })
  }
  return clusters
}
