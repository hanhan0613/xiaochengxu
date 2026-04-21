<template>
  <view class="container">
    <!-- 隐私授权弹层 -->
    <privacy-popup />

    <text class="page-title">管理后台</text>
    <text class="page-subtitle">上传名单 / 管理签到数据</text>

    <!-- Excel上传区域 -->
    <view class="card">
      <text class="card-heading">上传学生名单</text>
      <text class="card-desc">支持 .xlsx 格式，表头需包含"姓名"、"手机号"和"核验码"列</text>

      <view class="upload-zone" @click="chooseExcel" hover-class="upload-zone-active">
        <text class="upload-big-icon">&#x1F4C1;</text>
        <text class="upload-main-text">点击选择 Excel 文件</text>
        <text class="upload-sub-text">支持 .xlsx 格式</text>
      </view>

      <!-- 已选文件信息 -->
      <view class="file-tag" v-if="selectedFile">
        <text class="file-tag-name">{{ selectedFile.name }}</text>
        <text class="file-tag-size">{{ selectedFile.sizeStr }}</text>
      </view>

      <!-- 解析预览 -->
      <view class="preview-area" v-if="parsedStudents.length > 0">
        <text class="preview-heading">预览（共 {{ parsedStudents.length }} 条数据）</text>

        <view class="preview-tbl">
          <view class="preview-tbl-head">
            <text class="preview-cell cell-idx">#</text>
            <text class="preview-cell cell-name">姓名</text>
            <text class="preview-cell cell-phone">手机号</text>
            <text class="preview-cell cell-code">核验码</text>
          </view>
          <view class="preview-tbl-row" v-for="(item, index) in previewList" :key="index">
            <text class="preview-cell cell-idx">{{ index + 1 }}</text>
            <text class="preview-cell cell-name">{{ item.name }}</text>
            <text class="preview-cell cell-phone">{{ item.phone }}</text>
            <text class="preview-cell cell-code">{{ item.code }}</text>
          </view>
          <view class="preview-tbl-more" v-if="parsedStudents.length > 5">
            <text>... 共 {{ parsedStudents.length }} 条</text>
          </view>
        </view>

        <button class="btn-primary" @click="uploadStudents" :disabled="isUploading">
          {{ isUploading ? '上传中...' : '确认上传' }}
        </button>
      </view>
    </view>

    <!-- 手动添加 -->
    <view class="card">
      <text class="card-heading">手动添加学生</text>

      <view class="input-group">
        <text class="input-label">姓名</text>
        <input
          class="input-field"
          placeholder="输入学生姓名"
          placeholder-class="input-placeholder"
          :adjust-position="true"
          v-model="manualName"
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
          v-model="manualPhone"
        />
      </view>

      <view class="input-group">
        <text class="input-label">核验码</text>
        <input
          class="input-field"
          type="text"
          placeholder="输入核验码（用于学生签到）"
          placeholder-class="input-placeholder"
          :adjust-position="true"
          v-model="manualCode"
        />
      </view>

      <button class="btn-primary" @click="addManual" :disabled="isAdding">
        {{ isAdding ? '添加中...' : '添加学生' }}
      </button>
    </view>

    <!-- 提示：数据重置入口在教师端 -->
    <view class="card hint-card">
      <text class="hint-title">需要重置或清空数据？</text>
      <text class="hint-desc">请回到"教师端"使用"开启新一轮签到"功能，可选择是否清空学生名单。这样保证历史活动数据不受影响。</text>
    </view>
  </view>
</template>

<script>
import * as XLSX from 'xlsx'

