# 会话交接记录

更新时间：2026-09-13
工作区：`D:\codex_project`
Git 分支：`photo-studio-ai-mvp`

## 本次门店资料

已读取并视觉核对两份西安西区摄影资料，并按用户确认结果确定真实门店档案：

```text
账号：西区摄影·婚前影像FSFU
品牌简称：西区摄影
投放渠道：抖音
城市：西安
正式主体：西安市高新区西一区影像馆
门店地址：陕西省西安市高新区丈八街办高新一路19号思安大厦B区2号楼
联系电话：18729310525
营业时间：8:00-22:00
门店负责人：暂不填写
主营/其他类型：婚纱照
投放区域：陕西、甘肃、山西
studioId：xian-west-photo
```

资料中首行主推套餐：

```text
3999 元十服十造
提供 150 张拍摄照片
内外景双拍
底片全部赠送
附赠相册、相框、摆台等项目
资料描述为所有项目一价全包
```

用户已确认主门店为上述账号，建议 `studioId = xian-west-photo` 可直接使用；线索通知同时支持飞书和钉钉。定金、改期、退款、精修等规则暂不填写，后台管理员、隐私政策、数据保留和历史聊天权限后期再考虑。

资料还将以下业务列为不服务或不承接，已在需求表备注中保留：孕妇照、礼服租赁、西服定制、写真、女士写真、男士写真、肖像、宝宝儿童、情侣照、证件照、闺蜜照、旅拍，以及互勉、游客、未成年、租衣服、跟拍、约妆等标签。后者仍需门店确认其确切含义。

客服资料已整理出 20 条问答，包含风格、客片、价格、地址、活动、微信联系、底片、套餐内容、档期、写真、微电影、出片时间、服装造型和预约等场景。

## 已生成文件

预填版需求表（旧版，仍保留）：

```text
outputs/2026-09-13-real-store-intake/real-store-douyin-miniapp-requirements-prefilled.xlsx
```

按用户最新确认生成的确认版：

```text
outputs/2026-09-13-real-store-intake/real-store-douyin-miniapp-requirements-confirmed.xlsx
```

原始空白模板仍保留：

```text
outputs/2026-09-06-real-store-intake/real-store-douyin-miniapp-requirements.xlsx
```

确认版工作表包括：门店基本资料、服务与套餐、预约与服务规则、客服问答、线索与通知、后台与合规、提交检查。正式主体、完整地址、联系电话、营业时间、studioId 和双通道通知方向已写入；未确认规则、负责人、后台合规和上线时间标记为“后期确认”或“暂不填写”。已完成关键工作表渲染、数据核对和公式错误扫描，未发现公式错误。旧预填版因当时被 Excel 打开，未强制覆盖。

## 已更新的小程序副本

目录：

```text
douyin-photo-studio-mvp/tt7a340c89e44f809001
```

当前配置：

```text
studioId：xian-west-photo（已确认可使用）
studioName：西区摄影
douyinAppId：tt7a340c89e44f809001
```

已完成：

- 首页服务目录收敛为婚纱照，移除资料明确不服务的旅拍、亲子照和礼服租赁展示。
- 更新主推套餐、150 张照片、内外景双拍、底片全送和交付说明。
- 更新小程序配置、部署说明和 API 示例中的门店名称与建议 studioId。
- 新副本全部 JavaScript 语法检查通过，`git diff --check` 通过。
- 后端已支持 `FEISHU_BOT_WEBHOOK` 与 `DINGTALK_BOT_WEBHOOK` 并行通知，通知结果会返回配置、成功、失败和部分成功状态。
- 已准备 `cloudbase-photo-studio-api/data/seed/xian-west-photo/` 下的数组 JSON、JSONL 和专用 `*-cloudbase-import.json` 初始化文件；CloudBase 控制台请选择“JSON”格式并实际上传专用导入文件。

生产接口只读检查（2026-09-13）：`/health` 返回数据库、后台鉴权和 AI 均已配置，但 `multiAppConfigured` 仍为 `false`；`/api/photo-studio/knowledge?studioId=xian-west-photo` 当前返回空 FAQ 和空套餐，说明初始化 JSON 尚未导入 CloudBase，抖音 AppSecret 映射也尚未配置。

本地验证：后端和需求表脚本语法检查通过，`git diff --check` 通过；用模拟 HTTP 响应验证了飞书与钉钉通知会并行发送，飞书使用交互卡片按钮，钉钉使用 Markdown 历史聊天链接。由于 API 目录尚未安装生产依赖，未在本机启动完整 Express 服务；部署到 CloudBase 后由运行时安装依赖。

CloudBase 导入注意：集合“添加文档”编辑器只接受单条 JSON 对象；批量 FAQ/套餐/门店数据必须从集合列表的“导入”入口上传 `*-cloudbase-import.json`（JSON Lines 内容），不能把多行对象直接粘贴到“添加文档”窗口。

尚未执行：

- CloudBase `studios`、`packages`、`faqs`、`admin_users` 的云端真实数据导入。
- 抖音 AppSecret、后台账号、飞书/钉钉 Webhook 和正式隐私政策配置。
- 真实账号登录、客服、预约线索、双通道通知和灰度验收。

## 后续待补充

1. “十服十造”的准确含义，以及相册、相框、摆台、精修和交付规格。
2. 定金、改期、退款、迟到、选片和加急规则。
3. 资料中的“不承接”标签是否确实代表不提供的业务。
4. 飞书和钉钉群名称、接收人及首次联系时限。
5. 后台管理员、隐私政策、数据保留期限和客户历史聊天查看权限。
6. Logo、客片、门店环境素材和正式上线时间。

## 多门店上线架构说明

后续新增其他摄影门店时，原则上不需要为每家门店重新部署一套后端函数。推荐共用同一个 CloudBase API 函数，通过请求中的 `studioId` 做门店隔离：

- 每家门店分配全局唯一的 `studioId`，并在 `studios`、`packages`、`faqs`、线索和聊天记录中始终携带该字段。
- 每家门店使用自己的抖音 AppID；AppSecret 只配置在服务端的安全环境变量中，并通过 `DOUYIN_APP_SECRETS` 按 AppID 映射。
- 每家门店维护独立的门店资料、套餐、FAQ、素材和后台管理员权限，不能复用另一家门店的业务数据。
- 小程序可以按门店复制配置目录，也可以在同一代码基线下切换 `studioId` 和 AppID；发布前必须核对 API 地址、门店资料和抖音平台主体。
- 当前飞书、钉钉 Webhook 是全局环境变量，适用于当前单店上线。第二家门店上线前，应增加按 `studioId` 的通知路由（例如 `studioNotificationConfigs` 集合或服务端密钥映射），或者在确有隔离要求时部署独立函数。
- 后台查询、历史聊天链接和通知内容都必须带 `studioId` 校验，避免通过修改 URL 或请求参数访问其他门店的数据。

因此，新增门店的标准流程是：建立唯一 `studioId` → 收集并导入该门店数据 → 配置对应 AppID/AppSecret → 配置该门店的通知路由 → 复制或切换小程序配置 → 灰度验收。只有在合规、网络、资源或客户独立运维要求明确时，才考虑为该门店拆分独立函数。

## 安全

PDF 中包含钉钉机器人访问令牌和二维码。令牌未写入需求表、代码或 Git；如果仍在使用，应先更换。AppSecret、CloudBase 密钥、后台密码、飞书 Webhook 和钉钉 Webhook 继续只通过安全渠道配置。
