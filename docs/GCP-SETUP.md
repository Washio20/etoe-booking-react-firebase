# Google Cloud Platform 设置指南

本文档详细说明如何为 ETOE 酒店预约系统设置 Google Cloud Platform 环境。

## 1. 创建 GCP 项目

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 点击页面顶部的项目下拉菜单，然后点击"新建项目"
3. 输入项目名称 "etoehotel-booking"（或你希望的名称）
4. 选择组织和位置（如有必要）
5. 点击"创建"

## 2. 启用必要的 API

1. 在 Cloud Console 中，转到"API 和服务" > "库"
2. 搜索并启用以下 API：
   - Cloud Run API
   - Cloud Build API
   - Artifact Registry API
   - Secret Manager API
   - Firestore API
   - Identity and Access Management (IAM) API
   - Resource Manager API

## 3. 创建服务账号

1. 在 Cloud Console 中，转到"IAM 和管理" > "服务账号"
2. 点击"创建服务账号"
3. 输入服务账号名称 "github-actions"
4. 添加描述，例如 "用于 GitHub Actions 部署"
5. 点击"创建并继续"
6. 分配以下角色：
   - Cloud Run Admin
   - Cloud Build Service Account
   - Artifact Registry Administrator
   - Service Account User
   - Storage Admin
   - Secret Manager Admin
   - Service Account Token Creator
7. 点击"完成"

## 4. 创建服务账号密钥

1. 在服务账号列表中，找到刚创建的服务账号
2. 点击服务账号名称进入详情页
3. 点击"密钥"选项卡
4. 点击"添加密钥" > "创建新密钥"
5. 选择"JSON"格式
6. 点击"创建"并保存下载的 JSON 文件

## 5. 创建 Artifact Registry 仓库

1. 在 Cloud Console 中，转到"Artifact Registry" > "仓库"
2. 点击"创建仓库"
3. 输入名称 "etoehotel-booking"
4. 选择格式 "Docker"
5. 选择位置类型 "区域"，然后选择 "asia-northeast1"
6. 点击"创建"

## 6. 设置 Firestore 数据库 （这一步不需要，已建好了！）

1. 在 Cloud Console 中，转到"Firestore"
2. 点击"创建数据库"
3. 选择"生产模式"或"开发模式"（根据需要）
4. 选择数据库位置（建议选择 "asia-northeast1"）
5. 点击"创建"

## 7. 设置 GitHub Secrets

使用步骤 4 中下载的服务账号密钥文件的内容作为 GitHub Secrets 的`GCP_SA_KEY`。

1. 打开 GitHub 仓库
2. 转到"设置" > "Secrets and variables" > "Actions"
3. 点击"新建仓库密钥"
4. 名称输入 "GCP_SA_KEY"
5. 值输入服务账号密钥 JSON 文件的全部内容
6. 点击"添加密钥"

## 8. 创建 Cloud Run 服务（手动部署）

1. 在 Cloud Console 中，转到"Cloud Run"
2. 点击"创建服务"
3. 选择 "部署一个修订版本来自现有容器镜像"（第一次部署时可以先手动部署一个简单的镜像）
4. 容器镜像 URL 可以使用一个基础镜像，例如 `us-docker.pkg.dev/cloudrun/container/hello`
5. 服务名称输入 "etoehotel-booking-app"
6. 区域选择 "asia-northeast1"
7. 认证选择 "允许未经认证的调用"
8. 点击"创建"

## 9. 设置 Secret Manager 密钥

为敏感配置创建 Secret Manager 密钥：

1. 在 Cloud Console 中，转到"Security" > "Secret Manager"
2. 点击"创建密钥"
3. 输入密钥名称，例如 "firebase-private-key"
4. 点击"上传文件"上传Firebase私钥JSON文件
5. 输入密钥值
6. 点击"创建密钥"

Stripe密钥：
名称：stripe-secret-key
值：您的Stripe API密钥（通常以sk_开头）
Stripe Webhook密钥：
名称：stripe-webhook-secret
值：您的Stripe Webhook签名密钥（通常以whsec_开头）
Gmail刷新令牌：
名称：gmail-refresh-token
值：您的Gmail API刷新令牌
Gmail client secret：
名称：gmail-client-secret
值：您的Gmail API secret

对每个敏感配置项重复以上步骤。

## 10. 设置环境变量

在 Cloud Run 服务中设置环境变量：

1. 在 Cloud Console 中，转到"Cloud Run"
2. 选择服务 "etoehotel-booking-app"
3. 点击"修改并部署新修订版本"
4. 展开"容器，变量和密钥"部分
5. 在"环境变量"部分添加所需的环境变量
6. 在"引用密钥"部分添加从 Secret Manager 引用的密钥
7. 点击"部署"

添加Secret Manager Secret Accessor角色：

前往Google Cloud控制台 -> IAM & 管理 -> IAM
点击"添加"按钮
在"新的主账号"字段中输入xxxxxx-compute@developer.gserviceaccount.com
添加角色"Secret Manager Secret Accessor"（角色ID: roles/secretmanager.secretAccessor）
点击"保存"

## 11. 设置域名（可选）

如果你要使用自定义域名：

1. 在 Cloud Console 中，转到"Cloud Run"
2. 选择服务 "etoehotel-booking-app"
3. 转到"域映射"选项卡
4. 点击"添加映射"
5. 输入已验证的域名
6. 点击"继续"并按照说明进行 DNS 设置

## 12. 设置 Webhook（Stripe 等）

对于 Stripe Webhook 等外部服务的回调 URL，需要确保：

1. 回调 URL 指向 Cloud Run 服务的 URL
2. 相应的 API 路由已在应用中实现
3. Webhook 签名验证正确设置

## 故障排除

- **权限问题**: 检查服务账号是否有所有必要权限
- **区域限制**: 确保所有资源都在同一区域创建
- **日志查看**: 使用 Cloud Logging 检查应用日志以诊断问题


