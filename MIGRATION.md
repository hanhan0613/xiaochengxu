# 微信云开发 → uniCloud（支付宝云）迁移记录

本文档记录学生签到小程序从 **微信云开发**（`wx.cloud`）迁移到 **uniCloud 支付宝云** 的全部改动。按操作顺序记录，便于回溯。

迁移时间：2026-05-11
迁移分支：`claude/heuristic-faraday-50309a`

---

## 一、迁移方案选型

| 决策项 | 选择 | 备选项 |
|---|---|---|
| 服务空间 | 支付宝云（`uniCloud-alipay`） | 阿里云、腾讯云 |
| 鉴权模型 | 保留 `openid + 教师密码`（最小改动） | 改用 `uni-id` 账号体系 |
| 函数风格 | 保留 `callFunction` 风格 | 重构为云对象 cloudObject |
| 备份策略 | Git 分支已存在，原地改写 | 新建目录、保留旧代码 |

核心差异：微信云开发的 `cloud.getWXContext()` 在 uniCloud 不可用，需要由前端 `uni.login()` 拿 `code` 传给云函数，云函数主动调用微信 `jscode2session` 接口换取 `openid`。

---

## 二、目录结构变化

### 删除

```
cloudfunctions/                # 整个目录连同 14 个云函数
  ├── checkIn/
  ├── claimTeacher/
  ├── clearStudents/
  ├── deleteSession/
  ├── endSession/
  ├── getCurrentSession/
  ├── getRole/
  ├── getSessionDetail/
  ├── getStudents/
  ├── listSessions/
  ├── login/
  ├── resetCheckin/
  ├── startSession/
  └── uploadStudents/

copy-cloudfunctions.bat        # 微信云开发用的复制脚本，uniCloud 不再需要
```

### 新增

```
uniCloud-alipay/
  └── cloudfunctions/
      ├── checkIn/            { index.js, package.json }
      ├── claimTeacher/       { index.js, package.json }   ← 内联 code2openid
      ├── clearStudents/      { index.js, package.json }
      ├── deleteSession/      { index.js, package.json }
      ├── endSession/         { index.js, package.json }
      ├── getCurrentSession/  { index.js, package.json }
      ├── getRole/            { index.js, package.json }   ← 内联 code2openid
      ├── getSessionDetail/   { index.js, package.json }
      ├── getStudents/        { index.js, package.json }
      ├── listSessions/       { index.js, package.json }
      ├── login/              { index.js, package.json }
      ├── resetCheckin/       { index.js, package.json }
      ├── startSession/       { index.js, package.json }
      └── uploadStudents/     { index.js, package.json }

utils/
  └── cloud.js                # 新增：前端统一封装 uniCloud.callFunction
```

> 说明：曾经尝试用 `common/wx-helper/` 作为公共模块统一管理 `code2openid`，但因 uniCloud 公共模块在不同 HBuilderX 版本/服务空间下的依赖声明不一致，最终改为**把 `code2openid` 内联进 `getRole` 与 `claimTeacher`** 两个函数。

---

## 三、配置文件改动

### `manifest.json`

**变化**：删除 `mp-weixin.cloudfunctionRoot`，新增 `uniCloud.provider`。

```diff
 "mp-weixin" : {
     "appid" : "wxc977b49ec4a99643",
     "setting" : { ... },
     "usingComponents" : true,
-    "lazyCodeLoading" : "requiredComponents",
-    "cloudfunctionRoot" : "cloudfunctions/"
+    "lazyCodeLoading" : "requiredComponents"
+},
+"uniCloud" : {
+    "provider" : "alipay"
 }
```

### `project.config.json`（微信开发者工具配置）

**变化**：删除 `cloudfunctionRoot` 与 `cloud` 字段。

```diff
 "appid": "wxc977b49ec4a99643",
-"cloudfunctionRoot": "cloudfunctions/",
-"cloud": true,
 "editorSetting": {}
```

---

## 四、云函数改动（共 14 个）

### 4.1 通用改造模式

所有云函数都做了以下统一改动：

