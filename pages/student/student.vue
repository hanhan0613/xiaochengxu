<template>
  <view class="container">
    <!-- 登录表单 -->
    <view v-if="!isLoggedIn" class="login-section">
      <view class="login-header">
        <view class="login-icon-wrap">
          <text class="login-icon-text">&#x1F393;</text>
        </view>
        <text class="page-title">学生签到</text>
        <text class="page-subtitle">输入姓名和手机号，生成签到码</text>
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
            type="number"
            maxlength="11"
            placeholder="输入11位手机号"
            placeholder-class="input-placeholder"
            :adjust-position="true"
            v-model="phone"
          />
        </view>

        <button class="btn-primary" @click="doLogin" :disabled="isLoading">
          {{ isLoading ? '验证中...' : '生成签到二维码' }}
        </button>
      </view>
    </view>

    <!-- 二维码展示 -->
    <view v-if="isLoggedIn" class="qr-section">
      <view class="card qr-card">
        <view class="qr-status-bar">
          <text class="qr-student-name">{{ studentInfo.name }}</text>
          <view :class="studentInfo.checkedIn ? 'tag-checked' : 'tag-unchecked'">
            {{ studentInfo.checkedIn ? '已签到' : '未签到' }}
          </view>
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
      isLoggedIn: false,
      isLoading: false,
      studentInfo: null,
      phoneDisplay: ''
    }
  },

  onShow() {
    const cached = uni.getStorageSync('studentInfo')
    if (cached) {
      const phoneStr = cached.phone
      this.isLoggedIn = true
      this.studentInfo = cached
      this.phoneDisplay = phoneStr.substring(0, 3) + '****' + phoneStr.substring(7)

      setTimeout(() => {
        this.generateQRCode(cached._id)
      }, 300)

      this.refreshStatus()
    }
  },

  methods: {
    async doLogin() {
      if (!this.name.trim()) {
        uni.showToast({ title: '请输入姓名', icon: 'none' })
        return
      }
      if (!this.phone.trim() || this.phone.length !== 11) {
        uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
        return
      }

      this.isLoading = true

      try {
        const res = await wx.cloud.callFunction({
          name: 'login',
          data: { name: this.name.trim(), phone: this.phone.trim() }
        })

        console.log('login 云函数返回:', res)

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

          uni.setStorageSync('studentInfo', student)

          setTimeout(() => {
            this.generateQRCode(student._id)
          }, 300)
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

          const qrData = JSON.stringify({
            type: 'checkin',
            studentId: studentId,
            timestamp: Date.now()
          })

          QRCode.draw(qrData, canvas, ctx, 500)
        })
    },

    doLogout() {
      uni.removeStorageSync('studentInfo')
      this.isLoggedIn = false
      this.studentInfo = null
      this.name = ''
      this.phone = ''
      this.phoneDisplay = ''
    },

    async refreshStatus() {
      if (!this.studentInfo) return
      uni.showLoading({ title: '刷新中...' })

      try {
        const res = await wx.cloud.callFunction({
          name: 'login',
          data: { name: this.studentInfo.name, phone: this.studentInfo.phone }
        })

        if (res.result.success) {
          this.studentInfo = res.result.student
          uni.setStorageSync('studentInfo', res.result.student)
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
.login-section {
  padding-top: 20rpx;
}

.login-header {
  text-align: center;
  margin-bottom: 36rpx;
}

.login-icon-wrap {
  width: 140rpx;
  height: 140rpx;
  border-radius: 50%;
  background: #DDF4FF;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 24rpx;
}

.login-icon-text {
  font-size: 64rpx;
}

/* placeholder 修复 */
.input-placeholder {
  color: #CDCDCD;
  font-size: 30rpx;
  font-weight: 400;
  line-height: 96rpx;
  height: 96rpx;
  overflow: visible;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

/* 二维码页面 */
.qr-section {
  padding-top: 20rpx;
}

.qr-card {
  text-align: center;
}

.qr-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24rpx;
}

.qr-student-name {
  font-size: 38rpx;
  font-weight: 800;
  color: #3c3c3c;
}

.qr-hint-text {
  font-size: 28rpx;
  color: #AFAFAF;
  font-weight: 500;
  display: block;
  margin-bottom: 28rpx;
}

.qr-code-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24rpx;
  background: #f7f7f7;
  border-radius: 24rpx;
  margin: 0 auto;
  width: 520rpx;
  height: 520rpx;
  border: 4rpx solid #E5E5E5;
}

.qr-canvas {
  width: 500rpx;
  height: 500rpx;
}

.qr-student-info {
  margin-top: 28rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.qr-name-text {
  font-size: 34rpx;
  font-weight: 700;
  color: #3c3c3c;
}

.qr-phone-text {
  font-size: 28rpx;
  color: #AFAFAF;
}
</style>
