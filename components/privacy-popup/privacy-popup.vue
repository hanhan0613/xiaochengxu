<template>
  <view v-if="showPopup" class="privacy-mask" catchtouchmove="true">
    <view class="privacy-card">
      <text class="privacy-title">用户隐私保护提示</text>

      <scroll-view scroll-y class="privacy-scroll">
        <text class="privacy-text">
感谢您使用本小程序！在您使用前，请您仔细阅读
        </text>
        <text class="privacy-link" @click="openContract">《{{ contractName }}》</text>
        <text class="privacy-text">
。为了向您提供签到打卡等服务，我们将在您使用过程中收集、使用必要的信息，包括：

• 姓名、手机号、核验码：用于学生身份登记与签到
• 微信账号标识（openid）：用于区分用户身份、关联签到记录
• 扫码与二维码信息：用于完成签到流程

我们会严格按照隐私协议保护您的个人信息，未经您同意不会用于协议约定外的用途。

点击"同意"即表示您已阅读并同意完整协议内容。
        </text>
      </scroll-view>

      <view class="privacy-btn-row">
        <button class="privacy-btn privacy-btn-reject" @click="handleReject">
          拒绝
        </button>
        <button
          class="privacy-btn privacy-btn-agree"
          open-type="agreePrivacyAuthorization"
          @agreeprivacyauthorization="handleAgree"
        >
          同意
        </button>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'PrivacyPopup',
  data() {
    return {
      showPopup: false,
      contractName: '用户隐私保护指引',
      resolvePrivacyAuth: null
    }
  },
  mounted() {
    this.initPrivacyListener()
  },
  methods: {
    initPrivacyListener() {
      if (!wx.onNeedPrivacyAuthorization) {
        return
      }
      wx.onNeedPrivacyAuthorization((resolve, eventInfo) => {
        this.resolvePrivacyAuth = resolve
        if (wx.getPrivacySetting) {
          wx.getPrivacySetting({
            success: (res) => {
              if (res && res.privacyContractName) {
                this.contractName = res.privacyContractName
              }
            }
          })
        }
        this.showPopup = true
      })
    },
    handleAgree() {
      this.showPopup = false
      if (typeof this.resolvePrivacyAuth === 'function') {
        this.resolvePrivacyAuth({ event: 'agree' })
        this.resolvePrivacyAuth = null
      }
      this.$emit('agree')
    },
    handleReject() {
      this.showPopup = false
      if (typeof this.resolvePrivacyAuth === 'function') {
        this.resolvePrivacyAuth({ event: 'disagree' })
        this.resolvePrivacyAuth = null
      }
      this.$emit('reject')
    },
    openContract() {
      if (!wx.openPrivacyContract) {
        uni.showToast({ title: '当前微信版本不支持', icon: 'none' })
        return
      }
      wx.openPrivacyContract({
        fail: () => {
          uni.showToast({ title: '打开协议失败', icon: 'none' })
        }
      })
    }
  }
}
</script>

<style scoped>
.privacy-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.privacy-card {
  width: 620rpx;
  max-height: 80vh;
  background: #fff;
  border-radius: 36rpx;
  padding: 48rpx 40rpx 36rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  box-shadow: 0 40rpx 80rpx rgba(15, 23, 42, 0.3);
}

.privacy-title {
  font-size: 36rpx;
  font-weight: 800;
  color: #0F172A;
  text-align: center;
  display: block;
  margin-bottom: 24rpx;
}

.privacy-scroll {
  max-height: 600rpx;
  margin-bottom: 28rpx;
}

.privacy-text {
  font-size: 26rpx;
  color: #334155;
  line-height: 1.7;
  white-space: pre-wrap;
}

.privacy-link {
  font-size: 26rpx;
  color: #1CB0F6;
  font-weight: 700;
  text-decoration: underline;
}

.privacy-btn-row {
  display: flex;
  gap: 20rpx;
}

.privacy-btn {
  flex: 1;
  height: 84rpx;
  line-height: 84rpx;
  border-radius: 24rpx;
  font-size: 30rpx;
  font-weight: 700;
  border: none;
  padding: 0;
}

.privacy-btn-reject {
  background: #F1F5F9;
  color: #64748B;
}

.privacy-btn-agree {
  background: linear-gradient(135deg, #1CB0F6 0%, #4F46E5 100%);
  color: #fff;
  box-shadow: 0 8rpx 20rpx rgba(28, 176, 246, 0.35);
}

.privacy-btn-agree::after {
  border: none;
}
</style>
