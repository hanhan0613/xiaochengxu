<template>
  <view class="container">
    <text class="page-title">历史签到</text>
    <text class="page-subtitle">查看过去每次签到活动的详细记录</text>

    <!-- 活动列表 -->
    <view v-if="!detailSession" class="sessions-list">
      <view
        class="session-card"
        v-for="item in sessions"
        :key="item._id"
      >
        <view class="session-head" @click="openDetail(item)">
          <view :class="['status-dot', item.status === 'active' ? 'dot-active' : 'dot-ended']"></view>
          <text class="session-card-title">{{ item.title }}</text>
          <view class="session-delete" @click.stop="confirmDelete(item)">
            <text class="session-delete-icon">&#x1F5D1;</text>
          </view>
        </view>

        <view class="session-meta" @click="openDetail(item)">
          <text class="session-date">{{ formatDate(item.createdAt) }}</text>
          <text class="session-status-text">{{ item.status === 'active' ? '进行中' : '已结束' }}</text>
        </view>

        <view class="session-stats" @click="openDetail(item)">
          <view class="stat-mini">
            <text class="stat-mini-num">{{ item.checkedCount }}</text>
            <text class="stat-mini-lbl">已签到</text>
          </view>
          <view class="stat-divider"></view>
          <view class="stat-mini">
            <text class="stat-mini-num">{{ item.totalStudents }}</text>
            <text class="stat-mini-lbl">总人数</text>
          </view>
          <view class="stat-divider"></view>
          <view class="stat-mini">
            <text class="stat-mini-num rate-num">{{ item.attendanceRate }}%</text>
            <text class="stat-mini-lbl">签到率</text>
          </view>
        </view>

        <view class="rate-bar" @click="openDetail(item)">
          <view class="rate-fill" :style="{ width: item.attendanceRate + '%' }"></view>
        </view>
      </view>

      <view v-if="sessions.length === 0 && !isLoading" class="empty-state">
        <text class="empty-emoji">&#x1F4DC;</text>
        <text class="empty-title">暂无历史记录</text>
        <text class="empty-sub-text">开启并完成活动后，这里会显示</text>
      </view>
    </view>

    <!-- 详情视图 -->
    <view v-else class="detail-view">
      <view class="detail-back" @click="closeDetail">
        <text class="back-arrow">&#x2190;</text>
        <text class="back-text">返回列表</text>
      </view>

      <view class="card">
        <text class="card-heading">{{ detailSession.session.title }}</text>
        <view class="detail-meta">
          <text class="detail-meta-item">开始：{{ formatDateFull(detailSession.session.createdAt) }}</text>
          <text class="detail-meta-item" v-if="detailSession.session.endedAt">结束：{{ formatDateFull(detailSession.session.endedAt) }}</text>
          <text class="detail-meta-item">状态：{{ detailSession.session.status === 'active' ? '进行中' : '已结束' }}</text>
        </view>

        <view class="detail-stats">
          <view class="detail-stat">
            <text class="detail-stat-num">{{ detailSession.session.checkedCount }}</text>
            <text class="detail-stat-lbl">已签到</text>
          </view>
          <view class="detail-stat">
            <text class="detail-stat-num">{{ detailSession.session.totalStudents }}</text>
            <text class="detail-stat-lbl">总人数</text>
          </view>
          <view class="detail-stat">
            <text class="detail-stat-num">{{ detailSession.session.attendanceRate }}%</text>
            <text class="detail-stat-lbl">签到率</text>
          </view>
        </view>
      </view>

      <!-- 筛选 -->
      <view class="filter-row">
        <view
          :class="['filter-pill', rosterFilter === 'all' ? 'pill-active' : '']"
          @click="rosterFilter = 'all'"
        >全部 ({{ detailSession.roster.length }})</view>
        <view
          :class="['filter-pill', rosterFilter === 'checked' ? 'pill-active' : '']"
          @click="rosterFilter = 'checked'"
        >已签到 ({{ checkedCount }})</view>
        <view
          :class="['filter-pill', rosterFilter === 'unchecked' ? 'pill-active' : '']"
          @click="rosterFilter = 'unchecked'"
        >未签到 ({{ uncheckedCount }})</view>
      </view>

      <view class="roster-list">
        <view
          :class="['roster-item', !item.checkedIn ? 'roster-item-miss' : '']"
          v-for="(item, idx) in filteredRoster"
          :key="item._id"
        >
          <view class="roster-idx">{{ idx + 1 }}</view>
          <view :class="['roster-avatar', item.checkedIn ? 'avatar-on' : 'avatar-off']">
            <text class="roster-letter">{{ item.name.charAt(0) }}</text>
          </view>
          <view class="roster-info">
            <text class="roster-name">{{ item.name }}</text>
            <text class="roster-phone" :selectable="true" :user-select="true">{{ item.phone }}</text>
          </view>
          <view class="roster-right">
            <view :class="item.checkedIn ? 'tag-checked' : 'tag-unchecked'">
              {{ item.checkedIn ? '已签到' : '未签到' }}
            </view>
            <text class="roster-time" v-if="item.checkedIn && item.checkInTime">
              {{ formatTime(item.checkInTime) }}
            </text>
          </view>
        </view>

        <view v-if="filteredRoster.length === 0" class="empty-state">
          <text class="empty-emoji">&#x1F4ED;</text>
          <text class="empty-title">没有符合条件的学生</text>
        </view>
      </view>
    </view>

  </view>
