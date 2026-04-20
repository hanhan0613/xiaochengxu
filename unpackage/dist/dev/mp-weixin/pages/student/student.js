"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_qrcode = require("../../utils/qrcode.js");
const _sfc_main = {
  data() {
    return {
      name: "",
      phone: "",
      isLoggedIn: false,
      isLoading: false,
      studentInfo: null,
      phoneDisplay: ""
    };
  },
  onShow() {
    const cached = common_vendor.index.getStorageSync("studentInfo");
    if (cached) {
      const phoneStr = cached.phone;
      this.isLoggedIn = true;
      this.studentInfo = cached;
      this.phoneDisplay = phoneStr.substring(0, 3) + "****" + phoneStr.substring(7);
      if (!cached.checkedIn) {
        setTimeout(() => {
          this.generateQRCode(cached._id);
        }, 300);
      }
      this.refreshStatus();
    }
  },
  methods: {
    async doLogin() {
      if (!this.name.trim()) {
        common_vendor.index.showToast({ title: "请输入姓名", icon: "none" });
        return;
      }
      if (!this.phone.trim() || this.phone.length !== 11) {
        common_vendor.index.showToast({ title: "请输入正确的手机号", icon: "none" });
        return;
      }
      this.isLoading = true;
      try {
        const res = await common_vendor.wx$1.cloud.callFunction({
          name: "login",
          data: { name: this.name.trim(), phone: this.phone.trim() }
        });
        const result = res && res.result ? res.result : {};
        if (result.success && result.student) {
          const student = result.student;
          const phoneStr = (student.phone || "").toString();
          this.isLoggedIn = true;
          this.studentInfo = student;
          this.phoneDisplay = phoneStr.length >= 11 ? phoneStr.substring(0, 3) + "****" + phoneStr.substring(7) : phoneStr;
          this.isLoading = false;
          common_vendor.index.setStorageSync("studentInfo", student);
          if (!student.checkedIn) {
            setTimeout(() => {
              this.generateQRCode(student._id);
            }, 300);
          }
        } else {
          const msg = result.message || "登录失败，请检查姓名和手机号是否正确";
          common_vendor.index.showToast({ title: msg, icon: "none", duration: 2e3 });
          this.isLoading = false;
        }
      } catch (err) {
        common_vendor.index.__f__("error", "at pages/student/student.vue:165", "登录失败:", err);
        const errMsg = err && err.errMsg ? err.errMsg : "网络错误，请重试";
        common_vendor.index.showToast({ title: errMsg, icon: "none", duration: 2e3 });
        this.isLoading = false;
      }
    },
    generateQRCode(studentId) {
      const query = common_vendor.index.createSelectorQuery().in(this);
      query.select("#qrCanvas").fields({ node: true, size: true }).exec((res) => {
        if (!res[0]) {
          common_vendor.index.__f__("error", "at pages/student/student.vue:178", "Canvas 未找到");
          return;
        }
        const canvas = res[0].node;
        const ctx = canvas.getContext("2d");
        const info = common_vendor.index.getWindowInfo();
        const dpr = info.pixelRatio;
        canvas.width = 500 * dpr;
        canvas.height = 500 * dpr;
        ctx.scale(dpr, dpr);
        const qrData = `CKIN|${studentId}|${Date.now()}`;
        utils_qrcode.QRCode.draw(qrData, canvas, ctx, 500);
      });
    },
    doLogout() {
      common_vendor.index.removeStorageSync("studentInfo");
      this.isLoggedIn = false;
      this.studentInfo = null;
      this.name = "";
      this.phone = "";
      this.phoneDisplay = "";
    },
    async refreshStatus() {
      if (!this.studentInfo)
        return;
      common_vendor.index.showLoading({ title: "刷新中..." });
      try {
        const res = await common_vendor.wx$1.cloud.callFunction({
          name: "login",
          data: { name: this.studentInfo.name, phone: this.studentInfo.phone }
        });
        if (res.result.success) {
          this.studentInfo = res.result.student;
          common_vendor.index.setStorageSync("studentInfo", res.result.student);
          if (!res.result.student.checkedIn) {
            setTimeout(() => {
              this.generateQRCode(res.result.student._id);
            }, 300);
          }
        }
      } catch (err) {
        common_vendor.index.__f__("error", "at pages/student/student.vue:226", err);
      }
      common_vendor.index.hideLoading();
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: !$data.isLoggedIn
  }, !$data.isLoggedIn ? {
    b: $data.name,
    c: common_vendor.o(($event) => $data.name = $event.detail.value, "76"),
    d: $data.phone,
    e: common_vendor.o(($event) => $data.phone = $event.detail.value, "9f"),
    f: common_vendor.t($data.isLoading ? "验证中..." : "生成签到二维码"),
    g: common_vendor.o((...args) => $options.doLogin && $options.doLogin(...args), "5e"),
    h: $data.isLoading
  } : {}, {
    i: $data.isLoggedIn
  }, $data.isLoggedIn ? common_vendor.e({
    j: $data.studentInfo && $data.studentInfo.checkedIn
  }, $data.studentInfo && $data.studentInfo.checkedIn ? {
    k: common_vendor.t($data.studentInfo.name),
    l: common_vendor.t($data.phoneDisplay)
  } : {
    m: common_vendor.t($data.studentInfo.name),
    n: common_vendor.t($data.studentInfo.name),
    o: common_vendor.t($data.phoneDisplay)
  }, {
    p: common_vendor.o((...args) => $options.refreshStatus && $options.refreshStatus(...args), "56"),
    q: common_vendor.o((...args) => $options.doLogout && $options.doLogout(...args), "69")
  }) : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-809c9d48"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/student/student.js.map
