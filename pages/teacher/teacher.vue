<template>
  <view class="container">
    <!-- 隐私授权弹层 -->
    <privacy-popup />

    <text class="page-title">教师端</text>
    <text class="page-subtitle">扫码签到 / 查看学生签到状态</text>

    <!-- 当前活动栏 -->
    <view class="session-bar" v-if="currentSession">
      <view class="session-info">
        <text class="session-label">当前活动</text>
        <text class="session-title">{{ currentSession.title }}</text>
      </view>
      <view class="session-end-btn" @click="endCurrentSession">
        <text class="session-end-text">结束</text>
      </view>
      <view class="session-dot"></view>
    </view>
    <view class="session-bar session-bar-empty" v-else>
      <view class="session-info">
        <text class="session-label">暂无进行中的活动</text>
        <text class="session-title-empty">点击下方"开启新一轮"开始</text>
      </view>
    </view>

    <!-- 统计卡片 -->
    <view class="stats-row">
      <view class="stat-card stat-total">
        <text class="stat-num">{{ stats.total }}</text>
        <text class="stat-lbl">总人数</text>
      </view>
      <view class="stat-card stat-yes">
        <text class="stat-num">{{ stats.checked }}</text>
        <text class="stat-lbl">已签到</text>
      </view>
      <view class="stat-card stat-no">
        <text class="stat-num">{{ stats.unchecked }}</text>
        <text class="stat-lbl">未签到</text>
      </view>
    </view>

    <!-- 进度条 -->
    <view class="progress-wrap" v-if="stats.total > 0">
      <view class="progress-bar">
        <view class="progress-fill" :style="{ width: progressPercent + '%' }"></view>
      </view>
      <text class="progress-text">{{ progressPercent }}% 完成</text>
    </view>

    <!-- 扫码按钮 -->
    <button class="btn-scan" @click="scanQRCode">
      &#x1F4F7;  扫码签到
    </button>

    <!-- 活动管理 -->
    <view class="action-row">
      <button class="btn-action-primary" @click="startNewSession">
        &#x1F504;  开启新一轮
      </button>
      <button class="btn-action-secondary" @click="goHistory">
        &#x1F4DC;  历史记录
      </button>
    </view>

    <!-- 管理后台入口 -->
    <button class="btn-admin-entry" @click="goAdmin">
      &#x2699;&#xFE0F;  管理学生名单
    </button>

    <!-- 签到结果提示 -->
    <view
      v-if="scanResult"
      :class="['result-banner', scanResult.success ? 'result-ok' : 'result-err']"
    >
      <text class="result-emoji">{{ scanResult.success ? '&#x2705;' : '&#x274C;' }}</text>
      <view class="result-info">
        <text class="result-msg-text">{{ scanResult.message }}</text>
        <text class="result-name-text" v-if="scanResult.student">{{ scanResult.student.name }}</text>
      </view>
    </view>

    <!-- 筛选标签 -->
    <view class="filter-row">
      <view
        :class="['filter-pill', filter === 'all' ? 'pill-active' : '']"
        @click="setFilter('all')"
      >全部</view>
      <view
        :class="['filter-pill', filter === 'checked' ? 'pill-active' : '']"
        @click="setFilter('checked')"
      >已签到</view>
      <view
        :class="['filter-pill', filter === 'unchecked' ? 'pill-active' : '']"
        @click="setFilter('unchecked')"
      >未签到</view>
    </view>

    <!-- 学生列表 -->
    <view class="stu-list">
      <view class="stu-item" v-for="item in students" :key="item._id" @tap="onStudentTap(item)">
        <view class="stu-avatar" :class="item.checkedIn ? 'avatar-ok' : 'avatar-wait'">
          <text class="stu-avatar-letter">{{ item.name.charAt(0) }}</text>
        </view>
        <view class="stu-info">
          <text class="stu-name">{{ item.name }}</text>
          <text class="stu-phone">{{ item.phone }}</text>
        </view>
        <view class="stu-status">
          <view :class="item.checkedIn ? 'tag-checked' : 'tag-unchecked'">
            {{ item.checkedIn ? '已签到' : '未签到' }}
          </view>
          <text class="stu-time" v-if="item.checkedIn && item.checkInTimeStr">
            {{ item.checkInTimeStr }}
          </text>
        </view>
      </view>

      <view class="empty-state" v-if="students.length === 0 && !isLoading">
        <text class="empty-emoji">&#x1F4ED;</text>
        <text class="empty-title">暂无学生数据</text>
        <text class="empty-sub-text">请先在管理后台上传学生名单</text>
      </view>
    </view>

    <!-- 加载更多 -->
    <view class="load-more-wrap" v-if="hasMore" @click="loadMore">
      <text class="load-more-text">{{ isLoading ? '加载中...' : '加载更多' }}</text>
    </view>

    <!-- 开启新一轮 弹层 -->
    <view v-if="showNewSessionModal" class="ns-mask" @click="closeNewSessionModal">
      <view class="ns-card" @click.stop>
        <text class="ns-title">开启新一轮签到</text>

        <view class="input-group">
          <text class="input-label">活动名称</text>
          <input
            class="input-field"
            placeholder="留空则使用当前时间命名"
            placeholder-class="ns-placeholder"
            :adjust-position="true"
            v-model="newSessionTitle"
          />
        </view>

        <view class="ns-option" @click="toggleClearStudents">
          <view :class="['ns-checkbox', clearStudentsOption ? 'ns-checkbox-on' : '']">
            <text v-if="clearStudentsOption" class="ns-check-mark">&#x2713;</text>
          </view>
          <view class="ns-option-text">
            <text class="ns-option-title">清空学生名单</text>
            <text class="ns-option-sub">勾选后将删除所有学生，需要重新导入名单</text>
          </view>
        </view>

        <button class="btn-primary" @click="submitNewSession" :disabled="newSessionLoading">
          {{ newSessionLoading ? '开启中...' : '确认开启' }}
        </button>
        <button class="btn-secondary" @click="closeNewSessionModal">取消</button>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      students: [],
      stats: { total: 0, checked: 0, unchecked: 0 },
      filter: 'all',
      page: 1,
      pageSize: 50,
      hasMore: false,
      isLoading: false,
      scanResult: null,
      currentSession: null,
      showNewSessionModal: false,
      newSessionTitle: '',
      clearStudentsOption: false,
      newSessionLoading: false,
      _lastTapInfo: { id: '', time: 0 }
    }
  },

  computed: {
    progressPercent() {
      if (this.stats.total === 0) return 0
      return Math.round((this.stats.checked / this.stats.total) * 100)
    }
  },

  async onShow() {
    // 鉴权：非教师直接踢出
    const ok = await this.ensureTeacher()
    if (!ok) return
    this.loadCurrentSession()
    this.loadStudents(true)
  },

  onPullDownRefresh() {
    this.loadStudents(true).then(() => {
      uni.stopPullDownRefresh()
    })
  },

  methods: {
    onStudentTap(item) {
      const now = Date.now()
      const last = this._lastTapInfo
      if (last.id === item._id && now - last.time < 350) {
        // 双击 → 复制手机号
        this._lastTapInfo = { id: '', time: 0 }
        if (!item.phone) return
        uni.setClipboardData({
          data: String(item.phone),
          success: () => {
            uni.showToast({ title: `已复制 ${item.phone}`, icon: 'none' })
          }
        })
      } else {
        this._lastTapInfo = { id: item._id, time: now }
      }
    },

    async ensureTeacher() {
      // 先看缓存，没有缓存再请求
      let role = uni.getStorageSync('role')
      if (role !== 'teacher') {
        try {
          const res = await wx.cloud.callFunction({ name: 'getRole' })
          const r = res && res.result ? res.result : {}
          role = r.role
          if (role === 'teacher') uni.setStorageSync('role', 'teacher')
        } catch (err) {
          console.error(err)
        }
      }
      if (role !== 'teacher') {
        uni.showModal({
          title: '无权限',
          content: '教师端仅限授权教师访问',
          showCancel: false,
          success: () => {
            uni.reLaunch({ url: '/pages/index/index' })
          }
        })
        return false
      }
      return true
    },

    goAdmin() {
      uni.navigateTo({ url: '/pages/admin/admin' })
    },

    goHistory() {
      uni.navigateTo({ url: '/pages/sessions/sessions' })
    },

    endCurrentSession() {
      if (!this.currentSession) return
      uni.showModal({
        title: '结束当前活动',
        content: `确定要结束"${this.currentSession.title}"吗？结束后学生将无法继续签到，本次签到数据会保留在历史记录中。`,
        confirmColor: '#F59E0B',
        confirmText: '结束',
        success: async (res) => {
          if (!res.confirm) return
          uni.showLoading({ title: '结束中...', mask: true })
          try {
            const cloudRes = await wx.cloud.callFunction({ name: 'endSession' })
            uni.hideLoading()
            const r = cloudRes && cloudRes.result ? cloudRes.result : {}
            if (r.success) {
              uni.showToast({ title: '活动已结束', icon: 'success' })
              this.loadCurrentSession()
            } else {
              uni.showToast({ title: r.message || '结束失败', icon: 'none' })
            }
          } catch (err) {
            uni.hideLoading()
            console.error(err)
            uni.showToast({ title: '网络错误', icon: 'none' })
          }
        }
      })
    },

    async loadCurrentSession() {
      try {
        const res = await wx.cloud.callFunction({ name: 'getCurrentSession' })
        const r = res && res.result ? res.result : {}
        if (r.success) {
          this.currentSession = r.session
        }
      } catch (err) {
        console.error('获取当前活动失败:', err)
      }
    },

    startNewSession() {
      // 打开自定义弹层
      this.newSessionTitle = ''
      this.clearStudentsOption = false
      this.showNewSessionModal = true
    },

    closeNewSessionModal() {
      if (this.newSessionLoading) return
      this.showNewSessionModal = false
    },

    toggleClearStudents() {
      this.clearStudentsOption = !this.clearStudentsOption
    },

    async submitNewSession() {
      // 如果勾选了清空学生名单，先二次确认
      if (this.clearStudentsOption) {
        const confirmed = await new Promise((resolve) => {
          uni.showModal({
            title: '再次确认',
            content: '开启后将删除所有学生数据，此操作不可恢复！确定继续？',
            confirmColor: '#EF4444',
            success: (r) => resolve(r.confirm)
          })
        })
        if (!confirmed) return
      }

      this.newSessionLoading = true
      try {
        const cloudRes = await wx.cloud.callFunction({
          name: 'startSession',
          data: {
            title: this.newSessionTitle.trim(),
            clearStudents: this.clearStudentsOption
          }
        })
        const r = cloudRes && cloudRes.result ? cloudRes.result : {}
        if (r.success) {
          uni.showToast({ title: '已开启新活动', icon: 'success' })
          this.showNewSessionModal = false
          this.newSessionLoading = false
          this.loadCurrentSession()
          this.loadStudents(true)
        } else {
          this.newSessionLoading = false
          uni.showToast({ title: r.message || '开启失败', icon: 'none' })
        }
      } catch (err) {
        this.newSessionLoading = false
        console.error(err)
        uni.showToast({ title: '网络错误', icon: 'none' })
      }
    },

    async loadStudents(refresh = false) {
      if (this.isLoading) return
      const page = refresh ? 1 : this.page
      this.isLoading = true

      try {
        const res = await wx.cloud.callFunction({
          name: 'getStudents',
          data: { page, pageSize: this.pageSize, filter: this.filter }
        })

        if (res.result.success) {
          let students = res.result.data.map(s => {
            if (s.checkInTime) {
              const d = new Date(s.checkInTime)
              s.checkInTimeStr = this.formatTime(d)
            }
            return s
          })

          if (!refresh && page > 1) {
            students = [...this.students, ...students]
          }

          this.students = students
          this.stats = res.result.stats
          this.page = page
          this.hasMore = students.length < res.result.total
        }
      } catch (err) {
        console.error('加载学生列表失败:', err)
        uni.showToast({ title: '加载失败', icon: 'none' })
      }

      this.isLoading = false
    },

    formatTime(date) {
      const h = date.getHours().toString().padStart(2, '0')
      const m = date.getMinutes().toString().padStart(2, '0')
      return `${h}:${m}`
    },

    setFilter(filter) {
      this.filter = filter
      this.page = 1
      this.loadStudents(true)
    },

    loadMore() {
      this.page++
      this.loadStudents(false)
    },

    parseQRContent(raw) {
      // 兼容两种格式：
      // 1. 新格式 CKIN|{studentId}|{timestamp}
      // 2. 旧格式 JSON {type:'checkin', studentId, timestamp}
      if (typeof raw !== 'string') return null
      if (raw.startsWith('CKIN|')) {
        const parts = raw.split('|')
        if (parts.length < 3) return null
        return { studentId: parts[1], timestamp: Number(parts[2]) }
      }
      try {
        const obj = JSON.parse(raw)
        if (obj && obj.type === 'checkin' && obj.studentId) {
          return { studentId: obj.studentId, timestamp: Number(obj.timestamp) || 0 }
        }
      } catch (e) {}
      return null
    },

    scanQRCode() {
      uni.scanCode({
        onlyFromCamera: true,
        scanType: ['qrCode'],
        success: async (res) => {
          try {
            console.log('[scan] raw:', res.result)
            const qrData = this.parseQRContent(res.result)
            if (!qrData || !qrData.studentId) {
              this.scanResult = { success: false, message: '无效的签到二维码' }
              setTimeout(() => { this.scanResult = null }, 3000)
              return
            }

            const now = Date.now()
            if (qrData.timestamp && now - qrData.timestamp > 5 * 60 * 1000) {
              this.scanResult = { success: false, message: '二维码已过期，请让学生重新生成' }
              setTimeout(() => { this.scanResult = null }, 3000)
              return
            }

            uni.showLoading({ title: '签到中...' })

            const checkInRes = await wx.cloud.callFunction({
              name: 'checkIn',
              data: { studentId: qrData.studentId }
            })

            uni.hideLoading()
            this.scanResult = checkInRes.result

            if (checkInRes.result.success) {
              uni.showToast({ title: '签到成功！', icon: 'success' })
              this.loadCurrentSession()
              this.loadStudents(true)
            }

            setTimeout(() => { this.scanResult = null }, 3000)
          } catch (err) {
            console.error('扫码处理失败:', err)
            this.scanResult = { success: false, message: '扫码处理失败' }
            setTimeout(() => { this.scanResult = null }, 3000)
          }
        },
        fail: (err) => {
          if (err.errMsg && err.errMsg.indexOf('cancel') === -1) {
            uni.showToast({ title: '扫码失败', icon: 'none' })
          }
        }
      })
    }
  }
}
</script>

