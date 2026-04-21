<template>
  <view class="container">
    <view class="hero-section">
      <view class="mascot">
        <text class="mascot-emoji">&#x2714;&#xFE0F;</text>
      </view>
      <text class="hero-title">签到打卡</text>
      <text class="hero-desc">选择你的身份，开始使用吧</text>
    </view>

    <view class="role-cards">
      <view class="role-card role-student" @click="goStudent" hover-class="role-card-active">
        <view class="role-emoji-wrap student-bg">
          <text class="role-emoji">&#x1F393;</text>
        </view>
        <view class="role-text">
          <text class="role-title">我是学生</text>
          <text class="role-sub">生成签到二维码</text>
        </view>
        <text class="role-chevron">&#x203A;</text>
      </view>

      <view class="role-card role-teacher" @click="goTeacher" hover-class="role-card-active">
        <view class="role-emoji-wrap teacher-bg">
          <text class="role-emoji">&#x1F4F7;</text>
        </view>
        <view class="role-text">
          <text class="role-title">我是教师</text>
          <text class="role-sub">扫码签到 / 管理名单</text>
        </view>
        <text class="role-chevron">&#x203A;</text>
      </view>
    </view>

    <!-- 隐私授权弹层 -->
    <privacy-popup />

    <!-- 教师身份验证弹层 -->
    <view v-if="showTeacherAuth" class="auth-mask" @click="closeAuth">
      <view class="auth-card" @click.stop>
        <text class="auth-title">教师身份验证</text>
        <text class="auth-desc">首次使用请输入教师初始化密码</text>

        <view class="input-group">
          <text class="input-label">密码</text>
          <input
            class="input-field"
            type="text"
            password="true"
            placeholder="教师初始化密码"
            placeholder-class="input-placeholder"
            :adjust-position="true"
            v-model="authPassword"
          />
        </view>

        <button class="btn-primary" @click="submitClaim" :disabled="authLoading">
          {{ authLoading ? '验证中...' : '确认' }}
        </button>
        <button class="btn-secondary" @click="closeAuth">取消</button>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      showTeacherAuth: false,
      authPassword: '',
      authLoading: false
    }
  },
  methods: {
    goStudent() {
      uni.navigateTo({ url: '/pages/student/student' })
    },
    async goTeacher() {
      uni.showLoading({ title: '验证身份...' })
      try {
        const res = await wx.cloud.callFunction({ name: 'getRole' })
        uni.hideLoading()
        const r = res && res.result ? res.result : {}
        if (r.success && r.role === 'teacher') {
          uni.setStorageSync('role', 'teacher')
          uni.setStorageSync('openid', r.openid)
          uni.navigateTo({ url: '/pages/teacher/teacher' })
        } else {
          // 非教师，弹出密码验证
          this.showTeacherAuth = true
        }
      } catch (err) {
        uni.hideLoading()
        console.error(err)
        uni.showToast({ title: '网络错误，请重试', icon: 'none' })
      }
    },
    closeAuth() {
      this.showTeacherAuth = false
      this.authPassword = ''
    },
    async submitClaim() {
      if (!this.authPassword.trim()) {
        uni.showToast({ title: '请输入密码', icon: 'none' })
        return
      }
      this.authLoading = true
      try {
        const res = await wx.cloud.callFunction({
          name: 'claimTeacher',
          data: { password: this.authPassword.trim() }
        })
        const r = res && res.result ? res.result : {}
        if (r.success) {
          uni.setStorageSync('role', 'teacher')
          uni.setStorageSync('openid', r.openid)
          uni.showToast({ title: '验证成功', icon: 'success' })
          setTimeout(() => {
            this.showTeacherAuth = false
            this.authPassword = ''
            this.authLoading = false
            uni.navigateTo({ url: '/pages/teacher/teacher' })
          }, 600)
        } else {
          this.authLoading = false
          uni.showToast({ title: r.message || '验证失败', icon: 'none' })
        }
      } catch (err) {
        this.authLoading = false
        console.error(err)
        uni.showToast({ title: '网络错误，请重试', icon: 'none' })
      }
    }
  }
}
</script>