</template>

<script>
export default {
  data() {
    return {
      sessions: [],
      isLoading: false,
      detailSession: null,
      rosterFilter: 'all'
    }
  },

  computed: {
    checkedCount() {
      if (!this.detailSession) return 0
      return this.detailSession.roster.filter(r => r.checkedIn).length
    },
    uncheckedCount() {
      if (!this.detailSession) return 0
      return this.detailSession.roster.filter(r => !r.checkedIn).length
    },
    filteredRoster() {
      if (!this.detailSession) return []
      const r = this.detailSession.roster
      if (this.rosterFilter === 'checked') return r.filter(x => x.checkedIn)
      if (this.rosterFilter === 'unchecked') return r.filter(x => !x.checkedIn)
      return r
    }
  },

  async onShow() {
    const ok = await this.ensureTeacher()
    if (!ok) return
    this.loadSessions()
  },

  methods: {
    async ensureTeacher() {
      let role = uni.getStorageSync('role')
      if (role !== 'teacher') {
        try {
          const res = await wx.cloud.callFunction({ name: 'getRole' })
          const r = res && res.result ? res.result : {}
          role = r.role
          if (role === 'teacher') uni.setStorageSync('role', 'teacher')
        } catch (err) { console.error(err) }
      }
      if (role !== 'teacher') {
        uni.showModal({
          title: '无权限',
          content: '仅教师可查看历史记录',
          showCancel: false,
          success: () => uni.reLaunch({ url: '/pages/index/index' })
        })
        return false
      }
      return true
    },

    async loadSessions() {
      if (this.isLoading) return
      this.isLoading = true
      try {
        const res = await wx.cloud.callFunction({
          name: 'listSessions',
          data: { page: 1, pageSize: 50 }
        })
        const r = res && res.result ? res.result : {}
        if (r.success) {
          this.sessions = r.data || []
        } else {
          uni.showToast({ title: r.message || '加载失败', icon: 'none' })
        }
      } catch (err) {
        console.error(err)
        uni.showToast({ title: '加载失败', icon: 'none' })
      }
      this.isLoading = false
    },

    async openDetail(session) {
      uni.showLoading({ title: '加载详情...' })
      try {
        const res = await wx.cloud.callFunction({
          name: 'getSessionDetail',
          data: { sessionId: session._id }
        })
        uni.hideLoading()
        const r = res && res.result ? res.result : {}
        if (r.success) {
          // 兼容旧版云函数返回的 checkins 字段
          if (!r.roster && Array.isArray(r.checkins)) {
            r.roster = r.checkins.map(c => ({
              _id: c.studentId,
              name: c.studentName,
              phone: c.studentPhone,
              checkedIn: true,
              checkInTime: c.checkInTime
            }))
          }
          this.rosterFilter = 'all'
          this.detailSession = r
        } else {
          uni.showToast({ title: r.message || '加载失败', icon: 'none' })
        }
      } catch (err) {
        uni.hideLoading()
        console.error(err)
        uni.showToast({ title: '加载失败', icon: 'none' })
      }
    },

    closeDetail() {
      this.detailSession = null
    },

    confirmDelete(session) {
      const isActive = session.status === 'active'
      const content = isActive
        ? `此活动正在进行中。删除会清除所有签到记录并重置学生签到状态，不可恢复！确定？`
        : `将删除活动"${session.title}"及其所有签到记录，不可恢复。确定？`

      uni.showModal({
        title: isActive ? '删除进行中的活动' : '删除历史记录',
        content,
        confirmColor: '#EF4444',
        confirmText: '删除',
        success: async (res) => {
          if (!res.confirm) return
          uni.showLoading({ title: '删除中...', mask: true })
          try {
            const cloudRes = await wx.cloud.callFunction({
              name: 'deleteSession',
              data: { sessionId: session._id }
            })
            uni.hideLoading()
            const r = cloudRes && cloudRes.result ? cloudRes.result : {}
            if (r.success) {
              uni.showToast({ title: '已删除', icon: 'success' })
              // 从列表里移除这条
              this.sessions = this.sessions.filter(s => s._id !== session._id)
            } else {
              uni.showToast({ title: r.message || '删除失败', icon: 'none' })
            }
          } catch (err) {
            uni.hideLoading()
            console.error(err)
            uni.showToast({ title: '网络错误', icon: 'none' })
          }
        }
      })
    },

    formatDate(raw) {
      if (!raw) return ''
      const d = new Date(raw)
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const h = String(d.getHours()).padStart(2, '0')
      const mi = String(d.getMinutes()).padStart(2, '0')
      return `${d.getFullYear()}-${m}-${day} ${h}:${mi}`
    },

    formatDateFull(raw) {
      return this.formatDate(raw)
    },

    formatTime(raw) {
      if (!raw) return ''
      const d = new Date(raw)
      const h = String(d.getHours()).padStart(2, '0')
      const mi = String(d.getMinutes()).padStart(2, '0')
      const s = String(d.getSeconds()).padStart(2, '0')
      return `${h}:${mi}:${s}`
    }
  }
}
</script>

