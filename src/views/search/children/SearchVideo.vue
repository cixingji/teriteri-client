<template>
  <div class="search-video">
    <div class="search-page i_wrapper">
      <div class="search-toolbar">
        <div class="sort-group">
          <button
            v-for="option in sortOptions"
            :key="option.value"
            :class="{ active: sort === option.value }"
            @click="changeSort(option.value)"
          >{{ option.label }}</button>
        </div>
        <div class="category-filters">
          <el-select v-model="mcId" placeholder="全部分区" clearable @change="changeMainCategory">
            <el-option
              v-for="channel in channels"
              :key="channel.mcId"
              :label="channel.mcName"
              :value="channel.mcId"
            />
          </el-select>
          <el-select
            v-model="scId"
            placeholder="全部子分区"
            clearable
            :disabled="!mcId"
            @change="filtersChanged"
          >
            <el-option
              v-for="channel in subChannels"
              :key="channel.scId"
              :label="channel.scName"
              :value="channel.scId"
            />
          </el-select>
        </div>
      </div>

      <div v-if="!loading && videoList.length === 0" class="empty-result">
        没有找到符合条件的视频
      </div>

      <div class="container">
        <div class="video-card" v-for="item in videoList" :key="item.video.vid">
          <div class="video-card__wrap">
            <a :href="`/video/${item.video.vid}`" target="_blank">
              <div class="video-card__image">
                <div class="video-card__image--wrap">
                  <picture class="video-card__cover">
                    <img :src="item.video.coverUrl" :alt="item.video.title">
                  </picture>
                </div>
                <div class="video-card__mask">
                  <div class="video-card__stats">
                    <div class="video-card__stats--left">
                      <span class="video-card__stats--item">
                        <i class="iconfont icon-bofangshu"></i>
                        <span class="video-card__stats--text">{{ handleNum(item.stats.play) }}</span>
                      </span>
                      <span class="video-card__stats--item">
                        <i class="iconfont icon-danmushu"></i>
                        <span class="video-card__stats--text">{{ handleNum(item.stats.danmu) }}</span>
                      </span>
                    </div>
                    <div class="video-card__stats__duration">{{ handleDuration(item.video.duration) }}</div>
                  </div>
                </div>
              </div>
            </a>
            <div class="video-card__info">
              <div class="video-card__info--right">
                <h3 class="video-card__info--tit">
                  <a
                    :href="`/video/${item.video.vid}`"
                    target="_blank"
                    :title="item.video.title"
                    v-html="highlight(item, 'title', item.video.title)"
                  ></a>
                </h3>
                <p class="video-description" v-html="highlight(item, 'descr', item.video.descr)"></p>
                <div class="matched-meta">
                  <span v-html="highlight(item, 'mcName', item.category?.mcName)"></span>
                  <span>·</span>
                  <span v-html="highlight(item, 'scName', item.category?.scName)"></span>
                </div>
                <div class="video-card__info--bottom">
                  <a class="video-card__info--owner" :href="`/space/${item.user.uid}`" target="_blank">
                    <i class="iconfont icon-uper"></i>
                    <span
                      class="video-card__info--author"
                      v-html="highlight(item, 'uploaderName', item.user.nickname)"
                    ></span>
                    <span class="video-card__info--date">· {{ handleDate(item.video.uploadDate) }}</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="video-card" v-for="index in 30" :key="`loading-${index}`" v-show="loading">
          <div class="video-card__skeleton loading_animation">
            <div class="video-card__skeleton--cover"></div>
            <div class="video-card__skeleton--info">
              <div class="video-card__skeleton--right">
                <p class="video-card__skeleton--text"></p>
                <p class="video-card__skeleton--text short"></p>
                <p class="video-card__skeleton--light"></p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="search-bottom flex_center" v-if="total > pageSize">
        <el-pagination
          background
          layout="prev, pager, next"
          :total="total"
          :page-size="pageSize"
          :pager-count="7"
          :current-page="page"
          @current-change="pageChange"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { ElMessage } from 'element-plus';
import { handleTime, handleNum, handleDate } from '@/utils/utils.js';

