<template>
  <view class="container">
    <!-- 登录表单 -->
    <view v-if="!isLoggedIn" class="login-section">
      <view class="login-header">
        <view class="login-icon-wrap">
          <text class="login-icon-text">&#x1F393;</text>
        </view>
        <text class="page-title">学生签到</text>
        <text class="page-subtitle">输入姓名、手机号和核验码，生成签到码</text>
      </view>

      <view class="card">
        <view class="input-group">
          <text class="input-label">姓名</text>
          <input
            class="input-field"
            placeholder="输入你的姓名"
            placeholder-class="input-placeholder"
            :adjust-position="true"
            v-model="name"
          />
        </view>

        <view class="input-group">
          <text class="input-label">手机号</text>
          <input
            class="input-field"
            type="text"
            placeholder="输入手机号"
            placeholder-class="input-placeholder"
            :adjust-position="true"
            v-model="phone"
          />
        </view>

        <view class="input-group">
          <text class="input-label">核验码</text>
          <input
            class="input-field"
            type="text"
            placeholder="输入核验码"
            placeholder-class="input-placeholder"
            :adjust-position="true"
            v-model="code"
          />
        </view>

        <button class="btn-primary" @click="doLogin" :disabled="isLoading">
          {{ isLoading ? '验证中...' : '生成签到二维码' }}
        </button>
      </view>
    </view>

    <!-- 登录后视图 -->
    <view v-if="isLoggedIn" class="qr-section">
      <!-- 已签到：不显示二维码，显示大字 -->
      <view v-if="studentInfo && studentInfo.checkedIn" class="card done-card">
        <view class="done-icon-wrap">
          <text class="done-icon">&#x2713;</text>
        </view>
        <text class="done-title">已签到</text>
        <text class="done-sub">签到完成，无需再出示二维码</text>

        <view class="done-info">
          <text class="done-name">{{ studentInfo.name }}</text>
          <text class="done-phone">{{ phoneDisplay }}</text>
        </view>
      </view>

      <!-- 未签到：显示二维码 -->
      <view v-else class="card qr-card">
        <view class="qr-status-bar">
          <text class="qr-student-name">{{ studentInfo.name }}</text>
          <view class="tag-unchecked">未签到</view>
        </view>

        <text class="qr-hint-text">请向老师出示此二维码</text>

        <view class="qr-code-wrap">
          <canvas
            type="2d"
            canvas-id="qrCanvas"
            id="qrCanvas"
            class="qr-canvas"
          ></canvas>
        </view>

        <view class="qr-student-info">
          <text class="qr-name-text">{{ studentInfo.name }}</text>
          <text class="qr-phone-text">{{ phoneDisplay }}</text>
        </view>
      </view>

      <button class="btn-primary" @click="refreshStatus">刷新签到状态</button>
      <button class="btn-secondary" @click="doLogout">切换账号</button>
    </view>
  </view>
</template>

<script>
import QRCode from '@/utils/qrcode.js'

