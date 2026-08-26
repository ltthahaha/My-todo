# 摄影店线索管理后台

这是一个纯 HTML 管理页面，用于查看客户咨询、聊天记录、预约线索、知识库和运营统计。

## 使用前配置

在 CloudBase HTTP 云函数环境变量中添加：

```text
ADMIN_API_TOKEN=一段长度足够的随机字符串
```

同时确认前端页面中的以下配置与实际项目一致：

```js
const API_BASE_URL = "https://你的 CloudBase HTTP 网关域名";
const STUDIO_ID = "demo-studio";
```

## 使用方式

1. 将 `index.html` 部署到静态网站托管、Vercel 或其他 HTTPS 静态托管服务。
2. 打开页面，输入 `ADMIN_API_TOKEN`。
3. 在“客户工作台”查看不同用户的聊天记录、预约资料和跟进状态。
4. 在线索列表或客户详情中修改状态、内部备注后点击“保存”。

管理令牌只保存在当前浏览器标签页的 `sessionStorage` 中，不会写入项目文件。

如果 PowerShell 请求成功但浏览器提示无法访问接口，请先执行强制刷新（`Ctrl + F5`），再打开浏览器开发者工具查看 Network 中的接口请求。后台的 GET 请求不发送多余的 JSON 请求头，以减少跨域预检问题。

## 接口依赖

客户工作台依赖：

```text
GET /api/photo-studio/admin/customers
GET /api/photo-studio/admin/customers/:customerKey
PATCH /api/photo-studio/admin/leads/:leadId
```

如果客户工作台为空，先确认小程序端已经重新编译，并且聊天或线索记录中已经写入 `userId`、`anonymousId` 或 `sessionId`。

## 安全边界

该页面不是完整的多用户登录系统。正式交付给多个摄影店前，还需要增加账号登录、角色权限、令牌轮换和审计日志。