export default {
  name: 'SearchVideo',
  props: { keyword: String },
  data() {
    return {
      page: 1,
      pageSize: 30,
      total: 0,
      videoList: [],
      loading: true,
      sort: 'relevance',
      mcId: '',
      scId: '',
      sortOptions: [
        { label: '综合排序', value: 'relevance' },
        { label: '最新发布', value: 'latest' },
        { label: '最多播放', value: 'play' },
        { label: '最多点赞', value: 'likes' },
      ],
    };
  },
  computed: {
    channels() {
      return this.$store.state.channels || [];
    },
    subChannels() {
      return this.channels.find(item => item.mcId === this.mcId)?.scList || [];
    },
  },
  methods: {
    async searchVideos() {
      this.videoList = [];
      this.loading = true;
      try {
        const response = await this.$get('/search/videos', {
          params: {
            keyword: this.keyword,
            page: this.page,
            size: this.pageSize,
            sort: this.sort,
            mcId: this.mcId || undefined,
            scId: this.scId || undefined,
          },
        });
        const data = response.data?.data;
        this.videoList = data?.records || [];
        this.total = data?.total || 0;
        const matching = [...this.$store.state.matchingCount];
        matching[0] = this.total;
        this.$store.commit('updateMatchingCount', matching);
      } catch (error) {
        this.total = 0;
        ElMessage.error(error.response?.data?.message || '视频搜索失败');
      } finally {
        this.loading = false;
      }
    },
    changeSort(value) {
      if (this.sort === value) return;
      this.sort = value;
      this.filtersChanged();
    },
    changeMainCategory() {
      this.scId = '';
      this.filtersChanged();
    },
    filtersChanged() {
      this.page = 1;
      this.syncRoute();
      this.searchVideos();
    },
    syncRoute() {
      this.$router.replace({
        path: '/search/video',
        query: {
          keyword: this.keyword,
          sort: this.sort === 'relevance' ? undefined : this.sort,
          mcId: this.mcId || undefined,
          scId: this.scId || undefined,
        },
      });
    },
    pageChange(page) {
      this.page = page;
      this.searchVideos();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    handleDuration: handleTime,
    handleNum,
    handleDate,
    highlight(item, field, fallback) {
      const fragments = item.highlight?.[field];
      return fragments?.[0] || this.escapeHtml(fallback || '');
    },
    escapeHtml(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },
    initializeFilters() {
      const allowedSorts = this.sortOptions.map(item => item.value);
      this.sort = allowedSorts.includes(this.$route.query.sort) ? this.$route.query.sort : 'relevance';
      this.mcId = this.$route.query.mcId || '';
      this.scId = this.$route.query.scId || '';
    },
  },
  created() {
    this.initializeFilters();
    if (this.keyword) this.searchVideos();
  },
  watch: {
    keyword(current) {
      if (current) {
        this.page = 1;
        this.searchVideos();
      }
    },
  },
};
</script>

<style scoped>
.search-page { padding-bottom: 30px !important; margin-top: 24px !important; position: relative; }
.search-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 24px; }
.sort-group { display: flex; gap: 8px; flex-wrap: wrap; }
.sort-group button { border: 0; padding: 8px 14px; border-radius: 16px; color: var(--text2); background: var(--bg2); cursor: pointer; }
.sort-group button.active { color: #fff; background: var(--brand_pink); }
.category-filters { display: flex; gap: 10px; }
.category-filters .el-select { width: 150px; }
.container { grid-gap: 20px; display: grid; position: relative; width: 100%; }
.video-description { height: 36px; margin: 6px 0; overflow: hidden; color: var(--text3); font-size: 12px; line-height: 18px; }
.matched-meta { display: flex; gap: 5px; min-height: 18px; color: var(--text3); font-size: 12px; }
.empty-result { padding: 100px 0; text-align: center; color: var(--text3); }
:deep(mark) { padding: 0; color: var(--brand_pink); background: transparent; font-weight: 600; }
.search-bottom { margin: 50px 0 20px; }
@media (max-width: 1399.9px) { .container { grid-template-columns: repeat(4, 1fr); } }
@media (min-width: 1400px) { .container { grid-template-columns: repeat(5, 1fr); } }
@media (min-width: 1700px) { .container { grid-template-columns: repeat(6, 1fr); } }
@media (min-width: 2200px) { .container { grid-template-columns: repeat(7, 1fr); } }
@media (max-width: 900px) {
  .search-toolbar { align-items: flex-start; flex-direction: column; }
  .category-filters { width: 100%; }
  .category-filters .el-select { flex: 1; }
}
</style>