| 原（微信云开发） | 新（uniCloud） |
|---|---|
| `const cloud = require('wx-server-sdk')` | （删除整行） |
| `cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })` | （删除整行） |
| `const db = cloud.database()` | `const db = uniCloud.database()` |
| `const { OPENID } = cloud.getWXContext()` | `const { _openid } = event` （由前端注入） |
| `db.serverDate()` | `Date.now()` |
| `db.collection('x').add({ data: {...} })` | `db.collection('x').add({...})` （uniCloud 没有 `data:` 包裹） |
| `db.collection('x').doc(id).update({ data: {...} })` | `db.collection('x').doc(id).update({...})` |
| `res.stats.removed` | `res.deleted` |
| `res.stats.updated` | `res.updated` |
| `addRes._id` | `addRes.id`（兼容写 `addRes.id || addRes._id`） |
| `package.json` 里 `"wx-server-sdk": "~2.6.3"` | （删除依赖） |

`package.json` 简化为：

```json
{
  "name": "xxx",
  "version": "1.0.0",
  "description": "...",
  "main": "index.js"
}
```

### 4.2 鉴权改造

原来每个云函数里的 `requireTeacher()`：

```js
// 原版（微信云开发）
async function requireTeacher() {
  const { OPENID } = cloud.getWXContext()
  const res = await db.collection('admins').where({ _openid: OPENID }).get()
  if (res.data.length === 0) {
    return { ok: false, message: '无权限' }
  }
  return { ok: true, openid: OPENID }
}
```

改造为接收前端传入的 `_openid`：

```js
// 新版（uniCloud）
async function requireTeacher(openid) {
  if (!openid) return { ok: false, message: '未登录，请重新进入小程序' }
  const res = await db.collection('admins').where({ _openid: openid }).get()
  if (!res.data || res.data.length === 0) {
    return { ok: false, message: '无权限' }
  }
  return { ok: true, openid }
}

exports.main = async (event, context) => {
  const { _openid, ...其他参数 } = event || {}
  const auth = await requireTeacher(_openid)
  if (!auth.ok) return { success: false, message: auth.message }
  // ...
}
```

### 4.3 `getRole` 与 `claimTeacher` 特殊处理

