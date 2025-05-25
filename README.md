# ETOE 酒店预约系统

ETOE 酒店预约系统是一个基于 Next.js 的 Web 应用，用于管理酒店房间预约和支付流程。


## 分支說明

**dev** - 
開發分支，禁止刪除

[https://dev-etoe-booking-site-9tifb.ondigitalocean.app](https://dev-etoe-booking-site-9tifb.ondigitalocean.app/)


**staging** - 
release前預覽分支，禁止刪除，在代碼合併到main分支前，請合併代碼到這個分支預覽效果

[https://etoehotel-book-site-staging-jp4or.ondigitalocean.app](https://etoehotel-book-site-staging-jp4or.ondigitalocean.app/)


**main** - 
release分支，應只存放經過測試到最穩定代碼

[https://book.etoehotel.com/](https://book.etoehotel.com/)

## 功能特点

- 用户认证与账户管理
- 房间类型浏览与选择
- 预约日期与时间段选择
- 集成 Stripe 支付系统
- 预约管理与历史记录查看
- 入住二维码生成

## 技术栈

- **前端**: Next.js, React, TailwindCSS
- **后端**: Next.js API Routes, Firebase Admin SDK
- **数据库**: Firebase Firestore
- **认证**: Firebase Authentication
- **支付处理**: Stripe
- **部署**: Google Cloud Run

## 开发环境设置

1. 克隆仓库:

```bash
git clone https://github.com/your-username/etoehotel-booking-firebase.git
cd etoehotel-booking-firebase
```

2. 安装依赖:

```bash
npm install
```

3. 创建环境变量文件:

```bash
cp .env.example .env.local
```

4. 编辑 `.env.local` 文件，填入必要的配置信息。

5. 启动开发服务器:

```bash
npm run dev
```

## 部署

本项目使用 GitHub Actions 自动部署到 Google Cloud Run。

详细的部署说明请查看:

- [部署指南](docs/DEPLOYMENT.md)
- [GCP 设置指南](docs/GCP-SETUP.md)

### 部署流程概述

1. 代码推送到 GitHub 的 main 分支触发 CI/CD 流程
2. GitHub Actions 运行构建和部署脚本
3. 应用打包为 Docker 容器并推送到 GCP Artifact Registry
4. 容器部署到 Google Cloud Run 服务

## 测试

运行测试:

```bash
npm run test
```

## 项目结构

```
├── src/
│   ├── app/             # 页面和API路由
│   ├── components/      # React组件
│   ├── types/           # TypeScript类型定义
│   └── utils/           # 工具函数
├── public/              # 静态资源
├── docs/                # 项目文档
└── .github/             # GitHub Actions工作流配置
```

## 贡献指南

1. Fork 仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 许可证

[需添加适当的许可证信息]
