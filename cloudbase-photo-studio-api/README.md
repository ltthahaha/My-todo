# CloudBase 摄影店客服 API

这是当前 Vercel API 的 CloudBase HTTP 云函数版本。

## 接口

```text
GET  /health
GET  /api/photo-studio/knowledge
POST /api/photo-studio/chat
POST /api/photo-studio/leads
POST /api/photo-studio/auth/login
POST /api/photo-studio/auth/profile
GET  /api/photo-studio/admin/leads
PATCH /api/photo-studio/admin/leads/:leadId
GET  /api/photo-studio/admin/customers
GET  /api/photo-studio/admin/customers/:customerKey
PATCH /api/photo-studio/admin/customers/:customerKey/state
POST /api/photo-studio/admin/auth/login
GET  /api/photo-studio/admin/auth/me
POST /api/photo-studio/admin/auth/logout
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
DEFAULT_STUDIO_NAME=映白摄影
CLOUDBASE_STUDIO_COLLECTION=studios
CLOUDBASE_FAQ_COLLECTION=faqs
CLOUDBASE_PACKAGE_COLLECTION=packages
CLOUDBASE_LEAD_COLLECTION=leads
CLOUDBASE_CHAT_COLLECTION=chat_messages
CLOUDBASE_CHAT_SESSION_COLLECTION=chat_sessions
CLOUDBASE_UNANSWERED_COLLECTION=unanswered_questions
CLOUDBASE_DOUYIN_USER_COLLECTION=douyin_users
CLOUDBASE_ADMIN_USER_COLLECTION=admin_users
CLOUDBASE_CUSTOMER_STATE_COLLECTION=customer_states
DOUYIN_APP_ID=tt428a3437dcf0288901
DOUYIN_APP_SECRET=抖音小程序 AppSecret
DOUYIN_APP_SECRETS={"tt428a3437dcf0288901":"抖音小程序 AppSecret"}
DOUYIN_AUTH_TOKEN_SECRET=用于签发小程序用户 token 的随机密钥
FEISHU_BOT_WEBHOOK=你的飞书群机器人 Webhook
ADMIN_API_TOKEN=线索管理后台访问令牌
ADMIN_SESSION_SECRET=用于签发后台登录 session 的随机密钥
ADMIN_SESSION_TTL_SECONDS=604800
AI_ENABLED=false
AI_PROVIDER=volcengine
ARK_API_KEY=火山方舟服务端 API Key
ARK_MODEL=模型接入点 ID
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3/chat/completions
AI_THINKING_TYPE=enabled
AI_TIMEOUT_MS=6000
AI_MAX_TOKENS=512
# 排查模型返回格式时临时开启；确认问题后建议关闭
AI_DEBUG_RAW_RESPONSE=false
```

HTTP 云函数需要显式配置服务端鉴权。推荐在 CloudBase 的 API Key 管理中创建服务端 API Key，然后在云函数环境变量中配置 `CLOUDBASE_APIKEY`。

也可以使用腾讯云 `SecretId` 和 `SecretKey`，配置 `CLOUDBASE_SECRET_ID`、`CLOUDBASE_SECRET_KEY`。密钥只能放在 CloudBase 服务端环境变量中，不能提交到 GitHub，也不能放进抖音小程序。

### 门店和抖音 AppID 绑定

多店模式下，后端用 `studioId + douyinAppId` 判断请求属于哪家摄影店。CloudBase 需要创建 `studios` 集合，每家店一条记录：

```json
{
  "studioId": "demo-studio",
  "name": "映白摄影",
  "status": "active",
  "douyinAppId": "tt428a3437dcf0288901",
  "apiEnabled": true
}
```

每家店如果使用独立小程序，就把 AppID 对应的 AppSecret 配到 `DOUYIN_APP_SECRETS`：

```text
DOUYIN_APP_SECRETS={"tt428a3437dcf0288901":"secret1","tt另一家AppID":"secret2"}
```

单店测试可以继续使用 `DOUYIN_APP_ID` 和 `DOUYIN_APP_SECRET`。多店正式使用时，建议以 `studios` 集合为准，并让 `admin_users.studioId`、小程序 `config/studio.js` 中的 `studioId` 保持一致。

### 抖音用户身份

小程序端会调用 `tt.login()` 获取临时 `code`，再请求：

```text
POST /api/photo-studio/auth/login
```

服务端根据请求中的 `douyinAppId` 找到对应 AppSecret，换取抖音 `openid`，生成内部 `userId` 和签名 `userToken`。后续 `/chat` 和 `/leads` 请求会自动携带 `userId`、`userToken`、`anonymousId`，数据库中的 `chat_sessions`、`chat_messages`、`leads` 会写入这些字段。

如果用户在小程序客服页点击“同步抖音资料”，前端会通过 `tt.getUserProfile()` 获取用户授权后的昵称和头像，再请求：

```text
POST /api/photo-studio/auth/profile
```