<style scoped>
/* ========== 活动卡片 ========== */
.sessions-list {
  margin-top: 8rpx;
}

.session-card {
  background: #fff;
  border-radius: 28rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  border: 2rpx solid var(--border);
  box-shadow: var(--shadow-sm);
  transition: all 0.18s ease;
}

.session-card:active {
  transform: scale(0.99);
  box-shadow: var(--shadow-md);
}

.session-head {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-bottom: 12rpx;
}

.status-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-active {
  background: #22C55E;
  box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6);
  animation: pulse-green 1.6s infinite;
}

@keyframes pulse-green {
  0%   { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.6); }
  70%  { box-shadow: 0 0 0 14rpx rgba(34, 197, 94, 0); }
  100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
}

.dot-ended {
  background: var(--text-placeholder);
}

.session-card-title {
  font-size: 30rpx;
  font-weight: 800;
  color: var(--text-primary);
  flex: 1;
}

.session-delete {
  width: 60rpx;
  height: 60rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.18s ease;
  margin-left: 8rpx;
}

.session-delete:active {
  background: rgba(239, 68, 68, 0.1);
  transform: scale(0.9);
}

.session-delete-icon {
  font-size: 32rpx;
  line-height: 1;
  opacity: 0.5;
}

.session-delete:active .session-delete-icon {
  opacity: 1;
}

.session-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.session-date {
  font-size: 22rpx;
  color: var(--text-secondary);
}

.session-status-text {
  font-size: 22rpx;
  color: var(--text-secondary);
  font-weight: 600;
  padding: 4rpx 16rpx;
  background: #F1F5F9;
  border-radius: 999rpx;
}

.session-stats {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 0;
  border-top: 2rpx solid var(--border);
  margin-bottom: 16rpx;
}

.stat-mini {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
}

.stat-mini-num {
  font-size: 32rpx;
  font-weight: 800;
  color: var(--text-primary);
}

