# 饭搭子 FanDaZi

拍照识别菜单、翻译菜品信息，并按人数、忌口和口味偏好推荐适合点的菜。最后生成可直接给服务员看的点餐话术。

## 功能

- 上传或拍摄一页/多页菜单图片
- 识别菜名、价格、分类和简短中文说明
- 根据过敏、忌口、口味、辣度和人数推荐菜品
- 生成英语、日语、意大利语、法语、德语、西班牙语、韩语点餐话术
- 支持 Moonshot Kimi 和 OpenAI 两种后端模型配置

## 技术栈

- Next.js 14 App Router
- React 18
- Server Route API 代理模型请求，避免在浏览器暴露 API Key

## 本地开发

```bash
npm install
cp .env.example .env.local
npm run dev
```

打开 `http://localhost:3000`。

## 环境变量

默认使用 Moonshot Kimi：

```bash
AI_PROVIDER=moonshot
MOONSHOT_API_KEY=your_moonshot_api_key_here
MOONSHOT_TEXT_MODEL=moonshot-v1-8k
MOONSHOT_VISION_MODEL=moonshot-v1-128k-vision-preview
AI_PROVIDER_TIMEOUT_MS=85000
```

切换到 OpenAI：

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_TEXT_MODEL=gpt-4.1-mini
OPENAI_VISION_MODEL=gpt-4.1-mini
OPENAI_IMAGE_DETAIL=auto
```

`.env.local` 已在 `.gitignore` 中忽略。不要把真实 API Key 提交到 GitHub。

当前默认配置仍然使用 Moonshot Kimi。只要原来的 Key 还有效、额度正常，就不需要重新申请 API；如果曾经把真实 Key 发到聊天、文档、截图或仓库外部，请在 Moonshot 控制台轮换一次更稳妥。

## 构建

```bash
npm run build
npm start
```

## 备案

页面底部展示并链接至工信部备案官网：

滇ICP备2026003699号-2

## 隐私说明

菜单图片、菜品偏好和点餐需求会发送到你配置的模型服务商用于生成结果。项目本身不保存这些内容；如果部署到第三方平台，请同时检查平台日志、函数日志和模型服务商的数据政策。

## 作品保护与许可

Copyright (c) 2026 Xiaoxuan Zhao（赵小炫）

本项目采用双重许可：

- 开源使用：AGPL-3.0-only。你可以在 AGPL-3.0-only 条款下使用、复制、修改和分发本项目；如果你修改后通过网络向用户提供服务，需要按 AGPL-3.0 的要求提供对应源码。
- 商业授权：如果你希望闭源使用、专有分发、用于不符合 AGPL-3.0-only 的 SaaS 或其他商业场景，需要提前获得版权持有人的书面商业授权。

详见 `LICENSE` 和 `COMMERCIAL-LICENSE.md`。