这两个函数是登录入口，需要把前端传入的微信登录 `code` 通过 `jscode2session` 换成 `openid`，**内联**了 `code2openid` 函数（见 [六、关键配置](#六关键配置)）。

`getRole` 关键改动：

```js
// 原版
exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  // ...
}

// 新版
exports.main = async (event, context) => {
  const { code } = event || {}
  const login = await code2openid(code)
  if (!login.ok) return { success: false, message: login.message }
  const openid = login.openid
  // ...
}
```

`claimTeacher` 同上，多了密码校验：

```js
exports.main = async (event, context) => {
  const { password, code } = event || {}
  if (!password || password !== SETUP_PASSWORD) {
    return { success: false, message: '密码错误' }
  }
  const login = await code2openid(code)
  // ...
}
```

### 4.4 `login`（学生登录）

不需要 openid，原本就只校验姓名/手机号/核验码。改动最小：只把 SDK 引用换掉，去掉 `data:` 包裹。

### 4.5 各云函数功能未变

业务逻辑全部保留：

| 云函数 | 功能 | 改动级别 |
|---|---|---|
| `getRole` | 获取角色 | 中（加 code2openid） |
| `claimTeacher` | 教师身份绑定 | 中（加 code2openid） |
| `login` | 学生登录验证 | 小（仅 SDK 替换） |
| `uploadStudents` | 批量上传学生 | 小 |
| `checkIn` | 扫码签到 | 小 |
| `getStudents` | 学生列表 | 小 |
| `resetCheckin` | 重置签到状态 | 小 |
| `clearStudents` | 清空学生 | 小 |
| `listSessions` | 历史活动列表 | 小 |
| `getCurrentSession` | 当前活动 | 小 |
| `getSessionDetail` | 活动详情 | 小 |
| `startSession` | 开启新活动 | 小 |
| `endSession` | 结束活动 | 小 |
| `deleteSession` | 删除活动 | 小 |

---

## 五、前端改动

### 5.1 新增 `utils/cloud.js`（统一封装）

提供三个导出函数：

```js
export function callFunction(name, data = {}, options = {})
// 包装 uniCloud.callFunction，默认从 storage 取 openid 注入到 event._openid

export function wxLoginCode()
// 调用 uni.login({provider:'weixin'}) 返回 code

export async function fetchRole()
// uni.login → 拿 code → 调 getRole 云函数 → 把 openid/role 写入 storage

export async function claimTeacher(password)
// uni.login → 拿 code → 调 claimTeacher → 写入 storage
```

返回结构与 `wx.cloud.callFunction` 保持一致（`{ result: ... }`），让原代码可以最小改动。

### 5.2 `App.vue`

```diff
 <script>
-async function fetchRole(globalData) {
-  try {
-    const res = await wx.cloud.callFunction({ name: 'getRole' })
-    ...
-  }
-}
+import { fetchRole } from '@/utils/cloud.js'

 export default {
-  onLaunch() {
-    if (!wx.cloud) {
-      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
-      return
-    }
-    try {
-      wx.cloud.init({ env: 'cloud1-7gl718wp38e9e33c', traceUser: true })
-      console.log('[cloud] init ok')
-    } catch (e) {
-      console.error('[cloud] init failed:', e)
-      return
+  async onLaunch() {
+    try {
+      const r = await fetchRole()
+      if (r && r.success) {
+        this.globalData.role = r.role
+        this.globalData.openid = r.openid
+      }
+    } catch (err) {
+      console.error('获取角色失败:', err)
     }
-    fetchRole(this.globalData)
   },
   globalData: { userInfo: null, role: null, openid: null }
 }
```

### 5.3 `pages/index/index.vue`（首页）

```diff
+import { fetchRole, claimTeacher } from '@/utils/cloud.js'

 async goTeacher() {
-  const res = await wx.cloud.callFunction({ name: 'getRole' })
-  const r = res && res.result ? res.result : {}
-  if (r.success && r.role === 'teacher') {
-    uni.setStorageSync('role', 'teacher')
-    uni.setStorageSync('openid', r.openid)
-    uni.navigateTo({ url: '/pages/teacher/teacher' })
-  } else { this.showTeacherAuth = true }
+  const r = await fetchRole()
+  if (r.success && r.role === 'teacher') {
+    uni.navigateTo({ url: '/pages/teacher/teacher' })
+  } else { this.showTeacherAuth = true }
 }

 async submitClaim() {
-  const res = await wx.cloud.callFunction({
-    name: 'claimTeacher',
-    data: { password: this.authPassword.trim() }
-  })
-  const r = res && res.result ? res.result : {}
-  if (r.success) {
-    uni.setStorageSync('role', 'teacher')
-    uni.setStorageSync('openid', r.openid)
-    ...
+  const r = await claimTeacher(this.authPassword.trim())
+  if (r.success) {
+    ...
   }
 }
```

### 5.4 `pages/student/student.vue`（学生端）

```diff
+import { callFunction } from '@/utils/cloud.js'

 // doLogin
-const res = await wx.cloud.callFunction({
-  name: 'login',
-  data: { name, phone, code }
-})
+const res = await callFunction('login',
+  { name, phone, code },
+  { withOpenid: false }  // 学生端无需注入 openid
+)

 // refreshStatus 同理
```

### 5.5 `pages/admin/admin.vue`（管理后台）

```diff
+import { callFunction, fetchRole } from '@/utils/cloud.js'

 // ensureTeacher
-const res = await wx.cloud.callFunction({ name: 'getRole' })
-const r = res && res.result ? res.result : {}
-role = r.role
+const r = await fetchRole()
+role = r.role

 // uploadStudents
-const res = await wx.cloud.callFunction({
-  name: 'uploadStudents',
-  data: { students: chunk }
-})
+const res = await callFunction('uploadStudents', { students: chunk })

 // addManual 同理
```

### 5.6 `pages/sessions/sessions.vue`（历史活动）

```diff
+import { callFunction, fetchRole } from '@/utils/cloud.js'

 // ensureTeacher → 改 fetchRole()
 // loadSessions → callFunction('listSessions', { page, pageSize })
 // openDetail → callFunction('getSessionDetail', { sessionId })
 // confirmDelete → callFunction('deleteSession', { sessionId })
```

### 5.7 `pages/teacher/teacher.vue`（教师端）

```diff
+import { callFunction, fetchRole } from '@/utils/cloud.js'

 // ensureTeacher → fetchRole()
 // endCurrentSession → callFunction('endSession')
 // loadCurrentSession → callFunction('getCurrentSession')
 // submitNewSession → callFunction('startSession', { title, clearStudents })
 // loadStudents → callFunction('getStudents', { page, pageSize, filter })
 // scanQRCode 里的 checkIn → callFunction('checkIn', { studentId })
```

---

## 六、关键配置

### 6.1 微信 AppID / AppSecret（必改）

由于 uniCloud 与微信无直接关联，需要云函数主动调微信接口换 openid。`getRole/index.js` 与 `claimTeacher/index.js` 文件顶部均有：

```js
const APPID = 'wxc977b49ec4a99643'                  // ← 你的小程序 AppID
const APPSECRET = 'ac208e4b183a56489364eceb617afaaf' // ← 你的 AppSecret（敏感）
```

**注意**：两个文件都要保持一致，AppSecret 轮换时**两个都改**。

### 6.2 教师密码

`claimTeacher/index.js` 顶部：

```js
const SETUP_PASSWORD = 'teacher2026'
```

### 6.3 微信小程序合法域名

小程序需要把 uniCloud 服务空间的请求域名加入"request 合法域名"，HBuilderX 在发布或首次运行时会自动提示。一般是 `https://fc-mp-xxxxxxxx.next.bspapp.com` 这种形式。

---

## 七、鉴权时序图

```
用户进入小程序
       │
       ▼
App.vue.onLaunch()
       │
       ▼
fetchRole()  ──── uni.login({provider:'weixin'}) ──► 拿到 code
       │
       ▼
uniCloud.callFunction('getRole', { code })
       │
       ▼
┌───────────────────────────────────┐
│ 云函数 getRole：                  │
│   1. code2openid(code)            │
│      ├─ HTTPS GET                 │
│      ├─ api.weixin.qq.com/        │
│      │  sns/jscode2session         │
│      └─ 拿到 openid               │
│   2. 查 admins 集合是否含 openid  │
│   3. 返回 { openid, role }        │
└───────────────────────────────────┘
       │
       ▼
前端把 openid 写入 uni.storage
       │
       ▼
后续所有 callFunction(...) 自动注入
event._openid = uni.getStorageSync('openid')
       │
       ▼
教师专属云函数：
  requireTeacher(event._openid)
    └─ 查 admins 集合 → 通过/拒绝
```

---

## 八、数据库集合

uniCloud 与微信云开发的集合 API 几乎一致，原数据可以**整表迁移**。

四个集合（首次写入时自动创建）：

| 集合 | 用途 | 关键字段 |
|---|---|---|
| `admins` | 教师白名单 | `_openid`, `createdAt` |
| `students` | 学生数据 | `name`, `phone`, `code`, `checkedIn`, `checkInTime` |
| `sessions` | 签到活动 | `title`, `status`, `studentSnapshot`, `totalStudents`, `checkedCount` |
| `checkins` | 签到流水 | `sessionId`, `studentId`, `studentName`, `checkInTime` |

如果有历史数据需要从微信云开发迁过来，可以在微信云开发控制台 → 数据库 → 导出 JSON，再到 uniCloud 控制台导入。

---

## 九、部署流程

1. **在 HBuilderX 中关联 uniCloud 服务空间**
   - 右键 `uniCloud-alipay` 目录 → 关联云服务空间或项目 → 新建 / 选择已有服务空间（选「支付宝云」）

2. **填写微信 AppSecret**
   - 编辑 `uniCloud-alipay/cloudfunctions/getRole/index.js`
   - 编辑 `uniCloud-alipay/cloudfunctions/claimTeacher/index.js`
   - 修改 `APPSECRET` 常量

3. **上传所有云函数**
   - 右键 `uniCloud-alipay/cloudfunctions/` → 上传所有云函数

4. **切换运行模式到云端**
   - 顶部菜单：运行 → 运行到小程序模拟器 → 勾选「运行时连接云端云函数」

5. **运行到微信开发者工具**
   - HBuilderX → 运行 → 运行到小程序模拟器 → 微信开发者工具
   - 注意：微信开发者工具需在「设置 → 安全设置」中打开「服务端口」

6. **首次教师绑定**
   - 在首页点「我是教师」
   - 输入 `SETUP_PASSWORD` 设置的密码
   - 成功后 openid 写入 `admins`，后续自动识别

---

## 十、已知行为差异 & 注意事项

| 项 | 微信云开发 | uniCloud | 影响 |
|---|---|---|---|
| openid 来源 | `cloud.getWXContext()` 自动 | 前端传 code，云函数 HTTP 换取 | 多一次网络请求（约 100~200ms） |
| openid 可信度 | 服务端注入，不可伪造 | 客户端缓存后注入 `_openid` | 可被恶意客户端伪造（本项目场景可接受） |
| 数据库返回 | `res.stats.removed/updated` | `res.deleted/updated` | 已在代码中适配 |
| 新增记录返回 ID | `addRes._id` | `addRes.id` | 已用 `addRes.id \|\| addRes._id` 兜底 |
| `db.serverDate()` | 支持 | 部分支持但行为不同 | 改为 `Date.now()` 由云函数本地生成 |
| 公共模块 | 通过 `wx-server-sdk` 内置 | 需声明 `dependencies` 或内联 | 本项目选择内联以避免依赖坑 |

**安全提醒**：当前鉴权模型信任客户端传入的 `_openid`，适合内部、低敏感场景（如本签到系统）。若要扩展为更通用的业务，建议改为以下任一方案：

- **每次都重新换取**：客户端每次 `callFunction` 都先 `uni.login` 取新 code 传给云函数，云函数再 `code2session` —— 安全但慢
- **接入 uni-id**：使用 DCloud 的 `uni-id-co` 体系，发放 token，云函数校验 token

---

## 十一、改动文件清单

### 新增

- `uniCloud-alipay/cloudfunctions/checkIn/{index.js, package.json}`
- `uniCloud-alipay/cloudfunctions/claimTeacher/{index.js, package.json}`
- `uniCloud-alipay/cloudfunctions/clearStudents/{index.js, package.json}`
- `uniCloud-alipay/cloudfunctions/deleteSession/{index.js, package.json}`
- `uniCloud-alipay/cloudfunctions/endSession/{index.js, package.json}`
- `uniCloud-alipay/cloudfunctions/getCurrentSession/{index.js, package.json}`
- `uniCloud-alipay/cloudfunctions/getRole/{index.js, package.json}`
- `uniCloud-alipay/cloudfunctions/getSessionDetail/{index.js, package.json}`
- `uniCloud-alipay/cloudfunctions/getStudents/{index.js, package.json}`
- `uniCloud-alipay/cloudfunctions/listSessions/{index.js, package.json}`
- `uniCloud-alipay/cloudfunctions/login/{index.js, package.json}`
- `uniCloud-alipay/cloudfunctions/resetCheckin/{index.js, package.json}`
- `uniCloud-alipay/cloudfunctions/startSession/{index.js, package.json}`
- `uniCloud-alipay/cloudfunctions/uploadStudents/{index.js, package.json}`
- `utils/cloud.js`
- `MIGRATION.md`（本文件）

### 修改

- `App.vue`
- `manifest.json`
- `project.config.json`
- `pages/index/index.vue`
- `pages/student/student.vue`
- `pages/admin/admin.vue`
- `pages/sessions/sessions.vue`
- `pages/teacher/teacher.vue`
- `README.md`

### 删除

- `cloudfunctions/`（含 14 个原 wx-server-sdk 云函数）
- `copy-cloudfunctions.bat`

### 中途新增后又删除

- `uniCloud-alipay/cloudfunctions/common/wx-helper/{index.js, package.json}`
  原本作为公共模块抽取 `code2openid`，因 uniCloud 公共模块依赖声明在不同环境下表现不稳定，最终改为把 `code2openid` 内联到 `getRole` 与 `claimTeacher` 中。

---

## 十二、回归测试清单

部署后建议按下表逐项确认：

| # | 操作 | 预期结果 |
|---|---|---|
| 1 | 学生首次进入小程序 | 控制台 `[role] student [openid] ********` |
| 2 | 学生点「我是学生」→ 输入信息 | 跳转学生页并生成二维码 |
| 3 | 教师首次点「我是教师」 | 弹出密码框 |
| 4 | 输入正确密码 | 跳转教师端，`admins` 集合新增一条 `_openid` |
| 5 | 教师二次进入 | 跳过密码，直接进教师端 |
| 6 | 教师扫学生二维码 | 学生签到成功，`students.checkedIn=true` |
| 7 | 教师进管理后台上传 Excel | `students` 集合批量插入数据 |
| 8 | 教师开启新活动 | `sessions` 新增一条 `status:'active'` 的记录 |
| 9 | 教师查看历史活动 | 列表返回所有 sessions |
| 10 | 教师删除活动 | `sessions` 减一，相关 `checkins` 清理 |

---

迁移完成。如有问题，先检查：

1. 控制台 `App.vue:14 [getRole] result not success: <message>` 看 message 内容
2. uniCloud 控制台 → 云函数日志，查每次 callFunction 的真实异常
3. AppSecret 是否在两个文件中都填了
4. 是否切到了「云端」模式（左下角 uniCloud 切换器）
