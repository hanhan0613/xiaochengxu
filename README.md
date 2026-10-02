# 学生签到小程序（uniCloud 版）

基于 **uniCloud（支付宝云）** 的学生签到系统，支持 Excel 批量导入学生名单、二维码签到、实时查看签到状态。
**用户端与教师端已分离**：普通学生进入后只能看到签到页面，教师需要经过身份验证才能进入教师端和管理后台。

> 本项目原先使用微信云开发（`wx.cloud`），现已整体迁移到 uniCloud，云函数运行在 DCloud 提供的"支付宝云"服务空间。后端鉴权仍沿用 `openid + 教师密码` 模型，前端 `uni.login` 拿 code，服务端通过微信 `jscode2session` 接口换取 openid。

## 功能概述

- **学生端**：输入姓名和手机号验证身份，生成签到二维码
- **教师端**（仅授权教师可进入）：扫描学生二维码完成签到，实时查看全部学生签到状态和统计数据
- **管理后台**（仅授权教师可进入）：Excel 一键上传学生名单（姓名+手机号+核验码），支持手动添加、重置签到、清空数据

## 项目结构

```
├── App.vue / main.js / manifest.json / pages.json
├── uniCloud-alipay/                       # uniCloud（支付宝云）
│   └── cloudfunctions/
│       ├── common/
│       │   └── wx-helper/                 # 公共模块：code 换 openid
│       ├── getRole/                       # 获取当前用户角色
│       ├── claimTeacher/                  # 凭密码绑定 openid 为教师
│       ├── login/                         # 学生登录验证（公开）
│       ├── uploadStudents/                # 批量上传学生（教师专属）
│       ├── checkIn/                       # 扫码签到（教师专属）
│       ├── getStudents/                   # 获取学生列表（教师专属）
│       ├── resetCheckin/                  # 重置签到状态（教师专属）
│       ├── clearStudents/                 # 清空学生数据（教师专属）
│       ├── listSessions/                  # 历史活动列表
│       ├── getCurrentSession/             # 当前活动信息
│       ├── getSessionDetail/              # 单个活动详情
│       ├── startSession/                  # 开启新活动
│       ├── endSession/                    # 结束当前活动
│       └── deleteSession/                 # 删除活动
├── pages/
│   ├── index/                             # 首页（学生/教师身份选择）
│   ├── student/                           # 学生端（登录+二维码）
│   ├── teacher/                           # 教师端（扫码+签到列表+管理入口）
│   ├── sessions/                          # 历史活动
│   └── admin/                             # 管理后台（Excel上传）
└── utils/
    ├── cloud.js                           # uniCloud.callFunction 统一封装
    ├── qrcode.js                          # 二维码生成工具
    └── xlsx.mini.js                       # Excel 解析工具
```

## 部署步骤

### 1. 准备工作

