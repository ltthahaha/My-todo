# 微信小程序 AI 客服会话交接

更新时间：2026-09-29
工作区：`E:\Project_Codex\my-todo-app`
仓库：`https://github.com/ltthahaha/My-todo.git`
当前分支：`codex/wechat-miniapp-ai-mvp`
微信版本实现提交：`ddf0677 Add WeChat miniapp AI customer service MVP`

## 当前目标与实现

当前方向为自有微信小程序内的 AI 客服，独立目录为 `wechat-photo-studio-mvp`，保留原抖音版本。门店为西区摄影，`studioId=xian-west-photo`，微信 AppID 为 `wxdb93d05dc105b2a2`。

已实现微信首页、服务详情、AI 聊天、咨询意向提交、隐私说明和客户称呼设置。共用 `cloudbase-photo-studio-api` 后端，新增微信登录与资料接口、`wechat_users` 集合支持、微信独立签名 Token，并按门店、AppID、用户隔离微信会话。聊天与线索记录携带微信来源，管理后台支持展示微信客户资料。默认禁止匿名微信请求。

后端使用 `wx.login()` 提供的临时 code 换取 openid，签发有效期一天的应用 Token。微信 AppSecret 和签名密钥只配置在服务端。客户端遇到身份过期会刷新登录一次，线索未保存时不会显示提交成功。

门店种子数据三个格式均已加入 `wechatAppId`；本地种子文件不会自动更新线上数据库，需要在 CloudBase `studios` 集合中维护对应记录。

## 本次联调及确认

1. 最初出现 `request 合法域名` 拦截，用户已在微信公众平台配置域名；随后请求能够到达后端。
2. 微信登录接口 `/api/photo-studio/auth/wechat-login` 曾返回 HTTP 503。检查代码发现，缺少签名密钥或当前 AppID 的服务端凭据均可能产生此状态，需要依据具体 Response 定位。
3. 已提供兼容 Windows PowerShell 5.1 的随机密钥生成命令，用于配置 `WECHAT_AUTH_TOKEN_SECRET`。
4. 用户提供的 2026-09-29 `/health` 响应显示 `wechatAuth.configured=true`、`multiAppConfigured=true`、`tokenConfigured=true`、`anonymousAllowed=false`；数据库配置和 AI 配置标志也为 true。
5. 健康检查仅反映配置状态，不验证 AppSecret 正确性、门店绑定、集合实际读写或真实微信登录。已说明需要进一步核对线上 `studios` 绑定和登录请求 Response。
6. 用户随后明确确认“这个问题解决了”，并要求将修改及会话记录再次推送到远端。用户未说明最终修改了哪个配置，因此不将某一排查假设记为已证实根因。

当前 API 根地址：

```text
https://photo-studio-prod-d2drpjd43ee075-1384636564.ap-shanghai.app.tcloudbase.com
```

核心服务端配置名称：

```text
WECHAT_APP_ID=wxdb93d05dc105b2a2
WECHAT_APP_SECRET=对应小程序的AppSecret
WECHAT_APP_SECRETS={"wxdb93d05dc105b2a2":"对应AppSecret"}
WECHAT_AUTH_TOKEN_SECRET=随机签名密钥
WECHAT_ALLOW_ANONYMOUS=false
```

单 App 可配置 `WECHAT_APP_SECRET`；多 App 使用 JSON 映射。当前代码优先读取映射中匹配 AppID 的值，更新密钥时要避免映射中仍保留旧值。以上为占位说明，本文不保存真实密钥、用户 Token 或临时登录 code。

## 本次提交范围

- 保留并提交微信开发者工具更新的 `wechat-photo-studio-mvp/project.config.json`，其中 AppID 不变，`urlCheck=true`。
- 保存已有 `docs/session-summary-2026-08-27.md` 补充内容；该文件是历史记录，当前微信工作以本文为准。
- 新增本交接记录，并补充微信部署文档中的排查说明。
- 未跟踪目录 `douyin-photo-studio-mvp/tt7a340c89e44f809001-consultation/` 是此前遗留的独立抖音副本，未纳入本次微信提交，也未删除。
- 上次实现提交已在本地完成，但当时 GitHub HTTPS 连接重置，推送失败。本次重新推送当前分支，实际成功状态以 Git 推送结果和远端提交号核对为准。

## 验证与后续任务

微信专项测试命令：

```powershell
node --test tests/wechat-mvp.test.cjs
```

实现阶段该测试的 14 项均通过，涵盖登录换码、Token 隔离、会话隔离、微信线索保存、抖音兼容和客户端重试。测试使用模拟服务，不代表生产微信 API 或 CloudBase 已端到端验收；本机尚无微信开发者工具命令行编译结果。

接下来在开发者工具与真实设备分别验证：

1. 连续多轮咨询，确认上下文和门店知识回答正常。
2. 提交咨询意向，核对 `wechat_users`、`chat_messages`、`chat_sessions`、`leads` 中的用户、门店及来源字段。
3. 确认已配置通知群收到消息，并可在管理后台查看对应客户聊天及预约意向。
4. 用第二个微信账号验证客户数据隔离，检查重新打开后的身份及会话行为。
5. 提审前完善正式隐私说明、门店资料、服务类目及平台要求；当前预约只登记意向，不代表确认档期或完成付款。

换设备时，先确认远端分支已存在，再执行：

```powershell
git clone --branch codex/wechat-miniapp-ai-mvp https://github.com/ltthahaha/My-todo.git
```

已有本地仓库应先检查工作区改动，再 fetch 并切换此分支，不覆盖未提交文件。开发者工具导入 `wechat-photo-studio-mvp`；后端部署目录为 `cloudbase-photo-studio-api`，管理后台目录为 `photo-studio-admin`。
