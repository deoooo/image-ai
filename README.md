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
- **数据库**: PostgreSQL (via [Prisma](https://www.prisma.io/))
- **对象存储**: Vercel Blob / AWS S3 Compatible (Cloudflare R2)
- **AI 服务**: 支持多种 AI 图像生成服务 (如 Grsai API 等)

## 🚀 快速开始

### 1. 环境准备

确保你的本地环境已安装：

- Node.js (推荐 v20+)
- pnpm / npm / yarn

### 2. 克隆项目

```bash
git clone https://github.com/deoooo/image-ai.git
cd image-ai
```

### 3. 安装依赖

```bash
npm install
# 或
pnpm install
```

### 4. 配置环境变量

复制 `.env` 模板文件并重命名为 `.env.local`：

```bash
cp .env .env.local
```

在 `.env.local` 中填入必要的配置信息：

```env
# AI API 配置 (示例：Grsai API)
GRSAI_API_KEY=your_api_key_here
GRSAI_API_BASE_URL=https://api.example.com

# 数据库配置 (PostgreSQL)
DATABASE_URL="postgresql://..."

# 存储配置 (如使用 Vercel Blob 或 S3)
BLOB_READ_WRITE_TOKEN=...
# 或 AWS/R2 配置
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=...
AWS_BUCKET_NAME=...
```

### 5. 初始化数据库

```bash
npm run postinstall
```

### 6. 启动开发服务器

```bash
npm run dev
```

打开浏览器访问 [http://localhost:3000](http://localhost:3000) 即可看到应用界面。

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
