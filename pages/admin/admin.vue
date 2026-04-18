<template>
  <view class="container">
    <text class="page-title">管理后台</text>
    <text class="page-subtitle">上传名单 / 管理签到数据</text>

    <!-- Excel上传区域 -->
    <view class="card">
      <text class="card-heading">上传学生名单</text>
      <text class="card-desc">支持 .xlsx 格式，表头需包含"姓名"和"手机号"列</text>

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
          </view>
          <view class="preview-tbl-row" v-for="(item, index) in previewList" :key="index">
            <text class="preview-cell cell-idx">{{ index + 1 }}</text>
            <text class="preview-cell cell-name">{{ item.name }}</text>
            <text class="preview-cell cell-phone">{{ item.phone }}</text>
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
          type="number"
          maxlength="11"
          placeholder="输入11位手机号"
          placeholder-class="input-placeholder"
          :adjust-position="true"
          v-model="manualPhone"
        />
      </view>

      <button class="btn-primary" @click="addManual" :disabled="isAdding">
        {{ isAdding ? '添加中...' : '添加学生' }}
      </button>
    </view>

    <!-- 数据管理 -->
    <view class="card">
      <text class="card-heading">数据管理</text>
      <button class="btn-secondary" @click="resetAllCheckIn">重置所有签到状态</button>
      <button class="btn-danger" @click="clearAllStudents">清空所有学生数据</button>
    </view>
  </view>
</template>

<script>
import XLSX from '@/utils/xlsx.mini.js'

export default {
  data() {
    return {
      selectedFile: null,
      parsedStudents: [],
      previewList: [],
      isUploading: false,
      manualName: '',
      manualPhone: '',
      isAdding: false
    }
  },

  methods: {
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
        const fileData = wx.getFileSystemManager().readFileSync(filePath)
        const workbook = XLSX.read(fileData, { type: 'array' })
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

        if (!nameKey || !phoneKey) {
          uni.hideLoading()
          uni.showModal({
            title: '格式不正确',
            content: `未找到"姓名"或"手机号"列。检测到的列名：${keys.join('、')}`,
            showCancel: false
          })
          return
        }

        const students = data
          .map(row => ({
            name: (row[nameKey] || '').toString().trim(),
            phone: (row[phoneKey] || '').toString().trim()
          }))
          .filter(s => s.name && s.phone)

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
      if (!this.manualPhone.trim() || this.manualPhone.length !== 11) {
        uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
        return
      }

      this.isAdding = true

      try {
        const res = await wx.cloud.callFunction({
          name: 'uploadStudents',
          data: {
            students: [{ name: this.manualName.trim(), phone: this.manualPhone.trim() }]
          }
        })

        if (res.result.success) {
          uni.showToast({ title: '添加成功', icon: 'success' })
          this.manualName = ''
          this.manualPhone = ''
        } else {
          uni.showToast({ title: res.result.message || '添加失败', icon: 'none' })
        }
      } catch (err) {
        console.error(err)
        uni.showToast({ title: '添加失败', icon: 'none' })
      }

      this.isAdding = false
    },

    resetAllCheckIn() {
      uni.showModal({
        title: '确认重置',
        content: '将所有学生的签到状态重置为"未签到"，确定继续？',
        success: async (res) => {
          if (res.confirm) {
            uni.showLoading({ title: '重置中...' })
            try {
              const db = wx.cloud.database()
              const result = await db.collection('students')
                .where({ checkedIn: true }).get()

              for (const student of result.data) {
                await db.collection('students').doc(student._id).update({
                  data: {
                    checkedIn: false,
                    checkInTime: null,
                    updateTime: db.serverDate()
                  }
                })
              }

              uni.hideLoading()
              uni.showToast({ title: '重置成功', icon: 'success' })
            } catch (err) {
              uni.hideLoading()
              console.error(err)
              uni.showToast({ title: '重置失败', icon: 'none' })
            }
          }
        }
      })
    },

    clearAllStudents() {
      uni.showModal({
        title: '危险操作',
        content: '将删除所有学生数据，此操作不可恢复！确定继续？',
        confirmColor: '#FF4B4B',
        success: async (res) => {
          if (res.confirm) {
            uni.showLoading({ title: '删除中...' })
            try {
              const db = wx.cloud.database()
              const result = await db.collection('students').get()

              for (const student of result.data) {
                await db.collection('students').doc(student._id).remove()
              }

              uni.hideLoading()
              uni.showToast({ title: '已清空', icon: 'success' })
            } catch (err) {
              uni.hideLoading()
              console.error(err)
              uni.showToast({ title: '删除失败', icon: 'none' })
            }
          }
        }
      })
    }
  }
}
</script>

