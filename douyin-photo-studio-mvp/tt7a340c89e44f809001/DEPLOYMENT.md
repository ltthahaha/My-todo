# 抖音小程序第一阶段联调说明

## 当前已完成

- 首页、服务分类、客服、预约意向四个页面
- 统一后端 API 调用封装
- CloudBase `/api/photo-studio/auth/login`
- CloudBase `/api/photo-studio/chat`
- CloudBase `/api/photo-studio/leads`
- 每家摄影店可通过 `config/studio.js` 独立配置门店与小程序 AppID

## 1. 部署后端

后端部署在 `cloudbase-photo-studio-api`，通过 CloudBase HTTP 访问服务暴露：

```text
GET /health
POST /api/photo-studio/auth/login
POST /api/photo-studio/chat
POST /api/photo-studio/leads
```

部署后接口地址：

```text
https://你的 CloudBase HTTP 网关域名/health
https://你的域名/api/photo-studio/chat
https://你的域名/api/photo-studio/leads
```

## 2. 配置门店和抖音 AppID

CloudBase 数据库创建 `studios` 集合，每家摄影店插入一条记录：

```json
{
  "studioId": "xian-west-photo",
  "name": "西区摄影",
  "status": "active",
  "douyinAppId": "tt7a340c89e44f809001",
  "apiEnabled": true
}
```

如果每家店使用独立抖音小程序，需要在云函数环境变量中配置 AppSecret 映射：

```text
DOUYIN_APP_SECRETS={"tt7a340c89e44f809001":"对应小程序AppSecret"}
```

单店测试也可以继续使用：

```text
DOUYIN_APP_ID=tt7a340c89e44f809001
DOUYIN_APP_SECRET=对应小程序AppSecret
```

## 3. 配置飞书和钉钉群通知

在 CloudBase 云函数环境变量中添加：

```text
FEISHU_BOT_WEBHOOK=飞书群机器人Webhook
DINGTALK_BOT_WEBHOOK=钉钉群机器人Webhook
```

可以只配置一个通道，也可以同时配置。正式门店计划同时配置飞书和钉钉。不要把 Webhook 写进小程序代码、需求表或提交到 GitHub。钉钉机器人如果启用关键词安全校验，关键词需包含“新摄影店预约线索”。

当前 `leads` 接口会：

1. 检查联系方式是否填写。
2. 生成线索通知文本。
3. 配置 Webhook 后并行发送到飞书群和钉钉群，消息都带历史聊天链接。
4. 未配置时返回 Demo 模式结果，不发送消息。

## 4. 配置小程序

修改：

```text
config/studio.js
```

将：

```js
apiBaseUrl: "https://你的 CloudBase HTTP 网关域名"
```

同时确认：

```js
studioId: "xian-west-photo"
studioName: "西区摄影"
douyinAppId: "当前抖音小程序 AppID"
```

不要在地址后面重复添加 `/api`。

如果是另一家摄影店的小程序，还要修改 `project.config.json` 中的 `appid`。

## 5. 抖音合法域名

在抖音开放平台或开发者工具中配置后端 HTTPS 域名，确保域名满足平台的合法域名和备案要求。

开发者工具中的本地调试开关只用于开发，不应作为正式上线配置。

## 6. 联调顺序

1. 部署 CloudBase 后端。
2. 访问 `/health`，确认数据库、抖音身份、AI 配置状态。
3. 创建 `studios`、`faqs`、`packages`、`leads`、`chat_messages`、`chat_sessions` 等集合。
4. 插入当前门店的 `studios` 记录。
5. 配置 `FEISHU_BOT_WEBHOOK`、`DINGTALK_BOT_WEBHOOK`、抖音 AppSecret、AI 环境变量并重新部署。
6. 修改 `config/studio.js`，在抖音开发者工具中重新编译。
7. 发送“婚纱照多少钱？”和“可以拍写真吗？”确认客服回复和不承接规则。
8. 提交预约意向，确认 CloudBase `leads` 新增记录、飞书群和钉钉群都收到线索，并验证历史聊天链接定位到对应客户。

## 7. 当前限制

- 小程序副本已替换为西区摄影已确认的基础资料；正式上线前仍需导入 CloudBase 知识库并补齐未确认规则。
- 每家摄影店的账号仍需要先手动写入 `admin_users` 集合。
- 如果多店共用同一个后端，必须保持 `studios.studioId`、`admin_users.studioId`、小程序 `config/studio.js` 三处一致。
