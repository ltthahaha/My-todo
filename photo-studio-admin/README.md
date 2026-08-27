# 摄影店线索管理后台

这是一个纯 HTML 管理后台，用于查看客户咨询、聊天记录、预约线索、知识库和运营统计。

当前后台分为两个页面：

```text
login.html  登录页
index.html  主界面
```

用户必须先在 `login.html` 登录。登录成功后，前端会把 session token 保存到当前标签页的 `sessionStorage`，并跳转到 `index.html`。如果直接打开 `index.html` 但没有有效 session，会自动跳回登录页。

## 使用前配置

在 CloudBase HTTP 云函数环境变量中添加：

```text
ADMIN_SESSION_SECRET=一段长度足够的随机字符串
ADMIN_API_TOKEN=一段长度足够的随机字符串（应急后门，可选但建议测试期保留）
```

同时在 CloudBase 数据库创建 `admin_users` 集合，并手动插入门店后台账号。账号记录需要包含：

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

同时确认前端页面中的以下配置与实际项目一致：

```js
const API_BASE_URL = "https://你的 CloudBase HTTP 网关域名";
const STUDIO_ID = "demo-studio";
```

登录成功后，后台会优先使用账号记录中的 `studioId` 查询数据；`STUDIO_ID` 只作为未登录或旧版 `ADMIN_API_TOKEN` 调试时的兜底值。正式给不同摄影店开账号时，关键是让 `admin_users.studioId` 与小程序 `config/studio.js`、`studios` 集合中的 `studioId` 保持一致。

## 使用方式

1. 将 `login.html` 和 `index.html` 一起部署到静态网站托管、Vercel 或其他 HTTPS 静态托管服务。
2. 打开 `login.html`，输入门店账号邮箱和密码登录。
3. 登录成功后进入 `index.html` 主界面。
4. 在“客户工作台”查看不同用户的聊天记录、预约资料和跟进状态。
5. 在线索列表或客户详情中修改状态、内部备注后点击“保存”。

登录 session 只保存在当前浏览器标签页的 `sessionStorage` 中，不会写入项目文件。

如果 PowerShell 请求成功但浏览器提示无法访问接口，请先执行强制刷新（`Ctrl + F5`），再打开浏览器开发者工具查看 Network 中的接口请求。CloudBase HTTP 网关跨域需要允许请求头 `Authorization, Content-Type, X-Admin-Token`。

## 接口依赖

客户工作台依赖：

```text
GET /api/photo-studio/admin/customers
GET /api/photo-studio/admin/customers/:customerKey
PATCH /api/photo-studio/admin/customers/:customerKey/state
PATCH /api/photo-studio/admin/leads/:leadId
```

`customer_states` 集合用于保存后台跟进状态，包括负责人、下次跟进时间、人工接管和已读时间。如果客户工作台为空，先确认小程序端已经重新编译，并且聊天或线索记录中已经写入 `userId`、`anonymousId` 或 `sessionId`。

## 安全边界

当前已经具备基础账号登录和按 `studioId` 隔离数据的能力。正式交付给多个摄影店前，还需要增加账号创建流程、角色权限、令牌轮换和审计日志。