后端会校验 `userId + userToken`，并把 `douyinNickName`、`douyinAvatarUrl`、`profileUpdatedAt` 保存到 `douyin_users`。后续聊天和预约请求会把昵称头像带入 `chat_sessions`、`chat_messages`、`leads`，后台客户工作台会优先展示真实姓名，其次展示抖音昵称。用户拒绝授权时，不影响聊天和预约提交。

CloudBase 需要额外创建集合：

```text
douyin_users
studios
customer_states
```

`DOUYIN_AUTH_TOKEN_SECRET` 建议填写一段 32 位以上随机字符串。如果不配置，会回退使用 `ADMIN_API_TOKEN`，但正式环境建议单独配置。

### 后台账号登录

CloudBase 需要额外创建集合：

```text
admin_users
```

第一版先手动在 `admin_users` 集合插入门店账号：

```json
{
  "userId": "admin_demo_owner",
  "studioId": "demo-studio",
  "email": "owner@example.com",
  "name": "店主",
  "role": "owner",
  "status": "active",
  "passwordHash": "pbkdf2$120000$盐值$哈希值"
}
```

在 PowerShell 中生成 `passwordHash`：

```powershell
$password = "你的登录密码"
$saltBytes = New-Object byte[] 16
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($saltBytes)
$salt = -join ($saltBytes | ForEach-Object { "{0:x2}" -f $_ })
$pbkdf2 = New-Object System.Security.Cryptography.Rfc2898DeriveBytes($password, $saltBytes, 120000, "SHA256")
$hashBytes = $pbkdf2.GetBytes(32)
$hash = -join ($hashBytes | ForEach-Object { "{0:x2}" -f $_ })
"pbkdf2`$120000`$$salt`$$hash"
```

输出必须包含四段：`pbkdf2`、迭代次数、32 位 salt、64 位 hash。最后一段 hash 不能为空。

后台登录成功后，前端会保存短期 session token 到当前浏览器标签页的 `sessionStorage`，后续请求使用：

```text
Authorization: Bearer 后台登录 token
```

`ADMIN_API_TOKEN` 仍作为应急后门保留，但正式运营应使用账号登录。

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
允许请求头：Authorization, X-Admin-Token, Content-Type
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
AI_THINKING_TYPE=enabled
AI_MAX_TOKENS=512
AI_DEBUG_RAW_RESPONSE=false
```

模型密钥只能配置在 CloudBase HTTP 云函数环境变量中，不能放进抖音小程序、静态管理后台或 GitHub。

聊天接口会先恢复 `chat_sessions` 中的会话状态，再根据当前问题和历史对 FAQ、套餐做轻量相关性检索。业务咨询默认由 AI 组织最终回复，FAQ 和套餐只作为知识上下文；模型未配置、超时、报错或返回格式无法解析时，自动回退到销售话术。用户明确提出预约时进入确定性预约工作流：服务端会结合已保存的目的地、日期、同行人数、预算和联系方式继续追问或提交线索，不依赖模型决定是否登记。为适配 CloudBase HTTP 云函数 15 秒上限，AI 请求默认最多等待 6 秒，代码会将环境变量中的上限限制在 7 秒以内。

当需要排查模型返回格式时，可在 CloudBase 云函数环境变量中临时设置 `AI_DEBUG_RAW_RESPONSE=true`。日志会输出 HTTP 状态、模型、完成原因、提取文本长度和最多 6000 个字符的响应片段；不会输出 API Key。排查完成后应恢复为 `false`，避免日志保存客户对话内容。

`AI_THINKING_TYPE` 支持 `enabled`、`auto`、`disabled`。当前摄影客服默认使用 `enabled`，模型可以先完成内部分析，但服务端只会读取最终 `message.content`，不会把 `reasoning_content` 返回给小程序。若需要优先降低延迟，可改为 `auto` 或 `disabled`；无论哪种模式，都建议保留 `AI_MAX_TOKENS=512`，避免最终答案被思考过程挤掉。

请在 CloudBase 数据库中创建 `chat_sessions` 集合。聊天接口会自动创建或更新会话文档，保存最近对话和结构化字段（服务类型、目的地、意向日期、同行人数、预算、联系方式、当前待补字段）。如果不创建该集合，聊天仍可运行，但页面重进后无法从服务端恢复上下文。

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

聊天响应会返回会话诊断信息，便于确认上下文是否保存：

```json
{
  "answerSource": "workflow",
  "matchType": "booking",
  "session": {
    "stored": true,
    "historyCount": 8,
    "state": {
      "serviceType": "旅拍",
      "destination": "西安",
      "preferredDate": "十月份",
      "groupSize": "2人",
      "pendingField": "contact"
    }
  }
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

## 修改抖音小程序配置

小程序端统一修改：

```text
douyin-photo-studio-mvp/智能客服/config/studio.js
```

示例：

```js
const studioConfig = {
  studioId: "demo-studio",
  studioName: "映白摄影",
  douyinAppId: "tt428a3437dcf0288901",
  apiBaseUrl: "https://api.example.com"
}
```

如果每家店使用独立小程序，还要同步修改 `project.config.json` 中的 `appid`。

抖音小程序合法域名只填写：

```text
api.example.com
```

不要填写协议、接口路径、端口或末尾斜杠。