export default {
  data() {
    return {
      name: '',
      phone: '',
      code: '',
      isLoggedIn: false,
      isLoading: false,
      studentInfo: null,
      phoneDisplay: ''
    }
  },

  onShow() {
    const cached = uni.getStorageSync('studentInfo')
    if (cached) {
      const phoneStr = (cached.phone || '').toString()
      this.isLoggedIn = true
      this.studentInfo = cached
      this.phoneDisplay = phoneStr.length >= 11
        ? phoneStr.substring(0, 3) + '****' + phoneStr.substring(7)
        : phoneStr

      // 只有未签到时才生成二维码
      if (!cached.checkedIn) {
        setTimeout(() => { this.generateQRCode(cached._id) }, 300)
      }

      this.refreshStatus()
    }
  },

  methods: {
    async doLogin() {
      if (!this.name.trim()) {
        uni.showToast({ title: '请输入姓名', icon: 'none' })
        return
      }
      if (!this.phone.trim()) {
        uni.showToast({ title: '请输入手机号', icon: 'none' })
        return
      }
      if (!this.code.trim()) {
        uni.showToast({ title: '请输入核验码', icon: 'none' })
        return
      }

      this.isLoading = true

      try {
        const res = await wx.cloud.callFunction({
          name: 'login',
          data: {
            name: this.name.trim(),
            phone: this.phone.trim(),
            code: this.code.trim()
          }
        })

        const result = res && res.result ? res.result : {}

        if (result.success && result.student) {
          const student = result.student
          const phoneStr = (student.phone || '').toString()
          this.isLoggedIn = true
          this.studentInfo = student
          this.phoneDisplay = phoneStr.length >= 11
            ? phoneStr.substring(0, 3) + '****' + phoneStr.substring(7)
            : phoneStr
          this.isLoading = false

          // 将核验码一并缓存，便于后续刷新状态
          const toCache = Object.assign({}, student, { code: this.code.trim() })
          uni.setStorageSync('studentInfo', toCache)
          this.studentInfo = toCache

          // 已签到就不生成二维码，直接显示"已签到"大字
          if (!student.checkedIn) {
            setTimeout(() => { this.generateQRCode(student._id) }, 300)
          }
        } else {
          const msg = result.message || '登录失败，请检查姓名和手机号是否正确'
          uni.showToast({ title: msg, icon: 'none', duration: 2000 })
          this.isLoading = false
        }
      } catch (err) {
        console.error('登录失败:', err)
        const errMsg = (err && err.errMsg) ? err.errMsg : '网络错误，请重试'
        uni.showToast({ title: errMsg, icon: 'none', duration: 2000 })
        this.isLoading = false
      }
    },

    generateQRCode(studentId) {
      const query = uni.createSelectorQuery().in(this)
      query.select('#qrCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0]) {
            console.error('Canvas 未找到')
            return
          }
          const canvas = res[0].node
          const ctx = canvas.getContext('2d')
          const info = uni.getWindowInfo()
          const dpr = info.pixelRatio
          canvas.width = 500 * dpr
          canvas.height = 500 * dpr
          ctx.scale(dpr, dpr)

          // 用紧凑格式，字符越少二维码越简单，扫码成功率越高
          const qrData = `CKIN|${studentId}|${Date.now()}`
          QRCode.draw(qrData, canvas, ctx, 500)
        })
    },

    doLogout() {
      uni.removeStorageSync('studentInfo')
      this.isLoggedIn = false
      this.studentInfo = null
      this.name = ''
      this.phone = ''
      this.code = ''
      this.phoneDisplay = ''
    },

    async refreshStatus() {
      if (!this.studentInfo) return
      uni.showLoading({ title: '刷新中...' })

      try {
        const res = await wx.cloud.callFunction({
          name: 'login',
          data: {
            name: this.studentInfo.name,
            phone: this.studentInfo.phone,
            code: this.studentInfo.code
          }
        })

        if (res.result.success) {
          const refreshed = Object.assign({}, res.result.student, { code: this.studentInfo.code })
          this.studentInfo = refreshed
          uni.setStorageSync('studentInfo', refreshed)

          // 只要刷新后是未签到，就生成二维码
          // （覆盖"从未签到→未签到"和"从已签到被重置→未签到"两种情况）
          if (!res.result.student.checkedIn) {
            setTimeout(() => { this.generateQRCode(res.result.student._id) }, 300)
          }
          // 刷新后是已签到，页面自动切换到"已签到"视图，不需要二维码
        }
      } catch (err) {
        console.error(err)
      }

      uni.hideLoading()
    }
  }
}
</script>

<style scoped>
/* ========== 登录区 ========== */
.login-section {
  padding-top: 20rpx;
}

.login-header {
  text-align: center;
  margin-bottom: 40rpx;
}

.login-icon-wrap {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #E0F3FF 0%, #7BDCFF 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 28rpx;
  box-shadow: 0 12rpx 32rpx rgba(28, 176, 246, 0.25);
}

.login-icon-text {
  font-size: 72rpx;
  line-height: 1;
  display: block;
  filter: drop-shadow(0 2rpx 4rpx rgba(0, 0, 0, 0.1));
}