1. 注册微信小程序账号，获取 AppID 与 AppSecret
2. 用 HBuilderX（最新正式版，3.99 及以上）打开本项目
3. 安装 Node.js（如果还没有）：[下载地址](https://nodejs.org/)

### 1.5 安装 npm 依赖（Excel 解析必需）

```bash
# 项目根目录（和 pages.json 同级）
npm install
```

### 2. 关联 uniCloud 服务空间

1. 在 HBuilderX 中右键 `uniCloud-alipay/` 目录 → **关联云服务空间或项目**
2. 在弹窗里 **新建服务空间**，选择 **支付宝云**（首次使用 DCloud 账号需要绑定支付宝实名），免费配额即可
3. 关联完成后，目录图标上会显示一个云朵标记，表示已绑定

> 已经有支付宝云服务空间的，直接选已有的即可。

### 3. 配置微信 AppSecret（核心！）

打开 `uniCloud-alipay/cloudfunctions/common/wx-helper/index.js`，修改：

```js
const APPID = 'wxc977b49ec4a99643'                   // ← 改成你的 AppID
const APPSECRET = 'PUT_YOUR_WX_APP_SECRET_HERE'      // ← 必须改成你的 AppSecret
```

AppSecret 在 [微信公众平台](https://mp.weixin.qq.com) → 开发 → 开发设置 中查看；属于敏感凭据，**不要提交到公开仓库**。

> 没有正确配置 AppSecret，`getRole` / `claimTeacher` 会直接报错"请先在 common/wx-helper/index.js 配置 APPSECRET"。

### 4. 配置微信服务器域名白名单

云函数从微信服务器换取 openid 时会请求 `https://api.weixin.qq.com`，在 [微信公众平台](https://mp.weixin.qq.com) → 开发 → 开发设置 → 服务器域名 → **request 合法域名** 中添加该域名（一般无需配置，因为是云函数侧请求）。小程序端只需要把 `https://fc-mp-xxxxxx.next.bspapp.com`（支付宝云函数地址）加入 request 合法域名即可——HBuilderX 在发布时通常会自动提示这一项。

### 5. 设置教师初始化密码

打开 `uniCloud-alipay/cloudfunctions/claimTeacher/index.js`，修改：

```js
const SETUP_PASSWORD = 'teacher2026'   // ← 改成你的密码
```

建议至少 8 位且包含字母和数字，**只给教师本人知道**。

### 6. 上传云函数与公共模块

在 HBuilderX 中：

1. 右键 `uniCloud-alipay/cloudfunctions/common/wx-helper/` → **上传公共模块**
2. 右键 `uniCloud-alipay/cloudfunctions/` → **上传所有云函数、公共模块及 actions**
   （或对每个云函数单独右键 → 上传部署）

确认下列云函数全部上传成功：
`getRole · claimTeacher · login · uploadStudents · checkIn · getStudents · resetCheckin · clearStudents · listSessions · getCurrentSession · getSessionDetail · startSession · endSession · deleteSession`

### 7. 教师首次绑定

1. 教师用微信打开小程序
2. 在首页点击 **"我是教师"**
3. 系统提示需要身份验证，输入步骤 5 设置的密码
4. 验证成功后，当前微信 openid 自动写入 `admins` 集合，以后再进入就直接识别为教师

## 数据库集合

下列集合在第一次写入时会自动创建，不需要手动建：

- `admins` — 教师白名单（存 `_openid`）
- `students` — 学生数据表
- `sessions` — 签到活动
- `checkins` — 签到流水

如需在 uniCloud 控制台手动建集合，全部使用默认权限（`role:admin` 可读写）即可，因为读写都通过云函数代理。

## Excel 文件格式要求

上传的 Excel 文件（.xlsx）需包含以下列：

| 姓名 | 手机号      | 核验码 |
|------|-------------|--------|
| 张三 | 13800138001 | 1234   |
| 李四 | 13800138002 | 5678   |

列名支持模糊匹配：「姓名/名字/name」、「手机/电话/号码/phone/tel」、「核验码/验证码/密码/code/password/pwd」均可识别。

## 使用流程

1. **教师**（管理后台入口在教师端页面中）：上传包含学生姓名、手机号和核验码的 Excel 文件
2. **学生**：在学生端输入已登记的姓名、手机号和核验码，生成二维码
3. **教师**：点击"扫码签到"扫描学生二维码，完成签到
4. **教师**：实时查看签到统计和每位学生的签到状态；可在"历史记录"里回看每次活动的签到名单

## 鉴权模型（迁移说明）

- 小程序启动时 `App.vue` 调用 `uni.login({provider:'weixin'})` 拿 `code`，再调云函数 `getRole`，云函数通过 `jscode2session` 换 `openid` 并返回角色 → 前端把 `openid` 缓存到 `uni.storage`
- 后续所有云函数调用，由 `utils/cloud.js` 统一封装：自动把缓存的 `openid` 作为 `event._openid` 传给云函数
- 教师专属云函数在入口处校验 `_openid` 是否在 `admins` 集合中
- `claimTeacher` 与 `getRole` 一样会重新走一次 `code2session`，保证写入 `admins` 的 openid 真实可信

## 注意事项

- 二维码有效期为 5 分钟，过期后学生需重新进入页面刷新
- 已签到的学生重复扫码会提示「已签到」
- 重置签到状态会将所有学生恢复为「未签到」
- 清空数据操作不可恢复，请谨慎使用
- 若要撤销某位教师权限，直接到 uniCloud 控制台的 `admins` 集合里删掉对应记录即可
- 若忘记教师身份（换手机/微信），在 uniCloud 控制台往 `admins` 添加新的 `_openid` 记录即可
- 信任客户端传入的 `_openid` 是「最小改动」模式下的折衷，**不要把本项目结构原样用在金融、医疗等高敏感场景**。需要更高安全等级时，建议改为在每次调用都重新走 `code → openid` 校验，或接入 `uni-id`
