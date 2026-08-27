# 项目会话交接记录

更新时间：2026-08-27  
工作区：`E:\Project_Codex\my-todo-app`

## 1. Git 仓库状态

GitHub 仓库：

`https://github.com/ltthahaha/My-todo.git`

当前分支：

`photo-studio-ai-mvp`

最新提交：

```text
c86ae13 Split admin login and dashboard pages
```

当前工作区已提交，后续换设备后执行：

```powershell
git clone -b photo-studio-ai-mvp https://github.com/ltthahaha/My-todo.git
```

如果已经克隆过仓库：

```powershell
git checkout photo-studio-ai-mvp
git pull origin photo-studio-ai-mvp
```

## 2. 项目定位

当前项目已经从单纯待办应用扩展为摄影店智能客服 SaaS MVP，主要包含：

```text
抖音小程序
    ↓
CloudBase HTTP API
    ↓
CloudBase 数据库 + AI + 飞书群通知
    ↓
摄影店后台管理系统
```

目标是让不同摄影店拥有各自的小程序、知识库、客户咨询记录和预约线索，并由对应门店后台独立查看。

## 3. 主要目录

### CloudBase 后端

目录：

`cloudbase-photo-studio-api`

主要能力：

- `/health` 健康检查
- 抖音用户登录和身份识别
- AI 客服和本地知识库回复
- FAQ、套餐匹配
- 聊天上下文保存
- 预约意向和线索保存
- 飞书群机器人通知
- 未匹配问题收集
- 后台账号登录
- 后台客户、线索、知识库、统计接口
- 按 `studioId` 隔离不同摄影店数据
- 按 `studioId + douyinAppId` 校验小程序归属

当前 CloudBase HTTP API 地址：

`https://photo-studio-prod-d2drpjd43ee075-1384636564.ap-shanghai.app.tcloudbase.com`

健康检查地址：

```text
https://photo-studio-prod-d2drpjd43ee075-1384636564.ap-shanghai.app.tcloudbase.com/health
```

### 抖音小程序

目录：

`douyin-photo-studio-mvp/智能客服`

当前小程序 AppID：

`tt428a3437dcf0288901`

统一门店配置文件：

`douyin-photo-studio-mvp/智能客服/config/studio.js`

当前配置结构：

```js
const studioConfig = {
  studioId: "demo-studio",
  studioName: "映白摄影",
  douyinAppId: "tt428a3437dcf0288901",
  apiBaseUrl: "https://photo-studio-prod-d2drpjd43ee075-1384636564.ap-shanghai.app.tcloudbase.com"
}
```

复制给另一家摄影店时，主要修改：

- `studioId`
- `studioName`
- `douyinAppId`
- `apiBaseUrl` 通常保持不变
- `project.config.json` 中的 `appid`

小程序业务页面会自动把 `studioId` 和 `douyinAppId` 传给登录、聊天和线索接口。

### 后台管理系统

目录：

`photo-studio-admin`

当前已拆分为两个页面：

```text
login.html  登录页
index.html  登录后的主界面
```

登录流程：

1. 打开 `login.html`
2. 输入后台账号邮箱和密码
3. 请求 `/api/photo-studio/admin/auth/login`
4. 登录成功后将 token 保存到当前标签页的 `sessionStorage`
5. 自动跳转到 `index.html`
6. `index.html` 无有效 session 时自动跳回 `login.html`
7. 退出登录后清除 session 并返回 `login.html`

登录页已经增加：

- 摄影主题背景图
- 品牌介绍区域
- 清爽登录卡片
- 输入框聚焦反馈
- 登录按钮悬停效果
- 手机端布局适配

部署时必须同时上传：

```text
photo-studio-admin/login.html
photo-studio-admin/index.html
```

## 4. CloudBase 数据库集合

当前后端默认使用以下集合：

```text
studios
faqs
packages
leads
chat_messages
chat_sessions
unanswered_questions
douyin_users
admin_users
customer_states
```

### studios 示例记录

```json
{
  "studioId": "demo-studio",
  "name": "映白摄影",
  "status": "active",
  "douyinAppId": "tt428a3437dcf0288901",
  "apiEnabled": true
}
```

三处必须保持一致：

```text
studios.studioId
admin_users.studioId
小程序 config/studio.js 的 studioId
```

如果 `douyinAppId` 不匹配，后端会拒绝请求，避免不同摄影店的数据串线。

