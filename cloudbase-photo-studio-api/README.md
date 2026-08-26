# CloudBase 摄影店客服 API

这是当前 Vercel API 的 CloudBase HTTP 云函数版本。

## 接口

```text
GET  /health
GET  /api/photo-studio/knowledge
POST /api/photo-studio/chat
POST /api/photo-studio/leads
GET  /api/photo-studio/admin/leads
PATCH /api/photo-studio/admin/leads/:leadId
GET  /api/photo-studio/admin/stats
GET  /api/photo-studio/admin/unanswered
PATCH /api/photo-studio/admin/unanswered/:questionId
GET  /api/photo-studio/admin/knowledge
POST /api/photo-studio/admin/knowledge/faqs
PATCH /api/photo-studio/admin/knowledge/faqs/:faqId
POST /api/photo-studio/admin/knowledge/packages
PATCH /api/photo-studio/admin/knowledge/packages/:packageId
```

## 目录结构

```text
cloudbase-photo-studio-api/
├─ data/
│  ├─ faq.json
│  └─ packages.json
├─ ai/
│  ├─ prompt.js
│  └─ provider.js
├─ index.js
├─ package.json
├─ scf_bootstrap
├─ .env.example
└─ README.md
```

## 部署方式

1. 在 CloudBase 中选择中国大陆地域的环境。
2. 创建 HTTP 云函数。
3. 运行时选择 Node.js 18.x 或更高的 LTS 版本。
4. 将本目录中的文件打包上传，不要把父目录再套一层。
5. 在 CloudBase 控制台安装依赖，或先执行 `npm install` 后一起上传 `node_modules`。
6. 确认 HTTP 云函数监听 `9000` 端口。
7. 配置 HTTP 访问服务或自定义域名。

`scf_bootstrap` 必须没有扩展名，并且在 Linux 环境中需要可执行权限：

```bash
chmod +x scf_bootstrap
```

## 环境变量

```text
CLOUDBASE_ENV_ID=你的 CloudBase 环境 ID
CLOUDBASE_APIKEY=你的 CloudBase 服务端 API Key
DEFAULT_STUDIO_ID=demo-studio
CLOUDBASE_FAQ_COLLECTION=faqs
CLOUDBASE_PACKAGE_COLLECTION=packages
CLOUDBASE_LEAD_COLLECTION=leads
CLOUDBASE_CHAT_COLLECTION=chat_messages
CLOUDBASE_UNANSWERED_COLLECTION=unanswered_questions
FEISHU_BOT_WEBHOOK=你的飞书群机器人 Webhook
ADMIN_API_TOKEN=线索管理后台访问令牌
AI_ENABLED=false
AI_PROVIDER=volcengine
ARK_API_KEY=火山方舟服务端 API Key
ARK_MODEL=模型接入点 ID
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3/chat/completions
AI_TIMEOUT_MS=8000
AI_MAX_TOKENS=300
```

HTTP 云函数需要显式配置服务端鉴权。推荐在 CloudBase 的 API Key 管理中创建服务端 API Key，然后在云函数环境变量中配置 `CLOUDBASE_APIKEY`。

也可以使用腾讯云 `SecretId` 和 `SecretKey`，配置 `CLOUDBASE_SECRET_ID`、`CLOUDBASE_SECRET_KEY`。密钥只能放在 CloudBase 服务端环境变量中，不能提交到 GitHub，也不能放进抖音小程序。

部署后先访问 `/health`，确认：

```json
{
  "databaseConfigured": true,
  "cloudbase": {
    "envConfigured": true,
    "authConfigured": true
  }
}
```

如果 `databaseConfigured` 或 `authConfigured` 为 `false`，先修正环境变量，再测试线索和聊天接口。

### 跨域配置

浏览器管理后台的跨域设置在 CloudBase 的 HTTP 网关中完成。请将静态托管域名加入允许来源，并允许：

```text
允许来源：https://你的静态托管域名
允许请求头：X-Admin-Token, Content-Type
允许方法：GET, POST, PATCH, OPTIONS
```