export default {
  data() {
    return {
      selectedFile: null,
      parsedStudents: [],
      previewList: [],
      isUploading: false,
      manualName: '',
      manualPhone: '',
      manualCode: '',
      isAdding: false
    }
  },

  async onShow() {
    // 鉴权：非教师直接踢出
    const ok = await this.ensureTeacher()
    if (!ok) return
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
        } catch (err) {
          console.error(err)
        }
      }
      if (role !== 'teacher') {
        uni.showModal({
          title: '无权限',
          content: '管理后台仅限授权教师访问',
          showCancel: false,
          success: () => {
            uni.reLaunch({ url: '/pages/index/index' })
          }
        })
        return false
      }
      return true
    },

    chooseExcel() {
      wx.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['xlsx', 'xls'],
        success: (res) => {
          const file = res.tempFiles[0]
          const sizeKB = (file.size / 1024).toFixed(1)

          this.selectedFile = {
            path: file.path,
            name: file.name,
            size: file.size,
            sizeStr: sizeKB + ' KB'
          }

          this.parseExcel(file.path)
        },
        fail: (err) => {
          if (err.errMsg.indexOf('cancel') === -1) {
            uni.showToast({ title: '选择文件失败', icon: 'none' })
          }
        }
      })
    },

    parseExcel(filePath) {
      uni.showLoading({ title: '解析中...' })

      try {
        const raw = wx.getFileSystemManager().readFileSync(filePath)
        // readFileSync 不传 encoding 时返回 ArrayBuffer；SheetJS 要 Uint8Array
        const data8 = raw instanceof ArrayBuffer ? new Uint8Array(raw) : new Uint8Array(raw.buffer || raw)
        const workbook = XLSX.read(data8, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(firstSheet, { defval: '' })

        if (data.length === 0) {
          uni.hideLoading()
          uni.showToast({ title: 'Excel文件为空', icon: 'none' })
          return
        }

        const firstRow = data[0]
        const keys = Object.keys(firstRow)

        let nameKey = keys.find(k =>
          k.includes('姓名') || k.includes('名字') || k.toLowerCase() === 'name'
        )
        let phoneKey = keys.find(k =>
          k.includes('手机') || k.includes('电话') || k.includes('号码') ||
          k.toLowerCase() === 'phone' || k.toLowerCase() === 'tel'
        )
        let codeKey = keys.find(k =>
          k.includes('核验码') || k.includes('验证码') || k.includes('密码') ||
          k.toLowerCase() === 'code' || k.toLowerCase() === 'password' || k.toLowerCase() === 'pwd'
        )

        if (!nameKey || !phoneKey || !codeKey) {
          uni.hideLoading()
          uni.showModal({
            title: '格式不正确',
            content: `未找到"姓名"、"手机号"或"核验码"列。检测到的列名：${keys.join('、')}`,
            showCancel: false
          })
          return
        }

        const students = data
          .map(row => ({
            name: (row[nameKey] || '').toString().trim(),
            phone: (row[phoneKey] || '').toString().trim(),
            code: (row[codeKey] || '').toString().trim()
          }))
          .filter(s => s.name && s.phone && s.code)

        this.parsedStudents = students
        this.previewList = students.slice(0, 5)

        uni.hideLoading()
        uni.showToast({ title: `解析到 ${students.length} 条数据`, icon: 'success' })
      } catch (err) {
        uni.hideLoading()
        console.error('解析Excel失败:', err)
        uni.showToast({ title: '解析失败，请检查文件格式', icon: 'none', duration: 2000 })
      }
    },

    async uploadStudents() {
      if (this.parsedStudents.length === 0) return
      this.isUploading = true
      uni.showLoading({ title: '上传中...', mask: true })

      try {
        const res = await wx.cloud.callFunction({
          name: 'uploadStudents',
          data: { students: this.parsedStudents }
        })

        uni.hideLoading()

        if (res.result.success) {
          uni.showModal({
            title: '上传成功',
            content: res.result.message,
            showCancel: false
          })
          this.parsedStudents = []
          this.previewList = []
          this.selectedFile = null
        } else {
          uni.showToast({ title: res.result.message || '上传失败', icon: 'none' })
        }
      } catch (err) {
        uni.hideLoading()
        console.error('上传失败:', err)
        uni.showToast({ title: '上传失败，请重试', icon: 'none' })
      }

      this.isUploading = false
    },

    async addManual() {
      if (!this.manualName.trim()) {
        uni.showToast({ title: '请输入姓名', icon: 'none' })
        return
      }
      if (!this.manualPhone.trim()) {
        uni.showToast({ title: '请输入手机号', icon: 'none' })
        return
      }
      if (!this.manualCode.trim()) {
        uni.showToast({ title: '请输入核验码', icon: 'none' })
        return
      }

      this.isAdding = true

      try {
        const res = await wx.cloud.callFunction({
          name: 'uploadStudents',
          data: {
            students: [{
              name: this.manualName.trim(),
              phone: this.manualPhone.trim(),
              code: this.manualCode.trim()
            }]
          }
        })

        if (res.result.success) {
          uni.showToast({ title: '添加成功', icon: 'success' })
          this.manualName = ''
          this.manualPhone = ''
          this.manualCode = ''
        } else {
          uni.showToast({ title: res.result.message || '添加失败', icon: 'none' })
        }
      } catch (err) {
        console.error(err)
        uni.showToast({ title: '添加失败', icon: 'none' })
      }

      this.isAdding = false
    },

  }
}
</script>

