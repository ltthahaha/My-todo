# 抖音小程序第一阶段联调说明

## 当前已完成

- 首页、服务分类、客服、预约意向四个页面
- 本地 FAQ 模拟回复
- 统一后端 API 调用封装
- Vercel `/api/photo-studio/chat`
- Vercel `/api/photo-studio/leads`
- 缺少后端地址时自动回退到本地模拟数据

## 1. 部署后端

项目根目录中的以下接口会由 Vercel 自动部署：

```text
api/photo-studio/chat.js
api/photo-studio/leads.js
```

部署后接口地址：

```text
https://你的域名/api/photo-studio/chat
https://你的域名/api/photo-studio/leads
```

## 2. 配置飞书群通知

在 Vercel 项目环境变量中添加：

```text
FEISHU_BOT_WEBHOOK=飞书群机器人Webhook
```

不要把 Webhook 写进小程序代码或提交到 GitHub。

当前 `leads` 接口会：

1. 检查联系方式是否填写。
2. 生成线索通知文本。
3. 配置 Webhook 后发送到飞书群。
4. 未配置时返回 Demo 模式结果，不发送消息。

## 3. 配置小程序 API 地址

修改：

```text
智能客服/services/api.js
```

将：

```js
const API_BASE_URL = ""
```

改成：

```js
const API_BASE_URL = "https://你的后端域名"
```

不要在地址后面重复添加 `/api`。

## 4. 抖音合法域名

在抖音开放平台或开发者工具中配置后端 HTTPS 域名，确保域名满足平台的合法域名和备案要求。

开发者工具中的本地调试开关只用于开发，不应作为正式上线配置。

## 5. 联调顺序

1. 部署 GitHub 项目到 Vercel。
2. 访问 `/api/photo-studio/chat` 对应接口进行测试。
3. 在 Vercel 添加 `FEISHU_BOT_WEBHOOK` 并重新部署。
4. 修改 `services/api.js` 中的 `API_BASE_URL`。
5. 在抖音开发者工具中重新编译。
6. 发送“婚纱照多少钱？”确认后端 FAQ 回复。
7. 提交预约意向，确认飞书群收到线索。

## 6. 当前限制

- FAQ 目前使用 `data/faq.json`，还没有读取飞书多维表格。
- `/api/chat` 目前是知识库匹配，不是真实大模型。
- `/api/leads` 当前推送到飞书群，但还没有持久化保存到数据库或飞书多维表格。
- 真实摄影店资料接入前，应替换示例套餐、价格、出片时间和预约规则。
