# 西区摄影 CloudBase 初始化数据

本目录用于初始化真实门店 `xian-west-photo` 的 CloudBase 数据，不包含 AppSecret、Webhook、API Key 或后台密码。

## 导入集合

- `studios-cloudbase-import.json` 导入 `studios`
- `packages-cloudbase-import.json` 导入 `packages`
- `faqs-cloudbase-import.json` 导入 `faqs`

CloudBase 控制台虽然让你选择“JSON”文件格式，但文件内容要求是 JSON Lines：每一行一个完整 JSON 对象，不能使用外层数组格式。实际导入请使用 `*-cloudbase-import.json` 文件；这些文件包含稳定 `_id`，重复导入时可选择 Upsert，避免重复记录。原始 `.json` 和 `.jsonl` 文件保留作本地源数据与校验备份。

注意：集合里的“添加文档”窗口只支持粘贴一条 JSON 对象，不能粘贴多行 JSONL。批量导入时请关闭“添加文档”窗口，回到集合列表点击“导入”，选择 JSON 格式并上传对应的 `*-cloudbase-import.json` 文件。

导入后确认每条记录的 `studioId` 均为 `xian-west-photo`，并确认 `enabled: true`。CloudBase 集合权限建议设置为“仅服务端可读写”，由 HTTP 云函数通过服务端凭据访问。

## 服务端环境变量

在 CloudBase HTTP 云函数环境变量中安全配置：

```text
DEFAULT_STUDIO_ID=xian-west-photo
DOUYIN_APP_ID=tt7a340c89e44f809001
DOUYIN_APP_SECRETS={"tt7a340c89e44f809001":"对应 AppSecret"}
FEISHU_BOT_WEBHOOK=对应飞书群机器人 Webhook
DINGTALK_BOT_WEBHOOK=对应钉钉群机器人 Webhook
```

不要把上述敏感值写入小程序、JSON 数据文件或 Git。完成导入和环境变量配置后，先访问 `/health`，再用 `GET /api/photo-studio/knowledge?studioId=xian-west-photo` 验证 FAQ 和套餐数量。
