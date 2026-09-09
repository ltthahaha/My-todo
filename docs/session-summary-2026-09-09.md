# 会话交接记录

更新时间：2026-09-09  
工作区：`D:\codex_project`  
Git 分支：`photo-studio-ai-mvp`  
远程仓库：`https://github.com/ltthahaha/My-todo.git`

## 当前项目

项目仍由三部分组成：

```text
抖音小程序
    ↓
CloudBase HTTP API
    ↓
CloudBase 数据库、AI、飞书通知和后台管理
```

主要目录：

- `cloudbase-photo-studio-api`：CloudBase Node.js HTTP API
- `douyin-photo-studio-mvp/智能客服`：旧版抖音小程序，AppID 为 `tt428a3437dcf0288901`
- `douyin-photo-studio-mvp/tt7a340c89e44f809001`：新真实门店 AppID 的独立副本
- `photo-studio-admin`：后台登录和管理页面

后端生产 API：

```text
https://photo-studio-prod-d2drpjd43ee075-1384636564.ap-shanghai.app.tcloudbase.com
```

## 新真实门店小程序

新副本路径：

```text
douyin-photo-studio-mvp/tt7a340c89e44f809001
```

当前配置：

```text
AppID: tt7a340c89e44f809001
studioId: demo-studio
studioName: 映白摄影
```

已完成：

- 复制旧小程序为独立项目目录
- 修改 `project.config.json` 的 `appid` 和 `projectname`
- 修改副本 `config/studio.js` 的 `douyinAppId`
- 同步副本部署说明和 API 示例
- 旧项目目录未修改
- 副本 JavaScript 语法检查通过
- `project.config.json` JSON 解析通过

当前状态仍不是正式门店生产配置。副本中还保留 `demo-studio`、`映白摄影` 以及示例服务目录和示例价格，必须等门店资料确认后再替换。

## 真实门店需求采集表

已生成 Excel：

```text
outputs/2026-09-06-real-store-intake/real-store-douyin-miniapp-requirements.xlsx
```

内容包含 8 个工作表：

1. 填写说明
2. 门店基本资料
3. 服务与套餐
4. 预约与服务规则
5. 客服问答
6. 线索与通知
7. 后台与合规
8. 提交检查

门店填写完成后，应将填写后的表格、Logo 和允许使用的图片素材发回，再开始真实门店工程改造。AppSecret、CloudBase API Key、飞书 Webhook、后台密码、身份证和完整营业执照不放入表格。

## 真实门店生产化下一步

收到门店填写表后，按以下顺序执行：

1. 为真实门店生成稳定且非 Demo 的 `studioId`。
2. 在 CloudBase `studios` 集合创建门店记录，并绑定：

   ```text
   douyinAppId = tt7a340c89e44f809001
   status = active
   apiEnabled = true
   ```

3. 在服务端配置新 AppID 对应的 AppSecret，不写入前端或 Git。
4. 创建真实门店的 `admin_users` 账号，并保持账号 `studioId` 一致。
5. 将真实套餐、FAQ、预约、定金、改期、退款、交付和人工接管规则录入知识库。
6. 修改新小程序副本的 `studioId`、`studioName`、服务目录、文案和素材。
7. 生产模式禁止数据库异常时返回示例套餐和示例价格；需要增加或启用“禁止 Demo 回退”的配置。
8. 配置隐私政策、数据删除/撤回方式、抖音合法域名和门店主体信息。
9. 用门店真实问题进行灰度测试，重点覆盖价格、档期、定金、退款、地址、出片和人工转接。
10. 灰度通过后再提交抖音审核和正式上线。

在没有真实门店资料和 AppSecret 前，不要把 `demo-studio` 直接改成生产门店，也不要覆盖旧 AppID 的线上配置。

## 已安装并可用的 Skills

当前 `C:\Users\18093\.codex\skills` 已能看到 Matt Pocock 相关技能及其配套技能，包括：

```text
grill-me
handoff
improve-codebase-architecture
setup-matt-pocock-skills
tdd
teach
code-review
codebase-design
diagnosing-bugs
domain-modeling
prototype
research
wizard
writing-for-agents
```

后续建议：

- 真实门店领域边界和 `studioId` 设计：`domain-modeling`、`codebase-design`
- 生产化改造：`improve-codebase-architecture`
- 先写测试再改接口：`tdd`
- 故障排查：`diagnosing-bugs`
- 需要门店或平台人工操作的步骤：`wizard`
- 交接新会话：`handoff`

## Git 与换设备续接

新会话进入工作区后执行：

```powershell
cd D:\codex_project
git checkout photo-studio-ai-mvp
git pull origin photo-studio-ai-mvp
```

然后先阅读本文件和真实门店需求采集表，再检查：

```powershell
git status --short --branch
Get-Content .\douyin-photo-studio-mvp\tt7a340c89e44f809001\config\studio.js
```

当前未提交的两张根目录 JPG 是本地用户素材，不属于本次工程交接，不要自动加入提交。

## 安全边界

- 不提交抖音 AppSecret。
- 不提交 CloudBase API Key、SecretId、SecretKey。
- 不提交飞书 Webhook、后台 token 或后台密码。
- `studioId` 和 `douyinAppId` 只是路由标识，权限仍由后端校验。
- 真实门店资料完成前，保留旧 AppID 与新 AppID 的目录隔离。