<style scoped>
/* ========== 当前活动栏 ========== */
.session-bar {
  background: linear-gradient(135deg, #1CB0F6 0%, #4F46E5 100%);
  border-radius: 24rpx;
  padding: 24rpx 28rpx;
  margin-bottom: 28rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 10rpx 28rpx rgba(28, 176, 246, 0.3);
  position: relative;
  overflow: hidden;
}

.session-bar::before {
  content: '';
  position: absolute;
  top: -60rpx;
  right: -60rpx;
  width: 180rpx;
  height: 180rpx;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.2) 0%, transparent 70%);
  border-radius: 50%;
}

.session-bar-empty {
  background: #fff;
  border: 2rpx dashed var(--primary-light);
  box-shadow: var(--shadow-sm);
}

.session-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  position: relative;
  z-index: 1;
}

.session-label {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 600;
  letter-spacing: 2rpx;
  text-transform: uppercase;
}

.session-bar-empty .session-label {
  color: var(--text-secondary);
}

.session-title {
  font-size: 32rpx;
  color: #fff;
  font-weight: 800;
}

.session-title-empty {
  font-size: 26rpx;
  color: var(--text-placeholder);
  font-weight: 500;
}

.session-end-btn {
  padding: 10rpx 20rpx;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 16rpx;
  margin-right: 16rpx;
  position: relative;
  z-index: 1;
  transition: all 0.18s ease;
}

