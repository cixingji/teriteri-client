<template>
  <div class="oauth-callback">
    <el-icon class="is-loading"><Loading /></el-icon>
    <p>{{ message }}</p>
  </div>
</template>

<script>
import { ElMessage } from 'element-plus';
import { refreshAccessToken } from '@/network/auth';

export default {
  name: 'OAuthCallback',
  data() {
    return { message: '正在完成 GitHub 登录…' };
  },
  async mounted() {
    const result = this.$route.query.github;
    if (result === 'bound') {
      ElMessage.success('GitHub 账号绑定成功');
      this.$router.replace('/account/security');
      return;
    }
    if (result !== 'success') {
      this.message = 'GitHub 登录失败，请返回后重试';
      ElMessage.error(this.message);
      return;
    }
    try {
      await refreshAccessToken();
      await this.$store.dispatch('getPersonalInfo');
      ElMessage.success('GitHub 登录成功');
      this.$router.replace('/');
    } catch (error) {
      this.message = '登录会话创建失败，请返回后重试';
      ElMessage.error(this.message);
    }
  },
};
</script>

<style scoped>
.oauth-callback {
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--text2);
}
.oauth-callback .el-icon { font-size: 36px; color: var(--brand_pink); }
</style>
