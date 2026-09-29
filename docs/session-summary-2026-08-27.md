# 项目会话交接记录

更新时间：2026-08-28  
工作区：`E:\Project_Codex\my-todo-app`

## 1. Git 仓库状态

GitHub 仓库：

`https://github.com/ltthahaha/My-todo.git`

当前分支：

`photo-studio-ai-mvp`

最新提交：

```text
7a6cddf Return final AI answers without reasoning leakage
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
- AI 主答客服和本地知识库兜底
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

小程序客服页支持用户主动授权同步抖音资料。授权成功后，后端 `POST /api/photo-studio/auth/profile` 会把 `douyinNickName`、`douyinAvatarUrl`、`profileUpdatedAt` 写入 `douyin_users`，并在后续聊天、会话和线索记录中带上昵称头像快照。后台客户工作台和线索管理会优先展示真实姓名，其次展示抖音昵称；未授权用户继续按匿名客户处理。

AI 客服回复策略已从“本地快答优先”调整为“AI 主答 + FAQ/套餐作为知识底座 + 本地动作强规则”。普通业务咨询默认调用 AI 组织最终回复，FAQ 和套餐只作为检索材料；问候语、预约提交、线索入库、飞书通知、用户身份校验仍由确定性后端逻辑处理。小程序聊天页已增加快速首响气泡，用户发送消息后会先显示“正在整理回复”，接口返回后再替换为最终答案。

2026-08-28 实测发现：模型 `deepseek-v4-flash-260425` 会返回 `reasoning_content`，并且在 `AI_MAX_TOKENS` 过低时出现 `finish_reason: length`，导致最终 `message.content` 为空或只剩“您问”这类半截回复。后端已改为只读取最终 `message.content`，不返回 `reasoning_content`；同时新增 `AI_THINKING_TYPE`、提高 `AI_MAX_TOKENS` 默认值，并在 `finish_reason=length` 时拒绝半截答案，改走本地兜底。

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
AI_THINKING_TYPE
AI_DEBUG_RAW_RESPONSE
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
- AI 原始响应日志可通过 `AI_DEBUG_RAW_RESPONSE=true` 临时开启
- AI 解析器已兼容标准 JSON、普通文本、顶层 `answer/reply/text/content`、嵌套输出、SSE 和截断 JSON
- `finish_reason=length` 的半截回复会被拦截，不再直接返回给小程序
- 小程序聊天页已支持快速首响并替换最终回复

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

### AI 主答与响应排查

近期提交：

```text
6035379 Improve photo studio chat context logic
29537c1 Make photo studio AI the default responder
c00e43e Add fast first response for photo studio chat
310b0d0 Log and parse AI provider responses
7a6cddf Return final AI answers without reasoning leakage
```

内容：

- 按服务类型收窄 FAQ 和套餐，避免婚纱照咨询混入旅拍、亲子、租赁套餐。
- 普通业务咨询默认调用 AI，FAQ/套餐仅作为知识上下文。
- 小程序前端增加“正在整理回复”的快速首响气泡。
- `provider.js` 先读取 AI 原始响应文本，再尝试解析 JSON，方便定位供应商格式差异。
- 新增 `AI_DEBUG_RAW_RESPONSE`，调试时可在 CloudBase 日志查看 `AI provider raw response`。
- 新增 `AI_THINKING_TYPE`，支持 `enabled`、`auto`、`disabled`。
- `AI_MAX_TOKENS` 默认提高到 `512`，代码允许最高 `768`。
- 服务端只读取 `message.content` 作为客户可见答案，不返回 `reasoning_content`。
- 当 `finish_reason=length` 时，后端判定 AI 输出被截断，不会把“您问”等半截内容返回给客户。

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

### 继续优化 AI 客服

当前最新实测结论：

1. AI 调用已成功参与大部分业务咨询，正常响应延迟约 3.9-5 秒。
2. 偶发请求会达到 7 秒超时并回退到本地话术。
3. `salesStage` 仍可能从 `comparing` 回落到 `greeting`，需要改成更保守的阶段继承策略。
4. “当天怎么安排”等问题需要在 CloudBase FAQ 中补充真实门店流程，否则 AI 会受“不能编造资料外内容”约束，回答质量不稳定。
5. 调试完成后应关闭 `AI_DEBUG_RAW_RESPONSE=false`，避免日志长期保存客户对话和模型内部思考内容。

建议下一步：

1. 优先将 `AI_THINKING_TYPE` 从 `enabled` 实测切到 `auto`，如果仍慢再试 `disabled`。
2. 保留 `AI_MAX_TOKENS=512`。
3. 修复 `salesStage` 阶段继承，避免高意向客户被降级为问候阶段。
4. 在 `faqs` 集合新增婚纱照拍摄当天流程、前期准备、选片精修周期等真实 FAQ。
5. 继续观察 CloudBase 日志中的 `fallbackReason`，若仍出现 `AI request timed out`，再压缩 prompt 和历史轮数。

## 10. 安全提醒

- 不要提交真实的 CloudBase API Key。
- 不要提交抖音 AppSecret。
- 不要提交火山方舟 API Key。
- 不要提交飞书群机器人 Webhook。
- 不要把 `ADMIN_API_TOKEN` 放到小程序前端。
- `studioId` 和 `douyinAppId` 可以作为路由标识，但不能替代后端权限校验。
- 前端页面分开只改善使用体验，真正安全边界仍然是后端 token 和数据库权限。
