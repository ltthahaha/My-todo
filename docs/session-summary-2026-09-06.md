# 会话交接记录

更新时间：2026-09-06

## 本次改造

为新的抖音小程序 AppID 创建了独立项目副本：

```text
douyin-photo-studio-mvp/tt7a340c89e44f809001
```

副本配置：

```text
AppID: tt7a340c89e44f809001
studioId: demo-studio
API: https://photo-studio-prod-d2drpjd43ee075-1384636564.ap-shanghai.app.tcloudbase.com
```

已修改：

- `project.config.json` 的 `appid`
- `project.config.json` 的 `projectname`
- `config/studio.js` 的 `douyinAppId`
- 副本内的部署说明和 API 示例

原项目目录仍保留：

```text
douyin-photo-studio-mvp/智能客服
```

其旧 AppID `tt428a3437dcf0288901` 未修改。

## 部署前必须完成

由于后端会校验 `studioId` 和 `douyinAppId`，新小程序正式联调前需要在 CloudBase 服务端完成：

1. 将 `studios` 集合中 `demo-studio` 记录的 `douyinAppId` 改为：

   ```text
   tt7a340c89e44f809001
   ```

2. 配置新小程序对应的 AppSecret。多 App 配置示例：

   ```text
   DOUYIN_APP_SECRETS={"tt7a340c89e44f809001":"对应小程序AppSecret"}
   ```

3. 重新部署 CloudBase API。
4. 在抖音开发者工具中打开：

   ```text
   douyin-photo-studio-mvp/tt7a340c89e44f809001
   ```

5. 配置抖音小程序合法域名，重新编译并测试登录、聊天和提交预约意向。

如果要同时保留旧 AppID 运行，不能直接覆盖 `demo-studio.douyinAppId`；需要为后端增加多 AppID 归属配置，或为新 AppID 创建独立 `studioId`。

## 验证结果

- 新副本 JavaScript 语法检查通过。
- `project.config.json` JSON 解析通过。
- 新副本内未残留旧 AppID。
- 旧小程序目录未修改。
