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
```

## 目录结构

```text
cloudbase-photo-studio-api/
├─ data/
│  ├─ faq.json
│  └─ packages.json
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
FEISHU_BOT_WEBHOOK=你的飞书群机器人 Webhook
ADMIN_API_TOKEN=线索管理后台访问令牌
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

## 数据库集合

创建以下集合：

```text
faqs
packages
leads
chat_messages
```

FAQ 和套餐数据可以先使用项目中的 `data/faq.json`、`data/packages.json` 作为回退数据。正式使用时，在每条 FAQ 和套餐记录中添加：

```text
studioId
enabled: true
```

线索会写入 `leads` 集合，聊天记录会写入 `chat_messages` 集合。所有正式查询都应带 `studioId`，为后续多租户 SaaS 做数据隔离准备。

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
