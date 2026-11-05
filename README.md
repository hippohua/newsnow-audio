# newsnow-audio

听新闻 App 的中间层：newsnow 拉取 → SimHash 去重 → LLM 摘要 → TTS 预合成 → R2 存储。

对接 [newsnow](https://github.com/ourongxing/newsnow) 的数据接口，为安卓听新闻 App 提供「先听标题、感兴趣再详讲」的播报队列。

## 接口

| 接口 | 方法 | 说明 |
|---|---|---|
| `/feed` | GET | 播报队列。`?limit=30` 限量。每条含 `audioTitle`（标题播报）和 `audioDetail`（详讲播报）两个 MP3 URL |
| `/audio/<key>` | GET | 音频流，key 形如 `t/<id>.mp3`（标题）或 `d/<id>.mp3`（详讲） |
| `/run` | POST | 手动触发归集。Header：`Authorization: Bearer <RUN_TOKEN>` |
| `/health` | GET | 健康检查 |

`/feed` 返回示例：

```json
{
  "status": "success",
  "updated": 1730790000000,
  "items": [
    {
      "id": "a1b2...",
      "title": "英伟达Q3财报超预期",
      "category": "财经",
      "sources": ["华尔街见闻", "财联社电报"],
      "summary": "（LLM 生成的口播详讲稿）",
      "audioTitle": "https://newsnow-audio.xxx.workers.dev/audio/t/a1b2....mp3",
      "audioDetail": "https://newsnow-audio.xxx.workers.dev/audio/d/a1b2....mp3"
    }
  ]
}
```

## 部署步骤

```bash
cd newsnow-audio
npm install

# 1. 建 R2 桶并配 7 天生命周期
npx wrangler r2 bucket create newsnow-audio
# 生命周期规则在 Cloudflare 控制台 R2 → Settings → Object lifecycle 配置（7 天删除）

# 2. 建 KV
npx wrangler kv namespace create FEED
# 把输出的 id 填到 wrangler.toml 的 KV id

# 3. 改 wrangler.toml 里的 NEWSNOW_BASE 为你的 newsnow workers.dev 地址

# 4. 配置密钥
npx wrangler secret put LLM_API_KEY    # DeepSeek 或 GLM API Key
npx wrangler secret put TTS_API_KEY    # 阿里云 DashScope API Key（开通 qwen-tts 模型）
npx wrangler secret put RUN_TOKEN      # 随便一个长随机字符串

# 5. 部署
npm run deploy

# 6. 首次手动跑一次验证
curl -X POST https://newsnow-audio.<你的域名>.workers.dev/run -H "Authorization: Bearer <RUN_TOKEN>"

# 7. 看实时日志排障
npm run tail
```

## 本地调试

```bash
npm run dev
# 本地跑通 TTS/LLM 可以用 Edge-TTS 生成测试音频替换，先验证整条链路
curl -X POST http://localhost:8787/run -H "Authorization: Bearer dev-token"
```

## 成本预估（每日 2 次归集）

| 项 | 估算 |
|---|---|
| Cloudflare Workers/R2/KV | 0 元（免费额度内） |
| LLM 摘要（DeepSeek，80 条×2） | < 0.5 元/天 |
| TTS（DashScope qwen-tts，约 10 万字符/天） | 几元/天（新用户有免费额度） |

## 后续迭代（对应 P3/P4）

- `/prefs` 接口：App 端上报内容源排序 / 类别排序 / 去重策略（存 KV，归集时读取）
- 音频合成按用户偏好差异化（类别顺序影响队列顺序，TTS 不用重做）
- 车载模式：App 端蓝牙监听，服务端无需改动
