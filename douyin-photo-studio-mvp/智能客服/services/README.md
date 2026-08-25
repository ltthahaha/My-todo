# API 配置说明

当前小程序默认使用本地模拟数据，方便在没有后端时编译和演示。

正式接入后端时，修改 `services/api.js`：

```js
const API_BASE_URL = "https://你的后端域名"
```

后端需要提供：

```text
POST /api/photo-studio/chat
POST /api/photo-studio/leads
```

当前项目根目录已经提供可联调的 Vercel API：

```text
api/photo-studio/chat.js
api/photo-studio/leads.js
```

`/api/photo-studio/chat` 当前使用 `data/faq.json` 做稳定的知识库匹配，暂未接入大模型。
`/api/photo-studio/leads` 会校验线索，并在配置 `FEISHU_BOT_WEBHOOK` 后推送到飞书群机器人。

客服请求示例：

```json
{
  "studioId": "demo-studio",
  "sessionId": "session-001",
  "message": "婚纱照多少钱？"
}
```

客服响应示例：

```json
{
  "reply": "婚纱照轻奢套餐 ¥3999 起……",
  "matchedFaqId": "wedding",
  "needHuman": false,
  "leadIntent": true
}
```

预约线索请求示例：

```json
{
  "studioId": "demo-studio",
  "name": "李小姐",
  "contact": "13800000000",
  "serviceType": "婚纱照",
  "preferredDate": "2026-09-20",
  "budget": "5000",
  "note": "想拍法式外景",
  "source": "douyin-miniapp"
}
```

不要把大模型 API Key、飞书 App Secret 或群机器人 Webhook 写入小程序前端。
