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
- **数据库**: [Supabase](https://supabase.com/) (PostgreSQL)
- **对象存储**: Cloudflare R2
- **AI 服务**: 支持多种 AI 图像生成服务 (如 Grsai API 等)

## 🚀 本地运行指南

### 1. 环境准备

- **Node.js**: 推荐 v20 或更高版本。
- **包管理器**: 推荐使用 `npm` 或 `pnpm`。
- **Supabase**: 需要一个 Supabase 项目用于数据库。
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

复制 `.env` 模板文件并重命名为 `.env.local`：

```bash
cp .env .env.local
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
# 访问密钥 (简单的访问控制)
ACCESS_KEYS=your_secret_key_1,your_secret_key_2
```

### 4. 数据库初始化

在 Supabase 项目的 SQL Editor 中执行以下 SQL 语句以创建数据表：

```sql
create table generations (
  id uuid default gen_random_uuid() primary key,
  task_id text not null,
  prompt text not null,
  model text,
  image_url text,
  status text default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 启用 RLS
alter table generations enable row level security;
```

### 5. 启动开发服务器

```bash
npm run dev
```

打开浏览器访问 [http://localhost:3000](http://localhost:3000) 即可开始使用。

## 📖 使用指南

1. **访问授权**: 首次使用可能需要配置访问密钥（Access Key），该密钥在 API 请求头中传递。
2. **生成图片**:
   - 在输入框中输入描述性的提示词（Prompt）。
   - (可选) 上传参考图片。
   - 选择模型、比例和分辨率。
   - 点击生成的 "Generate" 按钮。
3. **查看结果**: 生成过程中会显示进度条，完成后图片将自动展示在画廊区域。

## 📄 许可证

[MIT License](./LICENSE)
