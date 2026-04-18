"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_xlsx_mini = require("../../utils/xlsx.mini.js");
const _sfc_main = {
  data() {
    return {
      selectedFile: null,
      parsedStudents: [],
      previewList: [],
      isUploading: false,
      manualName: "",
      manualPhone: "",
      isAdding: false
    };
  },
  methods: {
    chooseExcel() {
      common_vendor.wx$1.chooseMessageFile({
        count: 1,
        type: "file",
        extension: ["xlsx", "xls"],
        success: (res) => {
          const file = res.tempFiles[0];
          const sizeKB = (file.size / 1024).toFixed(1);
          this.selectedFile = {
            path: file.path,
            name: file.name,
            size: file.size,
            sizeStr: sizeKB + " KB"
          };
          this.parseExcel(file.path);
        },
        fail: (err) => {
          if (err.errMsg.indexOf("cancel") === -1) {
            common_vendor.index.showToast({ title: "选择文件失败", icon: "none" });
          }
        }
      });
    },
    parseExcel(filePath) {
      common_vendor.index.showLoading({ title: "解析中..." });
      try {
        const fileData = common_vendor.wx$1.getFileSystemManager().readFileSync(filePath);
        const workbook = utils_xlsx_mini.XLSX.read(fileData, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = utils_xlsx_mini.XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
        if (data.length === 0) {
          common_vendor.index.hideLoading();
          common_vendor.index.showToast({ title: "Excel文件为空", icon: "none" });
          return;
        }
        const firstRow = data[0];
        const keys = Object.keys(firstRow);
        let nameKey = keys.find(
          (k) => k.includes("姓名") || k.includes("名字") || k.toLowerCase() === "name"
        );
        let phoneKey = keys.find(
          (k) => k.includes("手机") || k.includes("电话") || k.includes("号码") || k.toLowerCase() === "phone" || k.toLowerCase() === "tel"
        );
        if (!nameKey || !phoneKey) {
          common_vendor.index.hideLoading();
          common_vendor.index.showModal({
            title: "格式不正确",
            content: `未找到"姓名"或"手机号"列。检测到的列名：${keys.join("、")}`,
            showCancel: false
          });
          return;
        }
        const students = data.map((row) => ({
          name: (row[nameKey] || "").toString().trim(),
          phone: (row[phoneKey] || "").toString().trim()
        })).filter((s) => s.name && s.phone);
        this.parsedStudents = students;
        this.previewList = students.slice(0, 5);
        common_vendor.index.hideLoading();
        common_vendor.index.showToast({ title: `解析到 ${students.length} 条数据`, icon: "success" });
      } catch (err) {
        common_vendor.index.hideLoading();
        common_vendor.index.__f__("error", "at pages/admin/admin.vue:184", "解析Excel失败:", err);
        common_vendor.index.showToast({ title: "解析失败，请检查文件格式", icon: "none", duration: 2e3 });
      }
    },
    async uploadStudents() {
      if (this.parsedStudents.length === 0)
        return;
      this.isUploading = true;
      common_vendor.index.showLoading({ title: "上传中...", mask: true });
      try {
        const res = await common_vendor.wx$1.cloud.callFunction({
          name: "uploadStudents",
          data: { students: this.parsedStudents }
        });
        common_vendor.index.hideLoading();
        if (res.result.success) {
          common_vendor.index.showModal({
            title: "上传成功",
            content: res.result.message,
            showCancel: false
          });
          this.parsedStudents = [];
          this.previewList = [];
          this.selectedFile = null;
        } else {
          common_vendor.index.showToast({ title: res.result.message || "上传失败", icon: "none" });
        }
      } catch (err) {
        common_vendor.index.hideLoading();
        common_vendor.index.__f__("error", "at pages/admin/admin.vue:216", "上传失败:", err);
        common_vendor.index.showToast({ title: "上传失败，请重试", icon: "none" });
      }
      this.isUploading = false;
    },
    async addManual() {
      if (!this.manualName.trim()) {
        common_vendor.index.showToast({ title: "请输入姓名", icon: "none" });
        return;
      }
      if (!this.manualPhone.trim() || this.manualPhone.length !== 11) {
        common_vendor.index.showToast({ title: "请输入正确的手机号", icon: "none" });
        return;
      }
      this.isAdding = true;
      try {
        const res = await common_vendor.wx$1.cloud.callFunction({
          name: "uploadStudents",
          data: {
            students: [{ name: this.manualName.trim(), phone: this.manualPhone.trim() }]
          }
        });
        if (res.result.success) {
          common_vendor.index.showToast({ title: "添加成功", icon: "success" });
          this.manualName = "";
          this.manualPhone = "";
        } else {
          common_vendor.index.showToast({ title: res.result.message || "添加失败", icon: "none" });
        }
      } catch (err) {
        common_vendor.index.__f__("error", "at pages/admin/admin.vue:251", err);
        common_vendor.index.showToast({ title: "添加失败", icon: "none" });
      }
      this.isAdding = false;
    },
    resetAllCheckIn() {
      common_vendor.index.showModal({
        title: "确认重置",
        content: '将所有学生的签到状态重置为"未签到"，确定继续？',
        success: async (res) => {
          if (res.confirm) {
            common_vendor.index.showLoading({ title: "重置中..." });
            try {
              const db = common_vendor.wx$1.cloud.database();
              const result = await db.collection("students").where({ checkedIn: true }).get();
              for (const student of result.data) {
                await db.collection("students").doc(student._id).update({
                  data: {
                    checkedIn: false,
                    checkInTime: null,
                    updateTime: db.serverDate()
                  }
                });
              }
              common_vendor.index.hideLoading();
              common_vendor.index.showToast({ title: "重置成功", icon: "success" });
            } catch (err) {
              common_vendor.index.hideLoading();
              common_vendor.index.__f__("error", "at pages/admin/admin.vue:284", err);
              common_vendor.index.showToast({ title: "重置失败", icon: "none" });
            }
          }
        }
      });
    },
    clearAllStudents() {
      common_vendor.index.showModal({
        title: "危险操作",
        content: "将删除所有学生数据，此操作不可恢复！确定继续？",
        confirmColor: "#FF4B4B",
        success: async (res) => {
          if (res.confirm) {
            common_vendor.index.showLoading({ title: "删除中..." });
            try {
              const db = common_vendor.wx$1.cloud.database();
              const result = await db.collection("students").get();
              for (const student of result.data) {
                await db.collection("students").doc(student._id).remove();
              }
              common_vendor.index.hideLoading();
              common_vendor.index.showToast({ title: "已清空", icon: "success" });
            } catch (err) {
              common_vendor.index.hideLoading();
              common_vendor.index.__f__("error", "at pages/admin/admin.vue:312", err);
              common_vendor.index.showToast({ title: "删除失败", icon: "none" });
            }
          }
        }
      });
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.o((...args) => $options.chooseExcel && $options.chooseExcel(...args), "b5"),
    b: $data.selectedFile
  }, $data.selectedFile ? {
    c: common_vendor.t($data.selectedFile.name),
    d: common_vendor.t($data.selectedFile.sizeStr)
  } : {}, {
    e: $data.parsedStudents.length > 0
  }, $data.parsedStudents.length > 0 ? common_vendor.e({
    f: common_vendor.t($data.parsedStudents.length),
    g: common_vendor.f($data.previewList, (item, index, i0) => {
      return {
        a: common_vendor.t(index + 1),
        b: common_vendor.t(item.name),
        c: common_vendor.t(item.phone),
        d: index
      };
    }),
    h: $data.parsedStudents.length > 5
  }, $data.parsedStudents.length > 5 ? {
    i: common_vendor.t($data.parsedStudents.length)
  } : {}, {
    j: common_vendor.t($data.isUploading ? "上传中..." : "确认上传"),
    k: common_vendor.o((...args) => $options.uploadStudents && $options.uploadStudents(...args), "ac"),
    l: $data.isUploading
  }) : {}, {
    m: $data.manualName,
    n: common_vendor.o(($event) => $data.manualName = $event.detail.value, "26"),
    o: $data.manualPhone,
    p: common_vendor.o(($event) => $data.manualPhone = $event.detail.value, "67"),
    q: common_vendor.t($data.isAdding ? "添加中..." : "添加学生"),
    r: common_vendor.o((...args) => $options.addManual && $options.addManual(...args), "0b"),
    s: $data.isAdding,
    t: common_vendor.o((...args) => $options.resetAllCheckIn && $options.resetAllCheckIn(...args), "01"),
    v: common_vendor.o((...args) => $options.clearAllStudents && $options.clearAllStudents(...args), "84")
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-dbc77958"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/admin/admin.js.map
