"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  data() {
    return {
      showTeacherAuth: false,
      authPassword: "",
      authLoading: false
    };
  },
  methods: {
    goStudent() {
      common_vendor.index.navigateTo({ url: "/pages/student/student" });
    },
    async goTeacher() {
      common_vendor.index.showLoading({ title: "验证身份..." });
      try {
        const res = await common_vendor.wx$1.cloud.callFunction({ name: "getRole" });
        common_vendor.index.hideLoading();
        const r = res && res.result ? res.result : {};
        if (r.success && r.role === "teacher") {
          common_vendor.index.setStorageSync("role", "teacher");
          common_vendor.index.setStorageSync("openid", r.openid);
          common_vendor.index.navigateTo({ url: "/pages/teacher/teacher" });
        } else {
          this.showTeacherAuth = true;
        }
      } catch (err) {
        common_vendor.index.hideLoading();
        common_vendor.index.__f__("error", "at pages/index/index.vue:92", err);
        common_vendor.index.showToast({ title: "网络错误，请重试", icon: "none" });
      }
    },
    closeAuth() {
      this.showTeacherAuth = false;
      this.authPassword = "";
    },
    async submitClaim() {
      if (!this.authPassword.trim()) {
        common_vendor.index.showToast({ title: "请输入密码", icon: "none" });
        return;
      }
      this.authLoading = true;
      try {
        const res = await common_vendor.wx$1.cloud.callFunction({
          name: "claimTeacher",
          data: { password: this.authPassword.trim() }
        });
        const r = res && res.result ? res.result : {};
        if (r.success) {
          common_vendor.index.setStorageSync("role", "teacher");
          common_vendor.index.setStorageSync("openid", r.openid);
          common_vendor.index.showToast({ title: "验证成功", icon: "success" });
          setTimeout(() => {
            this.showTeacherAuth = false;
            this.authPassword = "";
            this.authLoading = false;
            common_vendor.index.navigateTo({ url: "/pages/teacher/teacher" });
          }, 600);
        } else {
          this.authLoading = false;
          common_vendor.index.showToast({ title: r.message || "验证失败", icon: "none" });
        }
      } catch (err) {
        this.authLoading = false;
        common_vendor.index.__f__("error", "at pages/index/index.vue:128", err);
        common_vendor.index.showToast({ title: "网络错误，请重试", icon: "none" });
      }
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_vendor.o((...args) => $options.goStudent && $options.goStudent(...args), "bb"),
    b: common_vendor.o((...args) => $options.goTeacher && $options.goTeacher(...args), "c7"),
    c: $data.showTeacherAuth
  }, $data.showTeacherAuth ? {
    d: $data.authPassword,
    e: common_vendor.o(($event) => $data.authPassword = $event.detail.value, "41"),
    f: common_vendor.t($data.authLoading ? "验证中..." : "确认"),
    g: common_vendor.o((...args) => $options.submitClaim && $options.submitClaim(...args), "77"),
    h: $data.authLoading,
    i: common_vendor.o((...args) => $options.closeAuth && $options.closeAuth(...args), "3f"),
    j: common_vendor.o(() => {
    }, "db"),
    k: common_vendor.o((...args) => $options.closeAuth && $options.closeAuth(...args), "1f")
  } : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-1cf27b2a"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/index/index.js.map
