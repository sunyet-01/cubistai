# ClipLumi 复刻工作文档

## Phase 1: 清理模板多余代码
- [x] 删除 blog 相关路由和组件
- [x] 从首页移除 blog 导入
- [x] 从 header 导航移除 blog 链接
- [x] 从 footer 移除 blog 链接

## Phase 2: 改写着陆页
- [x] 改写 src/blocks/hero.tsx — ClipLumi 风格 hero
- [x] 改写 src/blocks/features.tsx — 产品功能特性
- [x] 改写 src/blocks/faq.tsx — ClipLumi FAQ
- [x] 改写 src/blocks/cta.tsx — CTA 区域
- [x] 改写 src/blocks/pricing.tsx — 积分制定价
- [x] 改写 src/blocks/header.tsx — 导航栏
- [x] 改写 src/blocks/footer.tsx — 页脚
- [x] 改写 src/routes/index.tsx — 移除 blog 组件

## Phase 3: 创建编辑器页面
- [x] 创建 src/routes/editor.tsx — 编辑器主页面
- [x] 创建 before-after 滑块对比组件
- [x] 创建 API 路由 src/routes/api/editor/generate.ts

## Phase 4: 更新 i18n 文案
- [x] 更新 messages/en.json — 全部 ClipLumi 文案
- [x] 更新 messages/zh.json — 中文翻译

## Phase 5: 环境配置更新
- [x] 更新 .env.example — 添加 AI 相关配置说明

## Phase 6: 构建验证
- [x] 运行 pnpm build 验证无报错

## Phase 7: 需要用户完成的事项
- [ ] 配置 Gemini API Key（Admin > Settings > AI > OpenAI 组，填到 `openai_api_key` 字段）
- [ ] 配置 Replicate API Token（Admin > Settings > AI > Replicate 组，填到 `replicate_api_token` 字段）
- [ ] 配置存储（Admin > Settings > Storage > R2/S3 组，填 Access Key / Secret Key / Bucket / Endpoint / Domain）
- [ ] 准备 Logo 文件（替换 public/logo.svg 或 public/logo.png）
- [ ] 准备首页 Before/After 示例图片素材（可选，用于落地页展示）
- [ ] 配置支付方式（Admin > Settings > Payment，至少启用一个：Stripe/PayPal/支付宝/微信）
- [ ] 生成 AUTH_SECRET（`openssl rand -base64 32`）并填入 .env.development
- [ ] 运行 `pnpm db:push` 创建数据库表
- [ ] 运行 `pnpm dev` 启动开发服务器

### 快速启动命令
```bash
cp .env.example .env.development
# 编辑 .env.development 填入 AUTH_SECRET
openssl rand -base64 32  # 生成 AUTH_SECRET
pnpm db:push             # 创建数据库表
pnpm dev                 # 启动开发服务器 http://localhost:3000
```
