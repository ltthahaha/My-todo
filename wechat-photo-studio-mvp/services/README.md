# 微信小程序 API 配置说明

业务页面只需要使用 `services/api.js`，平台字段会自动加入请求：

```text
platform: "wechat"
wechatAppId: "wxdb93d05dc105b2a2"
studioId: "xian-west-photo"
```

接口：

```text
POST /api/photo-studio/auth/wechat-login
POST /api/photo-studio/auth/wechat-profile
POST /api/photo-studio/chat
POST /api/photo-studio/leads
```

微信 `AppSecret` 只在 CloudBase 服务端使用。没有配置 AppSecret 时，API 会保留稳定的匿名 ID，聊天记录和线索仍能关联到同一设备会话；配置后会切换为微信用户 ID。

不要把模型 API Key、微信 AppSecret、飞书 Webhook 或后台 Token 写入小程序前端。
