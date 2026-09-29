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

## 4. 微信后台合法域名

在微信公众平台的小程序开发设置中，将 CloudBase HTTPS 域名加入 `request 合法域名`。只填写 HTTPS 域名，不填写协议、接口路径、端口或末尾斜杠。

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
