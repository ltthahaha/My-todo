# 项目会话交接记录

更新时间：2026-08-30  
分支：`photo-studio-ai-mvp`

## 1. 本次完成内容

### 飞书线索历史聊天链接

线索成功保存并推送到飞书后，通知会发送交互卡片，并提供“查看历史聊天”按钮。按钮进入后台客户详情页，复用现有客户工作台和聊天记录接口。

链路如下：

```text
抖音小程序提交线索
    ↓
保存 leads（包含 sessionId、userId 或 anonymousId）
    ↓
飞书交互卡片
    ↓
后台 index.html?view=customers&customerKey=...
    ↓
后台登录后查看客户历史聊天
```

涉及文件：

- `cloudbase-photo-studio-api/index.js`
- `douyin-photo-studio-mvp/智能客服/pages/chat/chat.js`
- `douyin-photo-studio-mvp/智能客服/pages/lead/lead.js`
- `photo-studio-admin/index.html`
- `photo-studio-admin/login.html`

后台深链接仍然要求后台账号登录，并按账号所属 `studioId` 隔离数据。后台 URL 不会通过聊天接口回传给小程序。

### CloudBase 排序兼容

CloudBase 数据库对 `orderBy` 返回 `Invalid order format` 时，后端会自动回退到普通查询，再在 Node.js 中按时间字段排序。已覆盖客户列表、客户详情、线索列表和未匹配问题列表。

### 云函数启动文件

`cloudbase-photo-studio-api/scf_bootstrap` 已转换为 Linux LF 换行，并新增根目录 `.gitattributes`，防止 Windows 工作区再次转换脚本换行。

部署包必须直接包含：

```text
scf_bootstrap
index.js
package.json
package-lock.json
ai/
data/
```

不能把整个 `cloudbase-photo-studio-api` 文件夹再套一层；Linux/WSL 打包前执行 `chmod +x scf_bootstrap`。

## 2. 新增环境变量

CloudBase HTTP 云函数需要配置：

```text
ADMIN_DASHBOARD_URL=https://你的后台静态托管域名/index.html
```

该地址必须指向实际部署的管理后台，不能填写 CloudBase API 地址。后台静态站点需要同时部署：

```text
photo-studio-admin/login.html
photo-studio-admin/index.html
```

如果不配置 `ADMIN_DASHBOARD_URL`，飞书仍会收到线索，但不会显示历史聊天按钮。

## 3. 已验证情况

- CloudBase `/health` 正常返回。
- 后台接口已恢复正常使用。
- 飞书卡片中的历史聊天链接测试成功。
- Node.js 语法检查通过：后端、抖音聊天页、预约页。

## 4. 后续部署顺序

1. 部署 `cloudbase-photo-studio-api` 云函数。
2. 配置并确认 `ADMIN_DASHBOARD_URL`。
3. 部署 `photo-studio-admin` 静态页面。
4. 重新编译抖音小程序。
5. 提交新线索，确认飞书按钮进入对应客户聊天记录。

