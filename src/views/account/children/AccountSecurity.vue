<template>
  <div class="account-security">
    <div class="header"><span class="header-icon"></span><span>账号安全</span></div>

    <section class="security-card">
      <h3>{{ account.passwordInitialized ? '修改密码' : '设置登录密码' }}</h3>
      <el-input
        v-if="account.passwordInitialized"
        v-model="password"
        type="password"
        show-password
        placeholder="当前密码"
        maxlength="72"
      />
      <el-input v-model="newPassword" type="password" show-password placeholder="新密码" maxlength="72" />
      <el-input v-model="confirmPassword" type="password" show-password placeholder="确认新密码" maxlength="72" />
      <el-button type="primary" :loading="savingPassword" @click="savePassword">
        {{ account.passwordInitialized ? '修改密码' : '设置密码' }}
      </el-button>
    </section>

    <section class="security-card">
      <h3>GitHub 登录</h3>
      <p v-if="account.githubLinked">已绑定：{{ account.githubLogin || 'GitHub 账号' }}</p>
      <p v-else>绑定后可以直接使用 GitHub 登录芙影视界。</p>
      <el-button v-if="!account.githubLinked" @click="bindGithub">绑定 GitHub</el-button>
      <el-button v-else type="danger" plain @click="unbindGithub">解除绑定</el-button>
    </section>

    <section class="security-card sessions-card">
      <div class="session-heading">
        <div>
          <h3>登录设备</h3>
          <p>最多保留 10 台设备，刷新令牌连续 30 天未使用后过期。</p>
        </div>
        <el-button type="danger" plain @click="logoutAll">退出全部设备</el-button>
      </div>
      <el-empty v-if="!sessions.length" description="暂无登录设备" />
      <div v-for="session in sessions" :key="session.sessionId" class="session-row">
        <div>
          <strong>{{ session.deviceName }}</strong>
          <el-tag v-if="session.current" size="small" type="success">当前设备</el-tag>
          <div class="session-meta">
            {{ session.ipAddress }} · 最近活跃 {{ formatTime(session.lastActiveAt) }}
          </div>
        </div>
        <el-button size="small" type="danger" text @click="revokeSession(session)">下线</el-button>
      </div>
    </section>
  </div>
</template>

<script>
import axios from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';
import { clearAccessToken } from '@/network/auth';

export default {
  name: 'AccountSecurity',
  data() {
    return {
      account: { githubLinked: false, githubLogin: '', passwordInitialized: true },
      sessions: [],
      password: '',
      newPassword: '',
      confirmPassword: '',
      savingPassword: false,
    };
  },
  mounted() {
    this.loadSecurityData();
  },
  methods: {
    async loadSecurityData() {
      try {
        const [accountResponse, sessionsResponse] = await Promise.all([
          axios.get('/api/oauth/account/status'),
          axios.get('/api/auth/sessions'),
        ]);
        this.account = accountResponse.data.data;
        this.sessions = sessionsResponse.data.data || [];
      } catch (error) {
        ElMessage.error(error.response?.data?.message || '账号安全信息加载失败');
      }
    },
    async savePassword() {
      if (!this.newPassword || this.newPassword !== this.confirmPassword) {
        ElMessage.warning('两次输入的新密码不一致');
        return;
      }
      this.savingPassword = true;
      try {
        if (this.account.passwordInitialized) {
          const form = new URLSearchParams();
          form.append('pw', this.password);
          form.append('npw', this.newPassword);
          await axios.post('/api/user/password/update', form);
        } else {
          await axios.post('/api/user/password/set', { password: this.newPassword });
        }
        await ElMessageBox.alert('密码已更新，请重新登录。', '操作成功');
        this.finishLogout();
      } catch (error) {
        ElMessage.error(error.response?.data?.message || '密码更新失败');
      } finally {
        this.savingPassword = false;
      }
    },
    bindGithub() {
      window.location.href = '/api/oauth/github/bind';
    },
    async unbindGithub() {
      try {
        await ElMessageBox.confirm('解除绑定后将无法使用 GitHub 登录，确定继续吗？', '解除 GitHub 绑定');
        await axios.delete('/api/oauth/github/bind');
        ElMessage.success('GitHub 绑定已解除');
        await this.loadSecurityData();
      } catch (error) {
        if (error !== 'cancel') {
          ElMessage.error(error.response?.data?.message || '解除绑定失败');
        }
      }
    },
    async revokeSession(session) {
      try {
        await axios.delete(`/api/auth/sessions/${session.sessionId}`);
        if (session.current) {
          this.finishLogout();
          return;
        }
        this.sessions = this.sessions.filter(item => item.sessionId !== session.sessionId);
        ElMessage.success('设备已下线');
      } catch (error) {
        ElMessage.error(error.response?.data?.message || '设备下线失败');
      }
    },
    async logoutAll() {
      try {
        await ElMessageBox.confirm('这会退出包括当前设备在内的全部登录设备。', '退出全部设备');
        await axios.post('/api/auth/logout-all');
        this.finishLogout();
      } catch (error) {
        if (error !== 'cancel') {
          ElMessage.error(error.response?.data?.message || '退出失败');
        }
      }
    },
    finishLogout() {
      clearAccessToken();
      this.$store.commit('initData');
      if (this.$store.state.ws) this.$store.state.ws.close();
      this.$router.replace('/');
    },
    formatTime(timestamp) {
      return new Date(timestamp).toLocaleString();
    },
  },
};
</script>

<style scoped>
.account-security { padding-bottom: 36px; }
.header {
  height: 50px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding-left: 30px;
  color: #ff7da1;
  border-bottom: 1px solid #ddd;
}
.header-icon { width: 4px; height: 16px; border-radius: 4px; background: #ff7da1; }
.security-card {
  max-width: 720px;
  margin: 24px auto 0;
  padding: 22px;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  background: #fff;
}
.security-card h3 { margin: 0 0 14px; }
.security-card p { color: #909399; font-size: 13px; }
.security-card .el-input { display: block; width: 340px; margin-bottom: 12px; }
.session-heading, .session-row { display: flex; justify-content: space-between; align-items: center; }
.session-row { padding: 14px 0; border-top: 1px solid #ebeef5; }
.session-row strong { margin-right: 8px; }
.session-meta { margin-top: 5px; color: #909399; font-size: 12px; }
</style>