## 5. 关键环境变量

环境变量只能配置在 CloudBase 服务端，不能写入小程序或提交真实密钥到 GitHub。

当前需要关注：

```text
CLOUDBASE_ENV_ID
CLOUDBASE_APIKEY
DEFAULT_STUDIO_ID
DEFAULT_STUDIO_NAME
CLOUDBASE_STUDIO_COLLECTION=studios
DOUYIN_APP_ID
DOUYIN_APP_SECRET
DOUYIN_APP_SECRETS
DOUYIN_AUTH_TOKEN_SECRET
FEISHU_BOT_WEBHOOK
ADMIN_SESSION_SECRET
ADMIN_API_TOKEN
AI_ENABLED
AI_PROVIDER
ARK_API_KEY
ARK_MODEL
ARK_BASE_URL
AI_TIMEOUT_MS
AI_MAX_TOKENS
```

单店可以使用：

```text
DOUYIN_APP_ID
DOUYIN_APP_SECRET
```

多店共用一个后端时，使用：

```text
DOUYIN_APP_SECRETS={"小程序AppID1":"AppSecret1","小程序AppID2":"AppSecret2"}
```

不要把 `ARK_API_KEY`、抖音 `AppSecret`、飞书 Webhook、后台 token 写入前端。

## 6. 后台账号

后台账号存储在 CloudBase 的 `admin_users` 集合中，示例：

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

后台登录成功后，账号中的 `studioId` 决定可以查看哪家摄影店的数据。当前账号仍需手动写入数据库，尚未完成后台创建门店和账号的 SaaS 管理功能。

## 7. 已完成的验证

- CloudBase API 健康检查成功
- AI 配置可被后端识别
- FAQ 和套餐查询成功
- 聊天记录保存到 `chat_messages`
- 会话上下文保存到 `chat_sessions`
- 预约线索保存到 `leads`
- 飞书群收到线索通知
- 后台统计和未匹配问题收集已接入
- 后台账号登录成功
- 后台按门店账号读取数据
- 多店配置代码通过 Node.js 语法检查
- 后台 `index.html` 和 `login.html` 通过 JavaScript 语法检查

## 8. 当前最近完成的改动

### 多门店配置

提交：

`91941a2 Add multi-studio miniapp configuration`

内容：

- 新增 `studios` 集合支持
- 后端校验 `studioId` 和 `douyinAppId`
- 保存 `douyinAppId` 到用户、会话、聊天、线索记录
- 新增小程序 `config/studio.js`
- 文档补充多店部署方式

### 后台登录和主界面拆分

提交：

`c86ae13 Split admin login and dashboard pages`

内容：

- 新增独立 `photo-studio-admin/login.html`
- `index.html` 只保留主界面
- 未登录自动跳转登录页
- 登录成功自动跳转主界面
- 登录页增加摄影主题视觉设计

## 9. 换设备后的第一步

进入项目目录后执行：

```powershell
git pull origin photo-studio-ai-mvp
```

然后按当前任务选择：

### 继续部署后台

将整个 `photo-studio-admin` 文件夹部署到静态托管，并从 `login.html` 开始访问。

### 继续测试多店隔离

1. CloudBase 创建第二条 `studios` 记录。
2. 为第二个 AppID 配置对应 AppSecret。
3. 复制小程序项目。
4. 修改 `config/studio.js` 和 `project.config.json`。
5. 为第二家店创建 `admin_users` 账号。
6. 分别测试聊天、预约和后台数据是否隔离。

### 继续产品化

优先顺序建议：

1. 后台增加门店和账号创建功能。
2. 后台增加门店基本信息编辑。
3. 将 AppID/AppSecret 映射从环境变量逐步迁移到加密配置存储。
4. 增加角色权限和审计日志。
5. 增加真实档期查询和人工接管。
6. 为每家店生成独立小程序配置包。

## 10. 安全提醒

- 不要提交真实的 CloudBase API Key。
- 不要提交抖音 AppSecret。
- 不要提交火山方舟 API Key。
- 不要提交飞书群机器人 Webhook。
- 不要把 `ADMIN_API_TOKEN` 放到小程序前端。
- `studioId` 和 `douyinAppId` 可以作为路由标识，但不能替代后端权限校验。
- 前端页面分开只改善使用体验，真正安全边界仍然是后端 token 和数据库权限。