.input-placeholder {
  color: var(--text-placeholder);
  font-size: 30rpx;
  font-weight: 400;
  line-height: 96rpx;
  height: 96rpx;
  overflow: visible;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

/* ========== 二维码区 ========== */
.qr-section {
  padding-top: 20rpx;
}

.qr-card {
  text-align: center;
  background: linear-gradient(180deg, #FFFFFF 0%, #F0F9FF 100%);
  position: relative;
  overflow: hidden;
}

.qr-card::before {
  content: '';
  position: absolute;
  top: -80rpx;
  right: -80rpx;
  width: 260rpx;
  height: 260rpx;
  background: radial-gradient(circle, rgba(28, 176, 246, 0.12) 0%, transparent 70%);
  border-radius: 50%;
}

.qr-card::after {
  content: '';
  position: absolute;
  bottom: -60rpx;
  left: -60rpx;
  width: 200rpx;
  height: 200rpx;
  background: radial-gradient(circle, rgba(79, 70, 229, 0.1) 0%, transparent 70%);
  border-radius: 50%;
}

.qr-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
  position: relative;
  z-index: 1;
}

.qr-student-name {
  font-size: 40rpx;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.5rpx;
}

.qr-hint-text {
  font-size: 26rpx;
  color: var(--text-secondary);
  font-weight: 500;
  display: block;
  margin-bottom: 28rpx;
  position: relative;
  z-index: 1;
}

.qr-code-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 28rpx;
  background: #fff;
  border-radius: 28rpx;
  margin: 0 auto;
  width: 520rpx;
  height: 520rpx;
  border: 3rpx solid var(--border);
  box-shadow: 0 12rpx 32rpx rgba(28, 176, 246, 0.1),
              inset 0 0 0 8rpx rgba(28, 176, 246, 0.04);
  position: relative;
  z-index: 1;
}

.qr-canvas {
  width: 500rpx;
  height: 500rpx;
}

.qr-student-info {
  margin-top: 32rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  position: relative;
  z-index: 1;
}

.qr-name-text {
  font-size: 34rpx;
  font-weight: 700;
  color: var(--text-primary);
}

.qr-phone-text {
  font-size: 26rpx;
  color: var(--text-secondary);
  letter-spacing: 2rpx;
}

/* ========== 已签到大字视图 ========== */
.done-card {
  text-align: center;
  background: linear-gradient(180deg, #FFFFFF 0%, #ECFDF5 100%);
  padding: 72rpx 40rpx 56rpx;
  position: relative;
  overflow: hidden;
}

.done-card::before {
  content: '';
  position: absolute;
  top: -100rpx;
  right: -100rpx;
  width: 300rpx;
  height: 300rpx;
  background: radial-gradient(circle, rgba(34, 197, 94, 0.15) 0%, transparent 70%);
  border-radius: 50%;
}

.done-card::after {
  content: '';
  position: absolute;
  bottom: -80rpx;
  left: -80rpx;
  width: 240rpx;
  height: 240rpx;
  background: radial-gradient(circle, rgba(34, 197, 94, 0.1) 0%, transparent 70%);
  border-radius: 50%;
}

.done-icon-wrap {
  width: 200rpx;
  height: 200rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #22C55E 0%, #16A34A 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 32rpx;
  box-shadow: 0 16rpx 40rpx rgba(34, 197, 94, 0.4);
  position: relative;
  z-index: 1;
  animation: done-pop 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes done-pop {
  0%   { transform: scale(0.3); opacity: 0; }
  60%  { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

.done-icon {
  color: #fff;
  font-size: 120rpx;
  font-weight: 900;
  line-height: 1;
  display: block;
}

.done-title {
  font-size: 80rpx;
  font-weight: 900;
  color: #16A34A;
  display: block;
  margin-bottom: 12rpx;
  letter-spacing: 4rpx;
  line-height: 1.1;
  position: relative;
  z-index: 1;
}

.done-sub {
  font-size: 26rpx;
  color: var(--text-secondary);
  display: block;
  margin-bottom: 40rpx;
  position: relative;
  z-index: 1;
}

.done-info {
  padding-top: 32rpx;
  border-top: 2rpx dashed #BBF7D0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  position: relative;
  z-index: 1;
}

.done-name {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--text-primary);
}

.done-phone {
  font-size: 26rpx;
  color: var(--text-secondary);
  letter-spacing: 2rpx;
}
</style>
