"use strict";
const common_vendor = require("../../common/vendor.js");
const utils_qrcode = require("../../utils/qrcode.js");
const _sfc_main = {
  data() {
    return {
      name: "",
      phone: "",
      code: "",
      isLoggedIn: false,
      isLoading: false,
      studentInfo: null,
      phoneDisplay: "",
      agreed: false,
      showTermsModal: false,
      userTermsContent: [
        "欢迎使用本签到打卡小程序！请在使用前仔细阅读以下服务协议。",
        "",
        "一、服务内容",
        "本小程序为学生课堂签到打卡服务，提供学生端二维码生成、教师端扫码签到、签到历史查询等功能。",
        "",
        "二、用户行为规范",
        "1. 您应如实填写姓名、手机号和核验码，不得冒用他人身份。",
        "2. 请勿将签到二维码用于作弊、代签等违反学校规定的行为。",
        "3. 请勿对本小程序进行逆向工程、干扰正常服务。",
        "",
        "三、信息收集与使用",
        "1. 我们仅收集实现签到功能所必需的信息：姓名、手机号、核验码、微信账号标识（openid）。",
        "2. 上述信息仅用于签到业务，不会用于其他目的，也不会向第三方提供。",
        "3. 详细的个人信息处理规则请查阅《隐私政策》。",
        "",
        "四、服务变更与终止",
        "我们有权根据业务需要调整或终止部分服务，并会在小程序内公告。",
        "",
        "五、免责声明",
        "因不可抗力、网络故障等非开发者原因造成的服务中断，开发者不承担责任。",
        "",
        "六、联系方式",
        "如对本协议有疑问，请联系所在学校或任课教师。"
      ].join("\n")
    };
  },
  onShow() {
    const cached = common_vendor.index.getStorageSync("studentInfo");
    if (cached) {
      const phoneStr = (cached.phone || "").toString();
      this.isLoggedIn = true;
      this.studentInfo = cached;
      this.phoneDisplay = phoneStr.length >= 11 ? phoneStr.substring(0, 3) + "****" + phoneStr.substring(7) : phoneStr;
      if (!cached.checkedIn) {
        setTimeout(() => {
          this.generateQRCode(cached._id);
        }, 300);
      }
      this.refreshStatus();
    }
  },
  methods: {
    toggleAgree() {
      this.agreed = !this.agreed;
    },
    openUserTerms() {
      this.showTermsModal = true;
    },
    closeTermsModal() {
      this.showTermsModal = false;
    },
    openPrivacyContract() {
      if (typeof common_vendor.wx$1 === "undefined" || !common_vendor.wx$1.openPrivacyContract) {
        common_vendor.index.showToast({ title: "当前微信版本不支持，请升级", icon: "none" });
        return;
      }
      common_vendor.wx$1.openPrivacyContract({
        fail: () => {
          common_vendor.index.showToast({ title: "打开隐私政策失败", icon: "none" });
        }
      });
    },
    async doLogin() {
      if (!this.agreed) {
        common_vendor.index.showToast({ title: "请先勾选并同意协议", icon: "none" });
        return;
      }
      if (!this.name.trim()) {
        common_vendor.index.showToast({ title: "请输入姓名", icon: "none" });
        return;
      }
      if (!this.phone.trim()) {
        common_vendor.index.showToast({ title: "请输入手机号", icon: "none" });
        return;
      }
      if (!this.code.trim()) {
        common_vendor.index.showToast({ title: "请输入核验码", icon: "none" });
        return;
      }
      this.isLoading = true;
      try {
        const res = await common_vendor.wx$1.cloud.callFunction({
          name: "login",
          data: {
            name: this.name.trim(),
            phone: this.phone.trim(),
            code: this.code.trim()
          }
        });
        const result = res && res.result ? res.result : {};
        if (result.success && result.student) {
          const student = result.student;
          const phoneStr = (student.phone || "").toString();
          this.isLoggedIn = true;
          this.studentInfo = student;
          this.phoneDisplay = phoneStr.length >= 11 ? phoneStr.substring(0, 3) + "****" + phoneStr.substring(7) : phoneStr;
          this.isLoading = false;
          const toCache = Object.assign({}, student, { code: this.code.trim() });
          common_vendor.index.setStorageSync("studentInfo", toCache);
          this.studentInfo = toCache;
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
        common_vendor.index.__f__("error", "at pages/student/student.vue:274", "登录失败:", err);
        const errMsg = err && err.errMsg ? err.errMsg : "网络错误，请重试";
        common_vendor.index.showToast({ title: errMsg, icon: "none", duration: 2e3 });
        this.isLoading = false;
      }
    },
    generateQRCode(studentId) {
      const query = common_vendor.index.createSelectorQuery().in(this);
      query.select("#qrCanvas").fields({ node: true, size: true }).exec((res) => {
        if (!res[0]) {
          common_vendor.index.__f__("error", "at pages/student/student.vue:287", "Canvas 未找到");
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
      this.code = "";
      this.phoneDisplay = "";
    },
    async refreshStatus() {
      if (!this.studentInfo)
        return;
      common_vendor.index.showLoading({ title: "刷新中..." });
      try {
        const res = await common_vendor.wx$1.cloud.callFunction({
          name: "login",
          data: {
            name: this.studentInfo.name,
            phone: this.studentInfo.phone,
            code: this.studentInfo.code
          }
        });
        if (res.result.success) {
          const refreshed = Object.assign({}, res.result.student, { code: this.studentInfo.code });
          this.studentInfo = refreshed;
          common_vendor.index.setStorageSync("studentInfo", refreshed);
          if (!res.result.student.checkedIn) {
            setTimeout(() => {
              this.generateQRCode(res.result.student._id);
            }, 300);
          }
        }
      } catch (err) {
        common_vendor.index.__f__("error", "at pages/student/student.vue:341", err);
      }
      common_vendor.index.hideLoading();
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: !$data.isLoggedIn
  }, !$data.isLoggedIn ? common_vendor.e({
    b: $data.name,
    c: common_vendor.o(($event) => $data.name = $event.detail.value, "20"),
    d: $data.phone,
    e: common_vendor.o(($event) => $data.phone = $event.detail.value, "ea"),
    f: $data.code,
    g: common_vendor.o(($event) => $data.code = $event.detail.value, "f5"),
    h: $data.agreed
  }, $data.agreed ? {} : {}, {
    i: common_vendor.n({
      "agreement-box-checked": $data.agreed
    }),
    j: common_vendor.o((...args) => $options.openUserTerms && $options.openUserTerms(...args), "3c"),
    k: common_vendor.o((...args) => $options.openPrivacyContract && $options.openPrivacyContract(...args), "09"),
    l: common_vendor.o((...args) => $options.toggleAgree && $options.toggleAgree(...args), "a8"),
    m: common_vendor.t($data.isLoading ? "验证中..." : $data.agreed ? "生成签到二维码" : "请先勾选协议"),
    n: common_vendor.o((...args) => $options.doLogin && $options.doLogin(...args), "9c"),
    o: $data.isLoading || !$data.agreed
  }) : {}, {
    p: $data.showTermsModal
  }, $data.showTermsModal ? {
    q: common_vendor.t($data.userTermsContent),
    r: common_vendor.o((...args) => $options.closeTermsModal && $options.closeTermsModal(...args), "64"),
    s: common_vendor.o(() => {
    }, "da"),
    t: common_vendor.o((...args) => $options.closeTermsModal && $options.closeTermsModal(...args), "e8")
  } : {}, {
    v: $data.isLoggedIn
  }, $data.isLoggedIn ? common_vendor.e({
    w: $data.studentInfo && $data.studentInfo.checkedIn
  }, $data.studentInfo && $data.studentInfo.checkedIn ? {
    x: common_vendor.t($data.studentInfo.name),
    y: common_vendor.t($data.phoneDisplay)
  } : {
    z: common_vendor.t($data.studentInfo.name),
    A: common_vendor.t($data.studentInfo.name),
    B: common_vendor.t($data.phoneDisplay)
  }, {
    C: common_vendor.o((...args) => $options.refreshStatus && $options.refreshStatus(...args), "c3"),
    D: common_vendor.o((...args) => $options.doLogout && $options.doLogout(...args), "b6")
  }) : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-809c9d48"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/student/student.js.map