<style scoped>
.input-placeholder {
  color: var(--text-placeholder);
  font-size: 30rpx;
  font-weight: 400;
  line-height: 96rpx;
  height: 96rpx;
  overflow: visible;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.card-heading {
  font-size: 36rpx;
  font-weight: 800;
  color: var(--text-primary);
  display: block;
  margin-bottom: 10rpx;
  letter-spacing: -0.5rpx;
}

.card-desc {
  font-size: 24rpx;
  color: var(--text-secondary);
  font-weight: 500;
  display: block;
  margin-bottom: 32rpx;
  line-height: 1.5;
}

/* ========== 上传区域 ========== */
.upload-zone {
  border: 3rpx dashed var(--primary-light);
  border-radius: 28rpx;
  padding: 56rpx 32rpx;
  text-align: center;
  background: linear-gradient(135deg, #F0F9FF 0%, #E0F3FF 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14rpx;
  transition: all 0.2s ease;
}

.upload-zone-active {
  background: linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%);
  border-color: var(--primary);
  transform: scale(0.99);
}

.upload-big-icon {
  font-size: 80rpx;
  line-height: 1;
  display: block;
  filter: drop-shadow(0 4rpx 8rpx rgba(28, 176, 246, 0.2));
}

.upload-main-text {
  font-size: 32rpx;
  color: var(--primary-dark);
  font-weight: 700;
}

.upload-sub-text {
  font-size: 22rpx;
  color: var(--text-placeholder);
}

/* ========== 文件标签 ========== */
.file-tag {
  margin-top: 24rpx;
  padding: 22rpx 26rpx;
  background: linear-gradient(135deg, #E0F3FF 0%, #DBEAFE 100%);
  border-radius: 20rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 2rpx solid var(--primary-light);
  box-shadow: 0 4rpx 12rpx rgba(28, 176, 246, 0.1);
}

.file-tag-name {
  font-size: 28rpx;
  color: var(--primary-dark);
  font-weight: 700;
}

.file-tag-size {
  font-size: 22rpx;
  color: var(--text-secondary);
  background: #fff;
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  font-weight: 600;
}

/* ========== 预览表格 ========== */
.preview-area { margin-top: 36rpx; }

.preview-heading {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 18rpx;
  display: block;
  letter-spacing: 0.5rpx;
}

.preview-tbl {
  border: 2rpx solid var(--border);
  border-radius: 20rpx;
  overflow: hidden;
  margin-bottom: 24rpx;
  box-shadow: var(--shadow-sm);
}

.preview-tbl-head {
  display: flex;
  background: linear-gradient(135deg, #F8FAFC, #F1F5F9);
  padding: 20rpx 18rpx;
  font-weight: 700;
  font-size: 24rpx;
  color: var(--text-secondary);
  letter-spacing: 1rpx;
  text-transform: uppercase;
}

.preview-tbl-row {
  display: flex;
  padding: 20rpx 18rpx;
  border-top: 2rpx solid var(--border);
  font-size: 26rpx;
  background: #fff;
}

.preview-tbl-row:nth-child(even) {
  background: #FAFBFC;
}

.preview-cell {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-idx  { width: 60rpx;  flex-shrink: 0; color: var(--text-placeholder); font-weight: 600; }
.cell-name { flex: 1; min-width: 0; font-weight: 600; color: var(--text-primary); }
.cell-phone {
  width: 200rpx; flex-shrink: 0; text-align: right;
  color: var(--text-secondary); letter-spacing: 1rpx;
}
.cell-code {
  width: 140rpx; flex-shrink: 0; text-align: right;
  color: var(--primary-dark); font-weight: 600; letter-spacing: 1rpx;
}

.preview-tbl-more {
  text-align: center;
  padding: 18rpx;
  color: var(--text-placeholder);
  font-size: 22rpx;
  border-top: 2rpx solid var(--border);
  background: #FAFBFC;
}

/* ========== 提示卡片 ========== */
.hint-card {
  background: linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%);
  border: 2rpx solid #93C5FD;
  box-shadow: 0 4rpx 12rpx rgba(28, 176, 246, 0.08);
}

.hint-title {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--primary-deep);
  display: block;
  margin-bottom: 12rpx;
}

.hint-desc {
  font-size: 24rpx;
  color: var(--text-secondary);
  display: block;
  line-height: 1.6;
}
</style>