<style scoped>
/* ========== Hero 区 ========== */
.hero-section {
  text-align: center;
  padding: 80rpx 0 40rpx;
  position: relative;
}

.hero-section::before {
  content: '';
  position: absolute;
  top: 40rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 400rpx;
  height: 400rpx;
  background: radial-gradient(circle, rgba(28, 176, 246, 0.15) 0%, transparent 70%);
  border-radius: 50%;
  z-index: 0;
}

.mascot {
  width: 180rpx;
  height: 180rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #1CB0F6 0%, #4F46E5 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 32rpx;
  box-shadow: 0 16rpx 40rpx rgba(28, 176, 246, 0.4),
              0 4rpx 0 #0E8CBF;
  position: relative;
  z-index: 1;
}

.mascot-emoji {
  font-size: 80rpx;
  line-height: 1;
  display: block;
  filter: drop-shadow(0 2rpx 4rpx rgba(0, 0, 0, 0.1));
}

.hero-title {
  font-size: 60rpx;
  font-weight: 800;
  color: var(--text-primary);
  display: block;
  margin-bottom: 12rpx;
  letter-spacing: -1rpx;
  position: relative;
  z-index: 1;
}

.hero-desc {
  font-size: 28rpx;
  color: var(--text-secondary);
  font-weight: 500;
  display: block;
  position: relative;
  z-index: 1;
}

/* ========== 角色卡片 ========== */
.role-cards {
  margin-top: 48rpx;
}

.role-card {
  background: #fff;
  border-radius: 32rpx;
  padding: 36rpx 32rpx;
  margin-bottom: 24rpx;
  display: flex;
  align-items: center;
  border: 2rpx solid var(--border);
  box-shadow: var(--shadow-md);
  position: relative;
  top: 0;
  transition: all 0.2s ease;
  overflow: hidden;
}

.role-card::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 180rpx;
  height: 180rpx;
  border-radius: 50%;
  opacity: 0.08;
  transform: translate(40%, -40%);
}

.role-student::after { background: var(--primary); }
.role-teacher::after { background: var(--primary-deep); }

.role-card-active {
  top: 4rpx;
  box-shadow: var(--shadow-sm);
  border-color: var(--primary-light);
}

.role-emoji-wrap {
  width: 104rpx;
  height: 104rpx;
  border-radius: 26rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 28rpx;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.role-emoji {
  font-size: 52rpx;
  line-height: 1;
  display: block;
}

.student-bg {
  background: linear-gradient(135deg, #E0F3FF 0%, #7BDCFF 100%);
  box-shadow: 0 8rpx 20rpx rgba(28, 176, 246, 0.15);
}

.teacher-bg {
  background: linear-gradient(135deg, #EDE9FE 0%, #A5B4FC 100%);
  box-shadow: 0 8rpx 20rpx rgba(79, 70, 229, 0.15);
}

.role-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1;
}

.role-title {
  font-size: 34rpx;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 8rpx;
}

.role-sub {
  font-size: 24rpx;
  color: var(--text-secondary);
  font-weight: 500;
}

.role-chevron {
  font-size: 44rpx;
  color: var(--primary);
  font-weight: 700;
  flex-shrink: 0;
  line-height: 1;
  position: relative;
  z-index: 1;
}

/* ========== 教师身份验证弹层 ========== */
.auth-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  animation: mask-fade 0.2s ease;
}

@keyframes mask-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

.auth-card {
  width: 620rpx;
  background: #fff;
  border-radius: 36rpx;
  padding: 48rpx 40rpx 36rpx;
  box-sizing: border-box;
  box-shadow: 0 40rpx 80rpx rgba(15, 23, 42, 0.3);
  animation: card-pop 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes card-pop {
  from { transform: scale(0.9); opacity: 0; }
  to   { transform: scale(1);   opacity: 1; }
}

.auth-title {
  font-size: 40rpx;
  font-weight: 800;
  color: var(--text-primary);
  display: block;
  margin-bottom: 10rpx;
}

.auth-desc {
  font-size: 26rpx;
  color: var(--text-secondary);
  display: block;
  margin-bottom: 32rpx;
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
</style>
