"use strict";
const common_vendor = require("../../common/vendor.js");
const _sfc_main = {
  data() {
    return {
      sessions: [],
      isLoading: false,
      detailSession: null,
      rosterFilter: "all"
    };
  },
  computed: {
    checkedCount() {
      if (!this.detailSession)
        return 0;
      return this.detailSession.roster.filter((r) => r.checkedIn).length;
    },
    uncheckedCount() {
      if (!this.detailSession)
        return 0;
      return this.detailSession.roster.filter((r) => !r.checkedIn).length;
    },
    filteredRoster() {
      if (!this.detailSession)
        return [];
      const r = this.detailSession.roster;
      if (this.rosterFilter === "checked")
        return r.filter((x) => x.checkedIn);
      if (this.rosterFilter === "unchecked")
        return r.filter((x) => !x.checkedIn);
      return r;
    }
  },
  async onShow() {
    const ok = await this.ensureTeacher();
    if (!ok)
      return;
    this.loadSessions();
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
          common_vendor.index.__f__("error", "at pages/sessions/sessions.vue:180", err);
        }
      }
      if (role !== "teacher") {
        common_vendor.index.showModal({
          title: "无权限",
          content: "仅教师可查看历史记录",
          showCancel: false,
          success: () => common_vendor.index.reLaunch({ url: "/pages/index/index" })
        });
        return false;
      }
      return true;
    },
    async loadSessions() {
      if (this.isLoading)
        return;
      this.isLoading = true;
      try {
        const res = await common_vendor.wx$1.cloud.callFunction({
          name: "listSessions",
          data: { page: 1, pageSize: 50 }
        });
        const r = res && res.result ? res.result : {};
        if (r.success) {
          this.sessions = r.data || [];
        } else {
          common_vendor.index.showToast({ title: r.message || "加载失败", icon: "none" });
        }
      } catch (err) {
        common_vendor.index.__f__("error", "at pages/sessions/sessions.vue:209", err);
        common_vendor.index.showToast({ title: "加载失败", icon: "none" });
      }
      this.isLoading = false;
    },
    async openDetail(session) {
      common_vendor.index.showLoading({ title: "加载详情..." });
      try {
        const res = await common_vendor.wx$1.cloud.callFunction({
          name: "getSessionDetail",
          data: { sessionId: session._id }
        });
        common_vendor.index.hideLoading();
        const r = res && res.result ? res.result : {};
        if (r.success) {
          if (!r.roster && Array.isArray(r.checkins)) {
            r.roster = r.checkins.map((c) => ({
              _id: c.studentId,
              name: c.studentName,
              phone: c.studentPhone,
              checkedIn: true,
              checkInTime: c.checkInTime
            }));
          }
          this.rosterFilter = "all";
          this.detailSession = r;
        } else {
          common_vendor.index.showToast({ title: r.message || "加载失败", icon: "none" });
        }
      } catch (err) {
        common_vendor.index.hideLoading();
        common_vendor.index.__f__("error", "at pages/sessions/sessions.vue:242", err);
        common_vendor.index.showToast({ title: "加载失败", icon: "none" });
      }
    },
    closeDetail() {
      this.detailSession = null;
    },
    confirmDelete(session) {
      const isActive = session.status === "active";
      const content = isActive ? `此活动正在进行中。删除会清除所有签到记录并重置学生签到状态，不可恢复！确定？` : `将删除活动"${session.title}"及其所有签到记录，不可恢复。确定？`;
      common_vendor.index.showModal({
        title: isActive ? "删除进行中的活动" : "删除历史记录",
        content,
        confirmColor: "#EF4444",
        confirmText: "删除",
        success: async (res) => {
          if (!res.confirm)
            return;
          common_vendor.index.showLoading({ title: "删除中...", mask: true });
          try {
            const cloudRes = await common_vendor.wx$1.cloud.callFunction({
              name: "deleteSession",
              data: { sessionId: session._id }
            });
            common_vendor.index.hideLoading();
            const r = cloudRes && cloudRes.result ? cloudRes.result : {};
            if (r.success) {
              common_vendor.index.showToast({ title: "已删除", icon: "success" });
              this.sessions = this.sessions.filter((s) => s._id !== session._id);
            } else {
              common_vendor.index.showToast({ title: r.message || "删除失败", icon: "none" });
            }
          } catch (err) {
            common_vendor.index.hideLoading();
            common_vendor.index.__f__("error", "at pages/sessions/sessions.vue:281", err);
            common_vendor.index.showToast({ title: "网络错误", icon: "none" });
          }
        }
      });
    },
    formatDate(raw) {
      if (!raw)
        return "";
      const d = new Date(raw);
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const h = String(d.getHours()).padStart(2, "0");
      const mi = String(d.getMinutes()).padStart(2, "0");
      return `${d.getFullYear()}-${m}-${day} ${h}:${mi}`;
    },
    formatDateFull(raw) {
      return this.formatDate(raw);
    },
    formatTime(raw) {
      if (!raw)
        return "";
      const d = new Date(raw);
      const h = String(d.getHours()).padStart(2, "0");
      const mi = String(d.getMinutes()).padStart(2, "0");
      const s = String(d.getSeconds()).padStart(2, "0");
      return `${h}:${mi}:${s}`;
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: !$data.detailSession
  }, !$data.detailSession ? common_vendor.e({
    b: common_vendor.f($data.sessions, (item, k0, i0) => {
      return {
        a: common_vendor.n(item.status === "active" ? "dot-active" : "dot-ended"),
        b: common_vendor.t(item.title),
        c: common_vendor.o(($event) => $options.confirmDelete(item), item._id),
        d: common_vendor.o(($event) => $options.openDetail(item), item._id),
        e: common_vendor.t($options.formatDate(item.createdAt)),
        f: common_vendor.t(item.status === "active" ? "进行中" : "已结束"),
        g: common_vendor.o(($event) => $options.openDetail(item), item._id),
        h: common_vendor.t(item.checkedCount),
        i: common_vendor.t(item.totalStudents),
        j: common_vendor.t(item.attendanceRate),
        k: common_vendor.o(($event) => $options.openDetail(item), item._id),
        l: item.attendanceRate + "%",
        m: common_vendor.o(($event) => $options.openDetail(item), item._id),
        n: item._id
      };
    }),
    c: $data.sessions.length === 0 && !$data.isLoading
  }, $data.sessions.length === 0 && !$data.isLoading ? {} : {}) : common_vendor.e({
    d: common_vendor.o((...args) => $options.closeDetail && $options.closeDetail(...args), "ee"),
    e: common_vendor.t($data.detailSession.session.title),
    f: common_vendor.t($options.formatDateFull($data.detailSession.session.createdAt)),
    g: $data.detailSession.session.endedAt
  }, $data.detailSession.session.endedAt ? {
    h: common_vendor.t($options.formatDateFull($data.detailSession.session.endedAt))
  } : {}, {
    i: common_vendor.t($data.detailSession.session.status === "active" ? "进行中" : "已结束"),
    j: common_vendor.t($data.detailSession.session.checkedCount),
    k: common_vendor.t($data.detailSession.session.totalStudents),
    l: common_vendor.t($data.detailSession.session.attendanceRate),
    m: common_vendor.t($data.detailSession.roster.length),
    n: common_vendor.n($data.rosterFilter === "all" ? "pill-active" : ""),
    o: common_vendor.o(($event) => $data.rosterFilter = "all", "a2"),
    p: common_vendor.t($options.checkedCount),
    q: common_vendor.n($data.rosterFilter === "checked" ? "pill-active" : ""),
    r: common_vendor.o(($event) => $data.rosterFilter = "checked", "b8"),
    s: common_vendor.t($options.uncheckedCount),
    t: common_vendor.n($data.rosterFilter === "unchecked" ? "pill-active" : ""),
    v: common_vendor.o(($event) => $data.rosterFilter = "unchecked", "0b"),
    w: common_vendor.f($options.filteredRoster, (item, idx, i0) => {
      return common_vendor.e({
        a: common_vendor.t(idx + 1),
        b: common_vendor.t(item.name.charAt(0)),
        c: common_vendor.n(item.checkedIn ? "avatar-on" : "avatar-off"),
        d: common_vendor.t(item.name),
        e: common_vendor.t(item.phone),
        f: common_vendor.t(item.checkedIn ? "已签到" : "未签到"),
        g: common_vendor.n(item.checkedIn ? "tag-checked" : "tag-unchecked"),
        h: item.checkedIn && item.checkInTime
      }, item.checkedIn && item.checkInTime ? {
        i: common_vendor.t($options.formatTime(item.checkInTime))
      } : {}, {
        j: common_vendor.n(!item.checkedIn ? "roster-item-miss" : ""),
        k: item._id
      });
    }),
    x: $options.filteredRoster.length === 0
  }, $options.filteredRoster.length === 0 ? {} : {}));
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-9437a25b"]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/sessions/sessions.js.map
