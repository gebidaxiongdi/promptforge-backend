# PromptForge 后端 - 部署指南

## 1. 在 Vercel 设置环境变量

在 Vercel 项目后台 → Settings → Environment Variables，添加：

```
AGNES_API_KEY = sk-PaGMEEkOGqzOJkxhUMjjvntwemW6Xo5I9nrrkkBbZehnkEzM
```

## 2. 部署步骤

### 方式一：GitHub + Vercel（推荐）
1. 在 GitHub 新建仓库
2. 把这个文件夹的代码推送上去
3. 打开 vercel.com → Add New Project → 选择 GitHub 仓库
4. 框架选 "Other"，点 Deploy
5. 部署完成后得到一个域名（如 promptforge.vercel.app）

### 方式二：Vercel CLI
1. 安装 Vercel CLI: npm i -g vercel
2. 在文件夹里运行: vercel --prod
3. 按提示登录 Vercel 账号

## 3. 部署后得到 API 地址

例如：https://promptforge.vercel.app/api/chat
