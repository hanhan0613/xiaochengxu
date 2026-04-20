# 学生签到小程序

基于微信云开发的学生签到系统，支持 Excel 批量导入学生名单、二维码签到、实时查看签到状态。
**用户端与教师端已分离**：普通学生进入后只能看到签到页面，教师需要经过身份验证才能进入教师端和管理后台。

## 功能概述

- **学生端**：输入姓名和手机号验证身份，生成签到二维码
- **教师端**（仅授权教师可进入）：扫描学生二维码完成签到，实时查看全部学生签到状态和统计数据，进入管理后台
- **管理后台**（仅授权教师可进入）：Excel 一键上传学生名单（姓名+手机号），支持手动添加、重置签到、清空数据

## 项目结构

```
├── App.vue / main.js / manifest.json / pages.json
├── cloudfunctions/
│   ├── getRole/            # 获取当前用户角色（教师/学生）
│   ├── claimTeacher/       # 凭密码绑定当前 openid 为教师
│   ├── login/              # 学生登录验证（公开）
│   ├── uploadStudents/     # 批量上传学生（教师专属）
│   ├── checkIn/            # 扫码签到（教师专属）
│   ├── getStudents/        # 获取学生列表（教师专属）
│   ├── resetCheckin/       # 重置所有签到状态（教师专属）
│   └── clearStudents/      # 清空学生数据（教师专属）
├── pages/
│   ├── index/              # 首页（学生/教师身份选择）
│   ├── student/            # 学生端（登录+二维码）
│   ├── teacher/            # 教师端（扫码+签到列表+管理入口）
│   └── admin/              # 管理后台（Excel上传）
└── utils/
    ├── qrcode.js           # 二维码生成工具
    └── xlsx.mini.js        # Excel 解析工具
```

## 部署步骤

### 1. 准备工作

1. 注册微信小程序账号，获取 AppID
2. 下载并安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
3. 用 HBuilderX 打开本项目
4. 安装 Node.js（如果还没有）：[下载地址](https://nodejs.org/)

### 1.5 安装 npm 依赖（Excel 解析必需）

项目使用官方 [SheetJS](https://sheetjs.com/) 库解析 Excel，第一次拉代码后需要安装依赖：

```bash
# 项目根目录（和 pages.json 同级）
npm install
```

这会下载 `xlsx` 包到 `node_modules`。

**然后**在 HBuilderX 里重新编译（运行到小程序模拟器），uni-app 会自动把 xlsx
打包进 `unpackage/dist/dev/mp-weixin/common/vendor.js`，微信开发者工具直接用编译
输出即可。

> ⚠️ 注意：uni-app 项目**不需要**在微信开发者工具里点"工具 → 构建 npm"。
> 那是原生小程序项目才需要的操作，对 uni-app 无意义，点了会报
> "NPM packages not found"，直接忽略即可。

### 2. 配置云开发环境 ID

打开 `App.vue`，把 `env: 'cloud1-7gl718wp38e9e33c'` 替换为你自己的云开发环境 ID。

### 3. 创建数据库集合

在云开发控制台 -> 数据库中，创建两个集合：

- **students** — 学生数据表
- **admins** — 教师白名单（存教师 openid）

两个集合的权限都推荐设为 **"仅创建者可读写"**，所有读写都通过云函数进行，安全。

### 4. 设置教师初始化密码

打开 `cloudfunctions/claimTeacher/index.js`，修改 `SETUP_PASSWORD` 为你自己的密码：

```js
const SETUP_PASSWORD = 'teacher2026'   // ← 改成你的密码
```

建议至少 8 位且包含字母和数字，**只给教师本人知道**。

### 5. 上传云函数

在开发者工具中，右键点击 `cloudfunctions` 下每个云函数文件夹，选择
**"上传并部署：云端安装依赖"**：

- getRole
- claimTeacher
- login
- uploadStudents
- checkIn
- getStudents
- resetCheckin
- clearStudents

### 6. 教师首次绑定

1. 教师用微信打开小程序
2. 在首页点击 **"我是教师"**
3. 系统提示需要身份验证，输入步骤 4 设置的密码
4. 验证成功后，当前微信 openid 自动写入 `admins` 集合，以后再进入就直接识别为教师

之后教师和学生都打开同一个小程序，看到不同的入口：
- 学生 → 点 "我是学生" → 直接进入签到页面
- 教师 → 点 "我是教师" → 自动识别身份 → 进入教师端

## Excel 文件格式要求

上传的 Excel 文件（.xlsx）需包含以下列：

| 姓名 | 手机号      |
|------|-------------|
| 张三 | 13800138001 |
| 李四 | 13800138002 |

列名支持模糊匹配：「姓名/名字/name」和「手机/电话/号码/phone/tel」均可识别。

## 使用流程

1. **教师**（管理后台入口在教师端页面中）：上传包含学生姓名和手机号的 Excel 文件
2. **学生**：在学生端输入已登记的姓名和手机号，生成二维码
3. **教师**：点击"扫码签到"扫描学生二维码，完成签到
4. **教师**：实时查看签到统计和每位学生的签到状态

## 权限模型

- 云函数在服务端通过 `admins` 集合校验 openid，**仅教师可调用** 上传、查询、扫码签到、重置、清空等接口
- `getRole` 和 `login` 是公开云函数，任何人都能调用
- `claimTeacher` 只认预设的密码，密码可在源码中改
- 前端用 `onShow` 做一层拦截，非教师进入 teacher / admin 页面会被踢回首页

## 注意事项

- 二维码有效期为 5 分钟，过期后学生需重新进入页面刷新
- 已签到的学生重复扫码会提示「已签到」
- 重置签到状态会将所有学生恢复为「未签到」
- 清空数据操作不可恢复，请谨慎使用
- 若要撤销某位教师权限，直接到云开发控制台的 `admins` 集合里删掉对应记录即可
- 若忘记教师身份（换手机/微信），在云开发控制台往 `admins` 添加新的 openid 记录即可