.session-end-btn:active {
  background: rgba(255, 255, 255, 0.35);
  transform: scale(0.95);
}

.session-end-text {
  color: #fff;
  font-size: 24rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
}

.session-dot {
  width: 18rpx;
  height: 18rpx;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7);
  animation: pulse 1.6s infinite;
  position: relative;
  z-index: 1;
}

@keyframes pulse {
  0%   { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7); }
  70%  { box-shadow: 0 0 0 16rpx rgba(255, 255, 255, 0); }
  100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
}

/* ========== 活动管理按钮组 ========== */
.action-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.btn-action-primary,
.btn-action-secondary {
  flex: 1;
  padding: 24rpx 0;
  border-radius: 24rpx;
  font-size: 28rpx;
  font-weight: 700;
  text-align: center;
  line-height: 1.2;
  border: none;
  position: relative;
  top: 0;
  transition: all 0.18s ease;
  letter-spacing: 1rpx;
}

.btn-action-primary {
  background: #fff;
  color: var(--primary-deep);
  border: 2rpx solid var(--primary-light);
  box-shadow: 0 6rpx 16rpx rgba(79, 70, 229, 0.12);
}

.btn-action-primary:active {
  top: 2rpx;
  background: var(--primary-bg);
}

.btn-action-secondary {
  background: #fff;
  color: var(--text-secondary);
  border: 2rpx solid var(--border);
  box-shadow: var(--shadow-sm);
}

