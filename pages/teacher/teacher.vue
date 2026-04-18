<template>
  <view class="container">
    <text class="page-title">教师端</text>
    <text class="page-subtitle">扫码签到 / 查看学生签到状态</text>

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
      <view class="stu-item" v-for="item in students" :key="item._id">
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
      scanResult: null
    }
  },

  computed: {
    progressPercent() {
      if (this.stats.total === 0) return 0
      return Math.round((this.stats.checked / this.stats.total) * 100)
    }
  },

  onShow() {
    this.loadStudents(true)
  },

  onPullDownRefresh() {
    this.loadStudents(true).then(() => {
      uni.stopPullDownRefresh()
    })
  },

  methods: {
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

    scanQRCode() {
      uni.scanCode({
        onlyFromCamera: true,
        scanType: ['qrCode'],
        success: async (res) => {
          try {
            const qrData = JSON.parse(res.result)

            if (qrData.type !== 'checkin' || !qrData.studentId) {
              this.scanResult = { success: false, message: '无效的签到二维码' }
              return
            }

            const now = Date.now()
            if (now - qrData.timestamp > 5 * 60 * 1000) {
              this.scanResult = { success: false, message: '二维码已过期，请让学生重新生成' }
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
              this.loadStudents(true)
            }

            setTimeout(() => {
              this.scanResult = null
            }, 3000)
          } catch (err) {
            console.error('扫码处理失败:', err)
            this.scanResult = { success: false, message: '二维码解析失败' }
          }
        },
        fail: (err) => {
          if (err.errMsg.indexOf('cancel') === -1) {
            uni.showToast({ title: '扫码失败', icon: 'none' })
          }
        }
      })
    }
  }
}
</script>

<style scoped>
/* 统计卡片 */
.stats-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 28rpx;
}

.stat-card {
  flex: 1;
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx 16rpx;
  text-align: center;
  border: 4rpx solid #E5E5E5;
}

.stat-total { border-color: #1CB0F6; }
.stat-yes { border-color: #58CC02; }
.stat-no { border-color: #FF4B4B; }

.stat-num {
  font-size: 52rpx;
  font-weight: 800;
  display: block;
}

.stat-total .stat-num { color: #1CB0F6; }
.stat-yes .stat-num { color: #58CC02; }
.stat-no .stat-num { color: #FF4B4B; }

.stat-lbl {
  font-size: 24rpx;
  color: #AFAFAF;
  font-weight: 600;
  margin-top: 4rpx;
  display: block;
}

/* 进度条 */
.progress-wrap {
  margin-bottom: 28rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.progress-bar {
  flex: 1;
  height: 20rpx;
  background: #E5E5E5;
  border-radius: 10rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #58CC02;
  border-radius: 10rpx;
  transition: width 0.5s;
}

.progress-text {
  font-size: 26rpx;
  font-weight: 700;
  color: #58CC02;
  flex-shrink: 0;
}

/* 扫码按钮 */
.btn-scan {
  background: #1CB0F6;
  color: #fff;
  border: none;
  border-radius: 24rpx;
  padding: 30rpx 0;
  font-size: 36rpx;
  font-weight: 700;
  text-align: center;
  width: 100%;
  margin-bottom: 28rpx;
  box-shadow: 0 8rpx 0 #1899D6;
  position: relative;
  top: 0;
  letter-spacing: 4rpx;
}

.btn-scan:active {
  top: 6rpx;
  box-shadow: 0 2rpx 0 #1899D6;
}

/* 签到结果 */
.result-banner {
  border-radius: 20rpx;
  padding: 28rpx 32rpx;
  margin-bottom: 28rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.result-ok {
  background: #D7FFB8;
  border: 4rpx solid #58CC02;
}

.result-err {
  background: #FFE0E0;
  border: 4rpx solid #FF4B4B;
}

.result-emoji {
  font-size: 44rpx;
  flex-shrink: 0;
}

.result-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.result-msg-text {
  font-size: 30rpx;
  font-weight: 700;
  color: #3c3c3c;
}

.result-name-text {
  font-size: 26rpx;
  color: #777;
  margin-top: 4rpx;
}

/* 筛选 */
.filter-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 28rpx;
}

.filter-pill {
  flex: 1;
  text-align: center;
  padding: 18rpx;
  border-radius: 20rpx;
  font-size: 28rpx;
  font-weight: 700;
  background: #fff;
  color: #AFAFAF;
  border: 4rpx solid #E5E5E5;
}

.pill-active {
  background: #1CB0F6;
  color: #fff;
  border-color: #1CB0F6;
  box-shadow: 0 4rpx 0 #1899D6;
}

/* 学生列表 */
.stu-list {
  margin-top: 8rpx;
}

.stu-item {
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx 28rpx;
  margin-bottom: 16rpx;
  display: flex;
  align-items: center;
  border: 4rpx solid #E5E5E5;
}

.stu-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 24rpx;
  flex-shrink: 0;
}

.avatar-ok { background: #D7FFB8; }
.avatar-wait { background: #E5E5E5; }

.stu-avatar-letter {
  font-size: 36rpx;
  font-weight: 800;
  color: #3c3c3c;
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
  color: #3c3c3c;
}

.stu-phone {
  font-size: 24rpx;
  color: #AFAFAF;
  margin-top: 4rpx;
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
  color: #AFAFAF;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 80rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
}

.empty-emoji {
  font-size: 80rpx;
}

.empty-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #AFAFAF;
}

.empty-sub-text {
  font-size: 26rpx;
  color: #CDCDCD;
}

/* 加载更多 */
.load-more-wrap {
  text-align: center;
  padding: 32rpx;
}

.load-more-text {
  color: #1CB0F6;
  font-size: 28rpx;
  font-weight: 700;
}
</style>