.rate-num {
  background: linear-gradient(135deg, #1CB0F6, #4F46E5);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
}

.stat-mini-lbl {
  font-size: 20rpx;
  color: var(--text-secondary);
}

.stat-divider {
  width: 2rpx;
  height: 40rpx;
  background: var(--border);
}

.rate-bar {
  height: 10rpx;
  background: #E2E8F0;
  border-radius: 999rpx;
  overflow: hidden;
}

.rate-fill {
  height: 100%;
  background: linear-gradient(90deg, #1CB0F6, #4F46E5);
  border-radius: 999rpx;
  transition: width 0.5s ease;
}

/* ========== 详情视图 ========== */
.detail-view {
  padding-top: 8rpx;
}

.detail-back {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 16rpx 0;
  margin-bottom: 16rpx;
}

.back-arrow {
  font-size: 36rpx;
  color: var(--primary);
  font-weight: 700;
  line-height: 1;
  display: flex;
  align-items: center;
}

.back-text {
  font-size: 28rpx;
  color: var(--primary);
  font-weight: 700;
}

.card-heading {
  font-size: 36rpx;
  font-weight: 800;
  color: var(--text-primary);
  display: block;
  margin-bottom: 16rpx;
  letter-spacing: -0.5rpx;
}

.detail-meta {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-bottom: 28rpx;
}

.detail-meta-item {
  font-size: 24rpx;
  color: var(--text-secondary);
}

.detail-stats {
  display: flex;
  gap: 16rpx;
  padding-top: 24rpx;
  border-top: 2rpx solid var(--border);
}

.detail-stat {
  flex: 1;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.detail-stat-num {
  font-size: 44rpx;
  font-weight: 800;
  background: linear-gradient(135deg, #1CB0F6, #4F46E5);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
}

.detail-stat-lbl {
  font-size: 22rpx;
  color: var(--text-secondary);
}

.list-heading {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--text-primary);
  margin: 12rpx 0 16rpx;
  display: block;
  letter-spacing: 0.5rpx;
}

/* ========== 筛选 ========== */
.filter-row {
  display: flex;
  gap: 12rpx;
  margin-bottom: 20rpx;
  background: #fff;
  padding: 8rpx;
  border-radius: 999rpx;
  border: 2rpx solid var(--border);
}

.filter-pill {
  flex: 1;
  text-align: center;
  padding: 14rpx 8rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  font-weight: 700;
  color: var(--text-secondary);
  transition: all 0.2s ease;
  line-height: 1.3;
}

.pill-active {
  background: linear-gradient(135deg, #1CB0F6, #4F46E5);
  color: #fff;
  box-shadow: 0 4rpx 12rpx rgba(28, 176, 246, 0.4);
}

/* ========== 学生名单（含未签到） ========== */
.roster-list {
  margin-top: 8rpx;
}

.roster-item {
  background: #fff;
  border-radius: 20rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 12rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  border: 2rpx solid var(--border);
  box-shadow: var(--shadow-sm);
  transition: all 0.18s ease;
}

.roster-item-miss {
  background: #FAFBFC;
  opacity: 0.85;
}

.roster-idx {
  width: 48rpx;
  font-size: 22rpx;
  color: var(--text-placeholder);
  font-weight: 700;
  text-align: center;
  flex-shrink: 0;
}

.roster-avatar {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-on {
  background: linear-gradient(135deg, #1CB0F6, #4F46E5);
  box-shadow: 0 4rpx 12rpx rgba(28, 176, 246, 0.3);
}

.avatar-off {
  background: #F1F5F9;
  border: 2rpx solid var(--border);
}

.roster-letter {
  color: #fff;
  font-size: 26rpx;
  font-weight: 800;
  line-height: 1;
}

.avatar-off .roster-letter {
  color: var(--text-secondary);
}

.roster-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.roster-name {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--text-primary);
}

.roster-item-miss .roster-name {
  color: var(--text-secondary);
}

.roster-phone {
  font-size: 22rpx;
  color: var(--text-secondary);
  letter-spacing: 1rpx;
  margin-top: 2rpx;
}

.roster-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6rpx;
  flex-shrink: 0;
}

.roster-time {
  font-size: 22rpx;
  color: var(--text-secondary);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
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
  font-size: 30rpx;
  font-weight: 700;
  color: var(--text-secondary);
}

.empty-sub-text {
  font-size: 24rpx;
  color: var(--text-placeholder);
}
</style>