本项目 API 不再额外返回 `Access-Control-Allow-Origin: *`，避免与 HTTP 网关的具体域名配置合并成无效的重复响应头。

### 线索管理接口

线索管理接口需要在请求头中携带：

```text
X-Admin-Token: 你的 ADMIN_API_TOKEN
```

查询线索：

```text
GET /api/photo-studio/admin/leads?studioId=demo-studio&status=all
```

更新状态或内部备注：

```text
PATCH /api/photo-studio/admin/leads/{_id}
Content-Type: application/json

{
  "status": "contacted",
  "staffNote": "已通过电话联系客户"
}
```

允许的状态值：

```text
new
contacted
booked
completed
invalid
```

请勿将 `ADMIN_API_TOKEN` 写入抖音小程序或提交到 GitHub。

### AI 增强客服

AI 功能默认关闭。开启前，先确认 FAQ、套餐和门店规则已经在 CloudBase 中维护完整：

```text
AI_ENABLED=true
AI_PROVIDER=volcengine
ARK_API_KEY=你的服务端 API Key
ARK_MODEL=你的模型接入点 ID
```

模型密钥只能配置在 CloudBase HTTP 云函数环境变量中，不能放进抖音小程序、静态管理后台或 GitHub。

聊天接口会先根据当前问题和最近对话，对 FAQ、套餐做轻量相关性检索，只把最相关的最多 4 条 FAQ 和 3 个套餐发送给模型。模型被要求只能基于相关门店资料回答，并主动推荐、追问和识别客户意向；模型未配置、超时、报错或返回 `NEED_HUMAN` 时，自动回退到现有 FAQ/套餐规则回复。

小程序聊天请求可额外传入：

```json
{
  "studioId": "demo-studio",
  "sessionId": "douyin-demo-001",
  "message": "两个人拍婚纱照多少钱？",
  "history": [
    {
      "role": "user",
      "content": "你们有什么婚纱照套餐？"
    },
    {
      "role": "assistant",
      "content": "目前有轻奢婚纱照套餐，价格 ¥3999 起。"
    }
  ]
}
```

响应中的 `ai` 字段用于测试和监控。AI 成功时还会返回意图、线索阶段和提取到的客户信息：

```json
{
  "enabled": true,
  "configured": true,
  "used": true,
  "fallback": false,
  "provider": "volcengine",
  "latencyMs": 820,
  "structured": true,
  "intent": "price_consultation",
  "leadStage": "interested",
  "lead": {
    "serviceType": "婚纱照",
    "budget": "5000",
    "preferredDate": "",
    "name": "",
    "contact": ""
  },
  "followUpQuestion": "你预计什么时候拍摄呢？"
}
```

聊天记录会增加 `aiEnabled`、`aiUsed`、`aiFallback`、`aiProvider`、`aiLatencyMs`、`aiIntent`、`aiLeadStage`、`aiLead`、`aiFollowUpQuestion`、`aiLeadCaptureEligible`、`aiLeadStored`、`aiLeadDeduplicated`、`aiLeadId`、`aiLeadNotificationSent` 和 `knowledgeContext` 字段。运营统计接口会返回 `aiAnsweredChats`、`aiFallbackChats` 和 `highIntentChats`。

当 AI 判断客户为 `high_intent` 且提取到联系方式时，聊天接口会自动创建一条 `leads` 记录，来源为 `douyin-miniapp-ai`，并发送飞书通知。相同 `studioId + sessionId + source` 的后续消息不会重复创建线索。只有数据库保存成功后，客服才会回复“已记录预约意向”；如果没有联系方式或保存失败，不会虚假承诺已经登记。

聊天响应中的 `leadCapture` 字段示例：

```json
{
  "eligible": true,
  "stored": true,
  "deduplicated": false,
  "id": "lead-document-id",
  "notification": {
    "sent": true
  }
}
```

建议先使用 50 个真实问题做灰度测试，重点检查价格、套餐内容、档期、定金和退款等问题，确认回答准确后再面向全部用户开启。

