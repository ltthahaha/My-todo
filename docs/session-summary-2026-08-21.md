# 项目会话总结

日期：2026-08-21

仓库：

`https://github.com/ltthahaha/My-todo.git`

## 一、待办应用已完成的功能

项目主页面位于 `index.html`，目前包含：

- 添加、删除和标记完成任务
- 使用 `localStorage` 持久化保存任务
- 实时更新待办数量和完成统计
- 全部、进行中、已完成三种筛选
- 空列表提示和添加按钮状态控制
- 添加、删除任务的过渡动画
- `createdAt` 创建时间字段
- 按日期分组显示任务
- Today、Yesterday 和具体日期标题
- 时间线风格的日期分组
- 每个任务显示创建时间
- 中文 / 英文双语界面
- 根据浏览器语言自动选择默认语言
- 语言选择保存到 `localStorage`
- 移动端适配

## 二、高级版功能

高级版目前提供：

- 为任务设置截止日期
- 显示今天截止、明天截止、剩余天数和逾期天数
- 今日重点任务区域
- 逾期任务提示
- Payhip 许可证解锁

高级版的验证逻辑：

- 前端通过 `/api/license/activate` 激活许可证
- 页面刷新后通过 `/api/license/validate` 重新验证
- 后端调用 Payhip License API
- 使用 Product Key `4pF7G` 校验商品归属
- 只有许可证处于启用状态时才解锁

相关文件：

- `api/license/activate.js`
- `api/license/validate.js`

## 三、支付平台迁移

此前使用 Lemon Squeezy，后来因为正式收款和身份验证问题，改为 Payhip。

当前购买链接：

`https://payhip.com/buy?link=4pF7G`

当前 Payhip 商品信息：

- Product Key：`4pF7G`
- 建议价格：`US$1.99` 或 `US$2.99`
- 商品需要开启 `Generate unique license keys for each sale`

Vercel 必须配置以下环境变量：

```text
PAYHIP_PRODUCT_KEY=4pF7G
PAYHIP_PRODUCT_SECRET_KEY=你的 Payhip Product Secret Key
```

`PAYHIP_PRODUCT_SECRET_KEY` 只能放在 Vercel 环境变量中，不能写入前端，也不能公开发布。

## 四、部署和仓库状态

GitHub 仓库：

`https://github.com/ltthahaha/My-todo.git`

主要提交：

- `1a1a84d Switch payments to Payhip`
- `1a5b3ac Add photography studio customer service demo`

待办应用之前部署在：

`https://my-todo-cs.vercel.app/`

GitHub 推送后，Vercel 可以通过连接的仓库自动重新部署。

## 五、第一笔收入方向

为了获得第一笔海外收入，当前建议：

- Payhip 价格设置为 `$1.99` 或 `$2.99`
- 使用英文产品描述
- 优先寻找海外早期用户
- 不急于投广告
- 通过 Product Hunt、Hacker News Show HN、Reddit、X/Twitter 获取试用用户
- 让用户先试用应用，再从应用内进入 Payhip 购买

推广重点不是强调“AI”或“支付”，而是说明：

```text
A minimalist todo app with due dates, countdowns, today focus, and overdue highlights.
```

## 六、自由职业方向

围绕已有技术经验，适合在 Upwork 和 Fiverr 提供以下服务：

- HTML / CSS / JavaScript 小型 Web App
- JavaScript Bug 修复
- Responsive UI 优化
- localStorage 功能开发
- Vercel / Netlify 部署
- GitHub 项目整理
- PayPal、Payhip 或 Stripe 支付按钮接入
- 简单 AI 自动化流程

建议定位：

```text
Frontend developer for small web apps, automation tools, and JavaScript fixes.
```

Upwork 需要完成真实身份认证后才能恢复完整工作权限。Fiverr 的主要模式是创建 Gig，让客户搜索服务后下单。

## 七、AI Agent 服务方向

讨论过的方向是把 AI agent 用于重复性、可数字化、可人工复核的工作，例如：

- 客服和 FAQ 自动回复
- 线索分类和跟进
- 表单、表格、通知之间的流程自动化
- 会议纪要和文档整理
- 产品文案和邮件生成
- 小型网站工具开发

商业表达应强调结果，而不是单纯宣传 AI：

```text
I build small automation tools that save time and reduce manual work.
```

## 八、摄影店智能客服项目

针对婚纱照、旅游照、亲子照和婚纱租赁摄影店，设计了一个智能客服项目。

产品定位：

```text
摄影店智能客服与预约助手
```

核心价值：

- 自动回答套餐、价格、服装、修图、出片和预约问题
- 推荐匹配的摄影套餐
- 收集姓名、联系方式、拍摄类型、意向日期和预算
- 无法确定时转人工
- 将咨询转化为可跟进的销售线索

第一版 MVP 功能：

- 网页客服窗口
- 套餐和 FAQ 知识库
- 自动回答高频问题
- 套餐推荐
- 预约意向表
- 生成预约线索
- 人工转接提示

暂时不自动处理：

- 真实档期确认
- 收取定金
- 退款和投诉
- 修改订单
- 复杂报价

## 九、摄影店 Demo

已创建文件：

`photo-studio-customer-service-demo.html`

文件特点：

- 单文件 HTML / CSS / JavaScript
- 摄影店展示型页面
- 右侧智能客服窗口
- 婚纱照、旅拍、亲子照和婚纱租赁问答
- 快捷问题按钮
- 样例套餐展示
- 预约意向收集表
- 线索生成反馈
- 移动端适配
- 当前使用规则和关键词模拟客服

当前 Demo 适合用于：

- 给摄影店老板演示
- 验证客户是否愿意使用
- 作为 Upwork / Fiverr 作品集
- 后续接入真实 AI API 的前端基础

## 十、摄影店项目后续路线

建议按以下顺序推进：

1. 增加右下角浮动客服按钮
2. 使用 `localStorage` 保存预约线索
3. 增加简单 FAQ 编辑页面
4. 接入后端 API
5. 接入 OpenAI、通义、豆包或 DeepSeek 等模型
6. 接入邮箱、飞书或企业微信通知
7. 接入微信公众号、企业微信或小程序
8. 增加聊天记录和未命中问题统计
9. 为每家摄影店提供独立知识库

## 十一、当前最建议的行动

当前最实际的下一步不是继续堆功能，而是：

1. 用摄影店 Demo 找一家真实摄影店演示。
2. 收集他们真实的套餐、FAQ 和预约规则。
3. 用真实内容替换 Demo 中的样例数据。
4. 以低价试点方式报价。
5. 根据客户反馈决定是否接入真实 AI。

建议试点报价：

```text
¥999 - ¥1999：网页客服 Demo、固定 FAQ、预约线索收集
¥2999 - ¥6999：官网嵌入、后台管理、AI 问答和线索通知
¥299 - ¥999 / 月：知识库维护、问题优化和技术支持
```
