# InstaBox 机器管理（Vercel 版）

一个可部署在 Vercel 上的全栈应用：浏览器 → Vercel Serverless 代理函数 → InstaBox API。
代理函数在服务端附加 API Key，规避浏览器 CORS 限制，且 Key 无需硬编码在前端。

## 目录结构

```
vercel-instabox/
├── api/
│   └── [...path].js   # Serverless 代理函数（Node 运行时），catch-all 转发到 api.instabox.sh/v1
├── src/
│   ├── main.jsx       # React 入口
│   ├── app.jsx        # 列表页 + 详情页（生命周期 / 命令 / 指标 / 轮询）
│   ├── api.js         # 前端请求封装
│   └── styles.css     # 响应式样式（移动端单列）
├── index.html
├── vite.config.js
├── vercel.json
└── package.json
```

## 功能

- 机器列表：状态、规格、创建时间，点击进入详情
- 生命周期：启动 / 停止 / 暂停 / 恢复 / 删除（删除带确认），操作后轮询状态
- 执行命令：返回 stdout / stderr / exitCode
- 资源指标：CPU、内存使用率

## API Key 的两种模式

1. **服务端环境变量（推荐）**：在 Vercel 配置环境变量 `INSTABOX_API_KEY`，浏览器完全接触不到 Key，前端 Key 栏留空即可。
2. **前端填写**：在页面填入 `ibk_` Key，保存在浏览器 localStorage，经请求头 `x-api-key` 透传。

函数优先使用环境变量，其次使用请求头。

## 本地开发

```bash
npm install
npm run dev
```

## 部署到 Vercel

### 方式一：GitHub 导入（无需本地命令）

1. 把本目录推送到 GitHub 仓库
2. Vercel 控制台 → Add New → Project → 导入该仓库
3. Build/Output 已在 vercel.json 配置好，直接 Deploy
4. 在 Project → Settings → Environment Variables 添加 `INSTABOX_API_KEY`（可选，不填则用前端输入）
5. 重新部署一次生效

### 方式二：Vercel CLI

```bash
npm i -g vercel
vercel            # 首次部署，按提示登录、关联
vercel env add INSTABOX_API_KEY   # 可选：添加服务端 Key
vercel --prod     # 生产部署
```

## 环境要求

- Node.js ≥ 18（本地开发建议 20+）
- 无需数据库