<style scoped>
.input-placeholder {
  color: #CDCDCD;
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
  color: #3c3c3c;
  display: block;
  margin-bottom: 8rpx;
}

.card-desc {
  font-size: 26rpx;
  color: #AFAFAF;
  font-weight: 500;
  display: block;
  margin-bottom: 28rpx;
}

/* 上传区域 */
.upload-zone {
  border: 4rpx dashed #CDCDCD;
  border-radius: 24rpx;
  padding: 56rpx 32rpx;
  text-align: center;
  background: #f7f7f7;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
}

.upload-zone-active {
  background: #E5E5E5;
  border-color: #1CB0F6;
}

.upload-big-icon { font-size: 72rpx; }

.upload-main-text {
  font-size: 32rpx;
  color: #1CB0F6;
  font-weight: 700;
}

.upload-sub-text {
  font-size: 24rpx;
  color: #CDCDCD;
}

/* 文件标签 */
.file-tag {
  margin-top: 20rpx;
  padding: 20rpx 24rpx;
  background: #DDF4FF;
  border-radius: 16rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 4rpx solid #1CB0F6;
}

.file-tag-name {
  font-size: 28rpx;
  color: #1CB0F6;
  font-weight: 700;
}

.file-tag-size {
  font-size: 24rpx;
  color: #AFAFAF;
}

/* 预览表格 */
.preview-area { margin-top: 32rpx; }

.preview-heading {
  font-size: 28rpx;
  font-weight: 700;
  color: #3c3c3c;
  margin-bottom: 16rpx;
  display: block;
}

.preview-tbl {
  border: 4rpx solid #E5E5E5;
  border-radius: 16rpx;
  overflow: hidden;
  margin-bottom: 20rpx;
}

.preview-tbl-head {
  display: flex;
  background: #f7f7f7;
  padding: 18rpx 16rpx;
  font-weight: 700;
  font-size: 26rpx;
  color: #AFAFAF;
}

.preview-tbl-row {
  display: flex;
  padding: 18rpx 16rpx;
  border-top: 2rpx solid #E5E5E5;
  font-size: 26rpx;
}

.preview-cell {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-idx { width: 60rpx; flex-shrink: 0; color: #AFAFAF; }
.cell-name { flex: 1; min-width: 0; font-weight: 600; }
.cell-phone { width: 240rpx; flex-shrink: 0; text-align: right; color: #777; }

.preview-tbl-more {
  text-align: center;
  padding: 16rpx;
  color: #AFAFAF;
  font-size: 24rpx;
  border-top: 2rpx solid #E5E5E5;
}

/* 危险按钮 */
.btn-danger {
  background: #fff;
  color: #FF4B4B;
  border: 4rpx solid #FF4B4B;
  border-radius: 24rpx;
  padding: 26rpx 0;
  font-size: 34rpx;
  font-weight: 700;
  text-align: center;
  width: 100%;
  margin-top: 20rpx;
  box-shadow: 0 8rpx 0 #FFD4D4;
  position: relative;
  top: 0;
}

.btn-danger:active {
  top: 6rpx;
  box-shadow: 0 2rpx 0 #FFD4D4;
}
</style>
