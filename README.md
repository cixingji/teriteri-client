# 芙影视界平台客户端

芙影视界客户端是一个基于 Vue 3 的视频社区 Web 应用，面向普通用户提供视频浏览、搜索、播放、互动和个人空间等功能。

## 关联仓库

- [后端服务](https://github.com/cixingji/teriteri-backend)
- [管理端](https://github.com/cixingji/teriteri-admin)

## 技术栈

- Vue 3
- Vue Router
- Vuex
- Element Plus
- Axios
- video.js / HLS 播放能力

## 主要功能

- 首页推荐与视频浏览
- 用户注册、登录和个人资料
- 视频搜索、分区筛选和排序
- 视频播放、弹幕、评论、点赞、收藏和投币
- 创作中心与视频分片上传
- 用户空间、投稿记录和收藏夹
- 私信与实时消息
- 播放历史和播放统计交互

## 本地运行

### 环境要求

- Node.js 16+
- npm 8+
- 已启动并正确配置的后端服务

### 安装依赖

```bash
npm install
```

### 开发启动

```bash
npm run serve
```

开发环境代理地址请根据后端端口修改 `.env.development` 或 `vue.config.js`。前端、后端和管理端应使用同一版本的接口约定。

### 生产构建

```bash
npm run build
```

生产环境配置位于 `.env.production`，部署前请检查 API 地址、媒体访问地址和 WebSocket 地址。

## 目录结构

```text
src/                 页面、组件、路由和状态管理
public/              静态资源
src/assets/          图片、样式和前端资源
.env.development     开发环境配置
.env.production      生产环境配置
```

## 项目声明

本项目由 `cixingji` 维护，主要用于学习、工程实践和技术交流。使用第三方资源时，请遵守相应的许可和版权要求。