.btn-action-secondary:active {
  top: 2rpx;
  background: #F8FAFC;
}

/* ========== 统计卡片 ========== */
.stats-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 28rpx;
}

.stat-card {
  flex: 1;
  background: #fff;
  border-radius: 28rpx;
  padding: 32rpx 16rpx;
  text-align: center;
  border: 2rpx solid var(--border);
  box-shadow: var(--shadow-sm);
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 6rpx;
  border-radius: 28rpx 28rpx 0 0;
}

.stat-total::before { background: linear-gradient(90deg, #1CB0F6, #4F46E5); }
.stat-yes::before   { background: linear-gradient(90deg, #22C55E, #16A34A); }
.stat-no::before    { background: linear-gradient(90deg, #F59E0B, #EF4444); }

.stat-num {
  font-size: 56rpx;
  font-weight: 800;
  display: block;
  letter-spacing: -1rpx;
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  line-height: 1.1;
}

.stat-total .stat-num { background-image: linear-gradient(135deg, #1CB0F6, #4F46E5); }
.stat-yes   .stat-num { background-image: linear-gradient(135deg, #22C55E, #16A34A); }
.stat-no    .stat-num { background-image: linear-gradient(135deg, #F59E0B, #EF4444); }

.stat-lbl {
  font-size: 22rpx;
  color: var(--text-secondary);
  font-weight: 600;
  margin-top: 10rpx;
  display: block;
  letter-spacing: 1rpx;
}

/* ========== 进度条 ========== */
.progress-wrap {
  margin-bottom: 32rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx 24rpx;
  background: #fff;
  border-radius: 24rpx;
  border: 2rpx solid var(--border);
  box-shadow: var(--shadow-sm);
}

.progress-bar {
  flex: 1;
  height: 16rpx;
  background: #E2E8F0;
  border-radius: 999rpx;
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #1CB0F6 0%, #4F46E5 100%);
  border-radius: 999rpx;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2rpx 8rpx rgba(28, 176, 246, 0.4);
}

.progress-text {
  font-size: 26rpx;
  font-weight: 800;
  background: linear-gradient(135deg, #1CB0F6, #4F46E5);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  flex-shrink: 0;
}

/* ========== 扫码按钮 ========== */
.btn-scan {
  background: linear-gradient(135deg, #1CB0F6 0%, #4F46E5 100%);
  color: #fff;
  border: none;
  border-radius: 28rpx;
  padding: 32rpx 0;
  font-size: 36rpx;
  font-weight: 800;
  text-align: center;
  line-height: 1.2;
  width: 100%;
  margin-bottom: 20rpx;
  box-shadow: 0 12rpx 28rpx rgba(28, 176, 246, 0.4),
              0 4rpx 0 #0E8CBF;
  position: relative;
  top: 0;
  letter-spacing: 4rpx;
  transition: all 0.18s ease;
}

.btn-scan:active {
  top: 4rpx;
  box-shadow: 0 4rpx 12rpx rgba(28, 176, 246, 0.3),
              0 2rpx 0 #0E8CBF;
}

/* ========== 管理后台入口按钮 ========== */
.btn-admin-entry {
  background: #fff;
  color: var(--primary-deep);
  border: 2rpx solid var(--border);
  border-radius: 28rpx;
  padding: 26rpx 0;
  font-size: 30rpx;
  font-weight: 700;
  text-align: center;
  line-height: 1.2;
  width: 100%;
  margin-bottom: 32rpx;
  box-shadow: var(--shadow-sm);
  position: relative;
  top: 0;
  letter-spacing: 2rpx;
  transition: all 0.18s ease;
}

.btn-admin-entry:active {
  top: 2rpx;
  background: var(--primary-bg);
  border-color: var(--primary-light);
}

/* ========== 签到结果 ========== */
.result-banner {
  border-radius: 28rpx;
  padding: 28rpx 32rpx;
  margin-bottom: 28rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
  animation: banner-in 0.3s ease;
}

@keyframes banner-in {
  from { transform: translateY(-10rpx); opacity: 0; }
  to   { transform: translateY(0);      opacity: 1; }
}

.result-ok {
  background: linear-gradient(135deg, #DCFCE7 0%, #BBF7D0 100%);
  border: 2rpx solid #22C55E;
  box-shadow: 0 8rpx 20rpx rgba(34, 197, 94, 0.2);
}

.result-err {
  background: linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%);
  border: 2rpx solid #EF4444;
  box-shadow: 0 8rpx 20rpx rgba(239, 68, 68, 0.15);
}

.result-emoji {
  font-size: 48rpx;
  line-height: 1;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.result-msg-text {
  font-size: 30rpx;
  font-weight: 800;
  color: var(--text-primary);
}

.result-name-text {
  font-size: 24rpx;
  color: var(--text-secondary);
  margin-top: 4rpx;
}

/* ========== 筛选 ========== */
.filter-row {
  display: flex;
  gap: 12rpx;
  margin-bottom: 28rpx;
  background: #fff;
  padding: 8rpx;
  border-radius: 999rpx;
  border: 2rpx solid var(--border);
}

.filter-pill {
  flex: 1;
  text-align: center;
  padding: 16rpx;
  border-radius: 999rpx;
  font-size: 26rpx;
  font-weight: 700;
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.pill-active {
  background: linear-gradient(135deg, #1CB0F6, #4F46E5);
  color: #fff;
  box-shadow: 0 4rpx 12rpx rgba(28, 176, 246, 0.4);
}

/* ========== 学生列表 ========== */
.stu-list {
  margin-top: 8rpx;
}

.stu-item {
  background: #fff;
  border-radius: 24rpx;
  padding: 24rpx 28rpx;
  margin-bottom: 14rpx;
  display: flex;
  align-items: center;
  border: 2rpx solid var(--border);
  box-shadow: var(--shadow-sm);
  transition: all 0.18s ease;
}

.stu-item:active {
  transform: scale(0.98);
  box-shadow: 0 2rpx 6rpx rgba(15, 23, 42, 0.06);
}

.stu-avatar {
  width: 84rpx;
  height: 84rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 24rpx;
  flex-shrink: 0;
  font-weight: 800;
}

.avatar-ok {
  background: linear-gradient(135deg, #1CB0F6, #4F46E5);
  color: #fff;
  box-shadow: 0 6rpx 16rpx rgba(28, 176, 246, 0.35);
}

.avatar-wait {
  background: #F1F5F9;
  color: var(--text-secondary);
  border: 2rpx solid var(--border);
}

.stu-avatar-letter {
  font-size: 34rpx;
  font-weight: 800;
  line-height: 1;
}

.stu-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.stu-name {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--text-primary);
}

.stu-phone {
  font-size: 22rpx;
  color: var(--text-secondary);
  margin-top: 4rpx;
  letter-spacing: 1rpx;
}

.stu-status {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8rpx;
  flex-shrink: 0;
}

.stu-time {
  font-size: 22rpx;
  color: var(--text-secondary);
  font-weight: 600;
}

/* ========== 空状态 ========== */
.empty-state {
  text-align: center;
  padding: 100rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14rpx;
}

.empty-emoji {
  font-size: 96rpx;
  line-height: 1;
  opacity: 0.6;
}

.empty-title {
  font-size: 34rpx;
  font-weight: 700;
  color: var(--text-secondary);
}

.empty-sub-text {
  font-size: 26rpx;
  color: var(--text-placeholder);
}

/* ========== 加载更多 ========== */
.load-more-wrap {
  text-align: center;
  padding: 32rpx;
}

.load-more-text {
  color: var(--primary);
  font-size: 28rpx;
  font-weight: 700;
}

/* ========== 新一轮签到弹层 ========== */
.ns-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  animation: ns-fade 0.2s ease;
}

@keyframes ns-fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.ns-card {
  width: 640rpx;
  background: #fff;
  border-radius: 36rpx;
  padding: 48rpx 40rpx 36rpx;
  box-sizing: border-box;
  box-shadow: 0 40rpx 80rpx rgba(15, 23, 42, 0.3);
  animation: ns-pop 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes ns-pop {
  from { transform: scale(0.9); opacity: 0; }
  to   { transform: scale(1);   opacity: 1; }
}

.ns-title {
  font-size: 40rpx;
  font-weight: 800;
  color: var(--text-primary);
  display: block;
  margin-bottom: 32rpx;
}

.ns-placeholder {
  color: var(--text-placeholder);
  font-size: 30rpx;
  font-weight: 400;
  line-height: 96rpx;
  height: 96rpx;
  overflow: visible;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.ns-option {
  display: flex;
  align-items: flex-start;
  gap: 20rpx;
  padding: 24rpx 20rpx;
  background: #F8FAFC;
  border: 2rpx solid var(--border);
  border-radius: 20rpx;
  margin-bottom: 8rpx;
}

.ns-checkbox {
  width: 40rpx;
  height: 40rpx;
  border-radius: 10rpx;
  border: 3rpx solid var(--border-strong);
  background: #fff;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 4rpx;
  transition: all 0.15s ease;
}

.ns-checkbox-on {
  background: linear-gradient(135deg, #EF4444, #F59E0B);
  border-color: #EF4444;
}

.ns-check-mark {
  color: #fff;
  font-size: 28rpx;
  font-weight: 900;
  line-height: 1;
}

.ns-option-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.ns-option-title {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--text-primary);
}

.ns-option-sub {
  font-size: 22rpx;
  color: var(--text-secondary);
  line-height: 1.5;
}
</style>
