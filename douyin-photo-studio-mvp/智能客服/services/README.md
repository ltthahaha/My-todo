# API 配置说明

当前小程序已经接入 CloudBase HTTP API。不同摄影店复制这份小程序模板时，只需要修改统一配置文件：

```text
config/studio.js
```

示例：

```js
const studioConfig = {
  studioId: "demo-studio",
  studioName: "映白摄影",
  douyinAppId: "tt428a3437dcf0288901",
  apiBaseUrl: "https://你的 CloudBase HTTP 网关域名"
}
```

`services/api.js` 会自动把 `studioId` 和 `douyinAppId` 带到 `/auth/login`、`/chat`、`/leads`。不要再在业务页面里硬编码门店 ID。

每家摄影店如果使用独立抖音小程序，还需要同步修改 `project.config.json` 中的 `appid`，并在 CloudBase 数据库 `studios` 集合中创建对应记录。

后端需要提供：

```text
POST /api/photo-studio/auth/login
POST /api/photo-studio/auth/profile
POST /api/photo-studio/chat
POST /api/photo-studio/leads
```

`/api/photo-studio/chat` 会读取当前 `studioId` 下的 FAQ、套餐、聊天上下文，并按配置调用 AI。
`/api/photo-studio/leads` 会校验线索，保存到 CloudBase，并在配置 `FEISHU_BOT_WEBHOOK` 后推送到飞书群机器人。

客服页的“同步抖音资料”按钮会在用户点击后调用 `tt.getUserProfile()`。授权成功后，小程序会把昵称和头像提交到 `/api/photo-studio/auth/profile`，后台客户工作台和线索管理会显示 `douyinNickName`、`douyinAvatarUrl`。用户取消授权时，咨询和预约流程继续按匿名客户处理。

客服请求示例：

```json
{
  "studioId": "demo-studio",
  "douyinAppId": "tt428a3437dcf0288901",
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
  "douyinAppId": "tt428a3437dcf0288901",
  "name": "李小姐",
  "contact": "13800000000",
  "serviceType": "婚纱照",
  "preferredDate": "2026-09-20",
  "budget": "5000",
  "note": "想拍法式外景",
  "source": "douyin-miniapp"
}
```

不要把大模型 API Key、抖音 AppSecret、飞书 App Secret 或群机器人 Webhook 写入小程序前端。
