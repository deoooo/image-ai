# Image AI

一个基于 AI 的图像生成应用。为用户提供流畅的文生图、图生图体验，支持实时进度预览和画廊管理。

## ✨ 主要特性

- **强大的生成能力**: 支持多种高性能 AI 图像生成模型。
- **多模态输入**:
  - **文生图**: 支持通过详细的提示词生成图像。
  - **图生图**: 支持上传参考图片作为生成的底图。
- **高度可定制**:
  - **画幅比例**: 支持 `Auto`、`1:1`、`16:9`、`9:16` 等多种比例。
  - **高清分辨率**: 支持 `1K`、`2K`、`4K` 分辨率输出。
- **极致用户体验**:
  - **实时反馈**: 实时轮询生成状态，展示生成进度条。
  - **即时预览**: 生成完成后立即展示高清大图。
  - **历史画廊**: 自动保存生成记录，方便随时回顾。
- **现代化架构**: 基于 Next.js 16 (App Router) 和 React 19 开发，采用 Tailwind CSS 打造精美 UI。

## 🛠️ 技术栈

- **前端框架**: [Next.js 16](https://nextjs.org/) (App Router)
- **UI 库**: React 19, [Tailwind CSS v4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
- **数据库**: Supabase
- **对象存储**: Cloudflare R2
- **AI 服务**: 支持多种 AI 图像生成服务 (如 Grsai API 等)

## 🚀 本地运行指南

### 1. 环境准备

- **Node.js**: 推荐 v20 或更高版本。
- **包管理器**: 推荐使用 `npm` 或 `pnpm`。
- **Supabase**: 用于用户、余额、扣费和生成历史数据。
- **Cloudflare R2**: 用于存储上传和生成的图片。

### 2. 克隆项目 & 安装依赖

```bash
git clone https://github.com/deoooo/image-ai.git
cd image-ai

npm install
# 或
pnpm install
```

### 3. 配置环境变量

复制 `.env.example` 模板文件并重命名为 `.env.local`：

```bash
cp .env.example .env.local
```

在 `.env.local` 中填入以下必要配置：

```env
# --- 核心服务 ---
# Supabase 配置 (用于存储元数据)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
# 注意：后端使用 Service Role Key 以绕过 RLS 进行写入
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# --- 存储服务 ---
# Cloudflare R2 配置 (用于图片存储)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_URL=https://pub-xxx.r2.dev

# --- AI 服务 ---
# Grsai API 配置 (用于图像生成)
GRSAI_API_KEY=your_api_key
# GRSAI_API_BASE_URL=https://api.grsai.com (可选)

# --- 安全 ---
# Optional override for the built-in browser session token signing secret.
# SESSION_SECRET=replace_with_a_long_random_secret
```

### 4. 数据库迁移

The application uses Supabase for user management, balances, billing, and
generation history. Before creating users in production, run the SQL in:

```text
supabase/migrations/20260705000000_user_billing.sql
supabase/migrations/20260713000000_balance_adjustments.sql
supabase/migrations/20260714000000_team_billing.sql
```

You can paste it into the Supabase SQL Editor for the project configured by
`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

### 5. 启动开发服务器

```bash
npm run dev
```

打开浏览器访问 [http://localhost:3000](http://localhost:3000) 即可开始使用。

## 📖 使用指南

### Authentication

The temporary administrator account is:

- Username: `lynn`
- Password: `lynn2026`

The super administrator can create individual users, teams, and team
administrators. Team administrators create their own members and configure each
member's daily spending limit. Regular users sign in with username and password.

### Billing

Individual users are charged from their own balance. Team members are charged
from the team's shared balance and are also constrained by their per-member
daily limit, which resets at midnight in `Asia/Shanghai`. If either balance or
limit is insufficient, generation is rejected. Failed generations refund both
the charged balance and the member's same-day usage exactly once.

- `nano-banana-pro`: 0.25 RMB
- `nano-banana-fast`: 0.08 RMB

1. **登录**: 使用管理员账号或普通用户账号登录。
2. **生成图片**:
   - 在输入框中输入描述性的提示词（Prompt）。
   - (可选) 上传参考图片。
   - 选择模型、比例和分辨率。
   - 点击生成的 "Generate" 按钮。
3. **查看结果**: 生成过程中会显示进度条，完成后图片将自动展示在画廊区域。

## 📄 许可证

[MIT License](./LICENSE)
