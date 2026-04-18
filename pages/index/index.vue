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
          <text class="role-sub">扫码签到 / 查看状态</text>
        </view>
        <text class="role-chevron">&#x203A;</text>
      </view>

      <view class="role-card role-admin" @click="goAdmin" hover-class="role-card-active">
        <view class="role-emoji-wrap admin-bg">
          <text class="role-emoji">&#x2699;&#xFE0F;</text>
        </view>
        <view class="role-text">
          <text class="role-title">管理后台</text>
          <text class="role-sub">上传名单 / 管理数据</text>
        </view>
        <text class="role-chevron">&#x203A;</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {}
  },
  onLoad(options) {
    console.log('index onLoad', options)
  },
  methods: {
    goStudent() {
      uni.switchTab({ url: '/pages/student/student' })
    },
    goTeacher() {
      uni.switchTab({ url: '/pages/teacher/teacher' })
    },
    goAdmin() {
      uni.switchTab({ url: '/pages/admin/admin' })
    }
  }
}
</script>

<style scoped>
.hero-section {
  text-align: center;
  padding: 60rpx 0 32rpx;
}

.mascot {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: #58CC02;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 28rpx;
  box-shadow: 0 8rpx 0 #46A302;
}

.mascot-emoji {
  font-size: 72rpx;
}

.hero-title {
  font-size: 56rpx;
  font-weight: 800;
  color: #3c3c3c;
  display: block;
  margin-bottom: 8rpx;
}

.hero-desc {
  font-size: 30rpx;
  color: #AFAFAF;
  font-weight: 500;
  display: block;
}

.role-cards {
  margin-top: 36rpx;
}

.role-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 36rpx 32rpx;
  margin-bottom: 24rpx;
  display: flex;
  align-items: center;
  border: 4rpx solid #E5E5E5;
  box-shadow: 0 6rpx 0 #E5E5E5;
  position: relative;
  top: 0;
}

.role-card-active {
  top: 4rpx;
  box-shadow: 0 2rpx 0 #E5E5E5;
}

.role-emoji-wrap {
  width: 96rpx;
  height: 96rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 28rpx;
  flex-shrink: 0;
}

.role-emoji {
  font-size: 48rpx;
}

.student-bg { background: #DDF4FF; }
.teacher-bg { background: #D7FFB8; }
.admin-bg { background: #FFF0D4; }

.role-text {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.role-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #3c3c3c;
  margin-bottom: 6rpx;
}

.role-sub {
  font-size: 26rpx;
  color: #AFAFAF;
  font-weight: 500;
}

.role-chevron {
  font-size: 48rpx;
  color: #CDCDCD;
  font-weight: 700;
  flex-shrink: 0;
}
</style>
