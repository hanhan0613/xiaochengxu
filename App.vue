<script>
export default {
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloud1-7gl718wp38e9e33c',
        traceUser: true
      })
    }
  },
  globalData: {
    userInfo: null,
    role: null
  }
}
</script>

<style>
page {
  background-color: #f7f7f7;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  font-size: 28rpx;
  color: #3c3c3c;
  box-sizing: border-box;
}

/* ========== Duolingo 全局样式 ========== */

.container {
  padding: 32rpx;
  min-height: 100vh;
}

/* 主按钮 - 3D 凸起效果 */
.btn-primary {
  background: #58CC02;
  color: #fff;
  border: none;
  border-radius: 24rpx;
  padding: 28rpx 0;
  font-size: 34rpx;
  font-weight: 700;
  text-align: center;
  width: 100%;
  margin-top: 30rpx;
  box-shadow: 0 8rpx 0 #46A302;
  letter-spacing: 2rpx;
  position: relative;
  top: 0;
  transition: all 0.1s;
}

.btn-primary:active {
  top: 6rpx;
  box-shadow: 0 2rpx 0 #46A302;
}

.btn-primary[disabled] {
  background: #E5E5E5;
  color: #AFAFAF;
  box-shadow: 0 8rpx 0 #CDCDCD;
}

/* 次按钮 */
.btn-secondary {
  background: #fff;
  color: #1CB0F6;
  border: 4rpx solid #E5E5E5;
  border-radius: 24rpx;
  padding: 26rpx 0;
  font-size: 34rpx;
  font-weight: 700;
  text-align: center;
  width: 100%;
  margin-top: 20rpx;
  box-shadow: 0 8rpx 0 #E5E5E5;
  position: relative;
  top: 0;
}

.btn-secondary:active {
  top: 6rpx;
  box-shadow: 0 2rpx 0 #E5E5E5;
}

/* 输入框 */
.input-group {
  margin-bottom: 28rpx;
}

.input-label {
  font-size: 26rpx;
  color: #AFAFAF;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 2rpx;
  margin-bottom: 12rpx;
  display: block;
}

.input-field {
  background: #fff;
  border: 4rpx solid #E5E5E5;
  border-radius: 20rpx;
  padding: 0 24rpx;
  height: 96rpx;
  line-height: 96rpx;
  font-size: 32rpx;
  font-weight: 500;
  width: 100%;
  box-sizing: border-box;
  color: #3c3c3c;
  overflow: visible;
}

.input-field:focus {
  border-color: #1CB0F6;
}

/* 卡片 */
.card {
  background: #fff;
  border-radius: 24rpx;
  padding: 36rpx;
  margin-bottom: 28rpx;
  border: 4rpx solid #E5E5E5;
}

/* 标签 */
.tag-checked {
  display: inline-block;
  background: #58CC02;
  color: #fff;
  font-size: 24rpx;
  font-weight: 700;
  padding: 8rpx 20rpx;
  border-radius: 16rpx;
}

.tag-unchecked {
  display: inline-block;
  background: #FF4B4B;
  color: #fff;
  font-size: 24rpx;
  font-weight: 700;
  padding: 8rpx 20rpx;
  border-radius: 16rpx;
}

/* 页面标题 */
.page-title {
  font-size: 48rpx;
  font-weight: 800;
  color: #3c3c3c;
  margin-bottom: 8rpx;
  display: block;
}

.page-subtitle {
  font-size: 28rpx;
  color: #AFAFAF;
  font-weight: 500;
  margin-bottom: 40rpx;
  display: block;
}
</style>
