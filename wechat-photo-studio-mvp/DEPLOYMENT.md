# 微信小程序 AI 客服联调说明

本目录是独立的微信小程序版本，与 `douyin-photo-studio-mvp` 分开维护。当前流程为：

```text
微信小程序 → AI 客服 → FAQ/套餐知识库 → CloudBase 聊天记录/线索 → 飞书通知 → 管理后台
```

当前不包含支付、下单、定金、锁档或自动确认预约；具体服务内容和拍摄时间以门店顾问确认结果为准。

## 1. 用微信开发者工具打开

打开本目录：

```text
wechat-photo-studio-mvp
```

项目配置已设置：

```text
AppID: wxdb93d05dc105b2a2
```

如果开发者工具提示 AppID 不属于当前账号，需要使用已绑定该小程序的微信开发者账号登录。

## 2. 配置门店

修改 `config/studio.js`：

```js
const studioConfig = {
  studioId: "xian-west-photo",
  studioName: "西区摄影",
  wechatAppId: "wxdb93d05dc105b2a2",
  apiBaseUrl: "https://你的 CloudBase HTTP 网关域名"
}
```

`apiBaseUrl` 只填写域名根地址，不要追加 `/api`。

正式多门店使用时，在 CloudBase `studios` 集合为每家门店配置：

```json
{
  "studioId": "xian-west-photo",
  "name": "西区摄影",
  "status": "active",
  "wechatAppId": "wxdb93d05dc105b2a2",
  "apiEnabled": true
}
```

## 3. CloudBase 服务端环境变量

在 HTTP 云函数中配置，不要写进小程序：

```text
CLOUDBASE_ENV_ID=你的环境ID
CLOUDBASE_APIKEY=服务端 API Key
WECHAT_APP_ID=wxdb93d05dc105b2a2
WECHAT_APP_SECRET=微信公众平台 AppSecret
WECHAT_APP_SECRETS={"wxdb93d05dc105b2a2":"对应AppSecret"}
WECHAT_AUTH_TOKEN_SECRET=32位以上随机字符串
WECHAT_ALLOW_ANONYMOUS=false
DOUYIN_AUTH_TOKEN_SECRET=32位以上随机字符串
FEISHU_BOT_WEBHOOK=飞书群机器人 Webhook
AI_ENABLED=true
ARK_API_KEY=服务端模型密钥
ARK_MODEL=模型接入点ID
```

`WECHAT_APP_SECRET`、模型密钥和 Webhook 只能放在服务端，不能提交到 GitHub。

正式环境必须配置 `WECHAT_APP_SECRET` 和 `WECHAT_AUTH_TOKEN_SECRET`。服务端会通过 `wx.login()` 换取微信用户标识，生成 `wechat_...` 用户 ID，并写入 `wechat_users`。只有临时联调时，才同时设置 `WECHAT_ALLOW_ANONYMOUS=true`；联调结束必须恢复为 `false`，否则匿名请求可以伪造客户身份写入线索。

如果聊天响应中的 `ai.used` 为 `false` 且 `ai.fallback` 为 `true`，请先看 `ai.fallbackReason`。当前后端会区分供应商 HTTP 错误：`HTTP 401` 通常表示 API Key 无效或已过期，`HTTP 400` 通常表示模型接入点、请求参数或 `thinking` 配置不匹配，`HTTP 404` 通常表示接口地址或模型不存在，`HTTP 429` 表示限流或额度不足。`AI request timed out` 表示请求超过后端等待上限。排查时可以临时设置 `AI_DEBUG_RAW_RESPONSE=true` 查看 CloudBase 日志中的供应商状态和响应摘要；确认问题后应恢复为 `false`，避免日志长期保存客户对话内容。

## 4. 微信后台合法域名

在微信公众平台的小程序开发设置中，将 CloudBase HTTPS 服务地址加入 `request 合法域名`。若输入框已提供 `https://` 前缀，只填主机名；若要求完整地址，则包含 `https://`。不要附加 `/api` 等接口路径、端口或末尾斜杠。保存后在微信开发者工具刷新项目配置并重新编译。

当前服务地址为：

```text
https://photo-studio-prod-d2drpjd43ee075-1384636564.ap-shanghai.app.tcloudbase.com
```

## 5. 需要的集合

```text
studios
faqs
packages
leads
chat_messages
chat_sessions
unanswered_questions
wechat_users
```

管理后台沿用现有接口，并可按 `wechat_...` 用户 ID 查看聊天记录和线索。

## 6. 联调顺序

1. 部署 `cloudbase-photo-studio-api` 并访问 `/health`。
2. 确认 `wechatAuth`、数据库和集合配置状态。
3. 在微信开发者工具打开本目录并编译。
4. 发送“你好”“你们有哪些套餐”“拍摄流程怎么安排”。
5. 提交联系方式，确认 `leads`、`chat_messages`、`chat_sessions` 有记录。
6. 确认飞书群收到线索通知。
7. 在管理后台客户工作台确认聊天记录和预约情况。

## 7. 微信登录排查

`/health` 的 `wechatAuth.configured` 和 `tokenConfigured` 为 `true` 仅表示读取到了配置，不保证凭据有效、门店绑定正确或数据库集合可读写。页面提示无法连接时，在开发者工具 Network 中查看 `wechat-login` 请求的状态码和 Response：

- `WeChat token signing is not configured`：实际处理请求的云函数未读取到 `WECHAT_AUTH_TOKEN_SECRET`。
- `WeChat app credentials are not configured`：当前 AppID 没有对应的 AppSecret。代码优先读取 `WECHAT_APP_SECRETS` 中匹配的值，再尝试单 App 配置。
- `WeChat AppID binding is required` / `WeChat AppID does not match studio`：核对线上 `studios` 中 `xian-west-photo` 记录的 `wechatAppId`，本地种子文件不等于线上已更新。
- 登录成功但聊天仍失败：继续查看 `/api/photo-studio/chat` 的 Response 与云函数日志。

环境变量更新后，重新部署或重启实际承载接口的服务，确认新配置生效。排查时不要分享 AppSecret、临时登录 code、用户 Token 或含客户个人信息的完整响应。
