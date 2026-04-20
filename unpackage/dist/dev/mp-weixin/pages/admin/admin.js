"use strict";
const common_vendor = require("../../common/vendor.js");
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
  async onShow() {
    const ok = await this.ensureTeacher();
    if (!ok)
      return;
  },
  methods: {
    async ensureTeacher() {
      let role = common_vendor.index.getStorageSync("role");
      if (role !== "teacher") {
        try {
          const res = await common_vendor.wx$1.cloud.callFunction({ name: "getRole" });
          const r = res && res.result ? res.result : {};
          role = r.role;
          if (role === "teacher")
            common_vendor.index.setStorageSync("role", "teacher");
        } catch (err) {
          common_vendor.index.__f__("error", "at pages/admin/admin.vue:122", err);
        }
      }
      if (role !== "teacher") {
        common_vendor.index.showModal({
          title: "无权限",
          content: "管理后台仅限授权教师访问",
          showCancel: false,
          success: () => {
            common_vendor.index.reLaunch({ url: "/pages/index/index" });
          }
        });
        return false;
      }
      return true;
    },
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
        const raw = common_vendor.wx$1.getFileSystemManager().readFileSync(filePath);
        const data8 = raw instanceof ArrayBuffer ? new Uint8Array(raw) : new Uint8Array(raw.buffer || raw);
        const workbook = common_vendor.readSync(data8, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = common_vendor.utils.sheet_to_json(firstSheet, { defval: "" });
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
        common_vendor.index.__f__("error", "at pages/admin/admin.vue:217", "解析Excel失败:", err);
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
        common_vendor.index.__f__("error", "at pages/admin/admin.vue:249", "上传失败:", err);
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
        common_vendor.index.__f__("error", "at pages/admin/admin.vue:284", err);
        common_vendor.index.showToast({ title: "添加失败", icon: "none" });
      }
      this.isAdding = false;
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.o((...args) => $options.chooseExcel && $options.chooseExcel(...args), "71"),
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
    k: common_vendor.o((...args) => $options.uploadStudents && $options.uploadStudents(...args), "89"),
    l: $data.isUploading
  }) : {}, {
    m: $data.manualName,
    n: common_vendor.o(($event) => $data.manualName = $event.detail.value, "76"),
    o: $data.manualPhone,
    p: common_vendor.o(($event) => $data.manualPhone = $event.detail.value, "98"),
    q: common_vendor.t($data.isAdding ? "添加中..." : "添加学生"),
    r: common_vendor.o((...args) => $options.addManual && $options.addManual(...args), "a8"),
    s: $data.isAdding
  });
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-dbc77958"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/admin/admin.js.map