### 知识库管理接口

查询 FAQ 和套餐：

```text
GET /api/photo-studio/admin/knowledge?studioId=demo-studio&type=all
```

FAQ 必填字段：

```json
{
  "category": "婚纱照",
  "keywords": ["婚纱", "婚照"],
  "answer": "客服回复内容"
}
```

套餐必填字段：

```json
{
  "name": "轻奢婚纱照",
  "category": "婚纱照",
  "price": "¥3999 起",
  "items": ["2 套服装造型", "80 张底片"],
  "description": "套餐说明"
}
```

知识库不提供删除接口，使用 `enabled: false` 停用内容，避免误删历史配置。

### 运营统计接口

统计接口需要携带 `X-Admin-Token`：

```text
GET /api/photo-studio/admin/stats?studioId=demo-studio
```

返回字段包括：

```text
totalChats              咨询次数
totalLeads              线索总数
newLeads                新线索
contactedLeads          已联系线索
bookedLeads             已预约线索
completedLeads          已完成线索
humanRequiredChats      待人工处理的聊天数
faqMatchedChats         FAQ 命中次数
packageMatchedChats     单个套餐命中次数
packageListChats        套餐列表命中次数
aiAnsweredChats         AI 成功回答次数
aiFallbackChats         AI 开启但回退到规则回复的次数
totalUnanswered         未匹配问题总数
openUnanswered          待处理未匹配问题数
conversionRate          已预约线索 / 总线索的百分比
```

### 未匹配问题接口

当聊天没有命中 FAQ 或套餐时，接口会把问题写入 `unanswered_questions` 集合。相同 `studioId + questionKey + open` 的问题会自动合并并累加 `count`。

查询未匹配问题：

```text
GET /api/photo-studio/admin/unanswered?studioId=demo-studio&status=open
```

`status` 可选值：

```text
open
reviewed
resolved
ignored
all
```

更新处理状态或内部备注：

```text
PATCH /api/photo-studio/admin/unanswered/{_id}
Content-Type: application/json

{
  "status": "resolved",
  "staffNote": "已补充到 FAQ"
}
```

这些问题用于反向完善知识库：高频问题应优先补充到 FAQ 或套餐，补充后再标记为 `resolved`。

## 数据库集合

创建以下集合：

```text
faqs
packages
leads
chat_messages
unanswered_questions
```

FAQ 和套餐数据可以先使用项目中的 `data/faq.json`、`data/packages.json` 作为回退数据。正式使用时，在每条 FAQ 和套餐记录中添加：

```text
studioId
enabled: true
```

线索会写入 `leads` 集合，聊天记录会写入 `chat_messages` 集合。所有正式查询都应带 `studioId`，为后续多租户 SaaS 做数据隔离准备。

未匹配问题会写入 `unanswered_questions` 集合，建议和其他业务集合一样设置为 `无权限 [ADMINONLY]`，只允许服务端 API 读写，避免小程序或浏览器直接操作数据库。

当 CloudBase 已配置但集合为空时，API 会返回空知识库；只有未配置数据库或读取失败时才使用本地 JSON 回退数据。这样停用全部 FAQ 或套餐后不会重新出现示例内容。

客服聊天会同时读取 FAQ 和套餐：

- 用户询问具体套餐或价格时，优先返回匹配套餐的名称、价格和包含内容。
- 用户询问“有哪些套餐”时，返回当前启用套餐列表。
- 预约、交付、门店规则等问题仍由 FAQ 优先回答。
- 聊天接口返回 `matchedPackageId`，并写入 `chat_messages`，便于后续统计套餐咨询量。

## 修改抖音小程序地址

将：

```js
const API_BASE_URL = "https://你的后端域名"
```

配置为 CloudBase 的默认 HTTP 域名或自己的 HTTPS 域名，例如：

```js
const API_BASE_URL = "https://api.example.com"
```

小程序合法域名只填写：

```text
api.example.com
```

不要填写协议、接口路径、端口或末尾斜杠。
