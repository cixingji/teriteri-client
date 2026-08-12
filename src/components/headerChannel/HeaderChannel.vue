<template>
    <div class="header-channel">
        <!-- 左边 - 核心功能 -->
        <div class="channel-icons">
            <div class="channel-icons__item" @click="openNewPage('/dynamic')">
                <div class="icon-bg icon-bg__dynamic">
                    <i class="iconfont icon-fengche"></i>
                </div>
                <span class="icon-title">动态</span>
            </div>
            <div class="channel-icons__item" @click="openNewPage('/popular')">
                <div class="icon-bg icon-bg__popular">
                    <i class="iconfont icon-huo"></i>
                </div>
                <span class="icon-title">热门</span>
            </div>
        </div>
        
        <!-- 右边 - 频道导航 -->
        <div class="right-channel-container">
            <div class="channel-items__left">
                <div class="channel-link" @click="openNewPage('/movie')">
                    <span>影视</span>
                </div>
                <div class="channel-link" @click="openNewPage('/music')">
                    <span>音乐</span>
                </div>
                <div class="channel-link" @click="openNewPage('/tech')">
                    <span>科技</span>
                </div>
                <div class="channel-link" @click="openNewPage('/life')">
                    <span>生活</span>
                </div>
                <div class="channel-link" @click="openNewPage('/game')">
                    <span>游戏</span>
                </div>
                <div class="channel-link" @click="openNewPage('/education')">
                    <span>教育</span>
                </div>
                <div class="channel-link" @click="openNewPage('/creative')">
                    <span>创意</span>
                </div>
                <div class="channel-link" @click="openNewPage('/more')">
                    <span>更多</span>
                </div>
            </div>
            
            <div class="channel-items__right">
                <div class="channel-link__right" @click="openNewPage('/read/home')">
                    <i class="iconfont icon-zhuanlan"></i>
                    <span>专栏</span>
                </div>
                <div class="channel-link__right" @click="openNewPage('/live')">
                    <i class="iconfont icon-zhibo"></i>
                    <span>直播</span>
                </div>
                <div class="channel-link__right" @click="openNewPage('/activity')">
                    <i class="iconfont icon-huodong"></i>
                    <span>活动</span>
                </div>
                <div class="channel-link__right" @click="openNewPage('/cheese')">
                    <i class="iconfont icon-ketang"></i>
                    <span>课堂</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
    export default {
        name: "HeaderChannel",
        data() {
            return {
                dynamicPic: false,
            }
        },
        computed: {
            channels() {
                return this.$store.state.channels;
            }
        },
        methods: {
            openNewPage(route) {
                window.open(this.$router.resolve(route).href, '_blank');
            }
        }
    }
</script>

<style scoped>
.header-channel {
    position: relative;
    width: 100%;
    max-width: 1400px;
    margin: 0 auto;
    padding: 20px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--bg1);
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    overflow: hidden;
}

/* 左边图标区域 */
.channel-icons {
    display: flex;
    align-items: center;
    gap: 20px;
}

.channel-icons__item {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    transition: all 0.3s ease;
}

.channel-icons__item:hover {
    transform: translateY(-2px);
}

.icon-bg {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    margin-bottom: 8px;
    transition: all 0.3s ease;
    font-size: 24px;
    color: #fff;
}

.icon-bg__dynamic {
    background: linear-gradient(135deg, #6366F1, #8B5CF6);
}

.icon-bg__popular {
    background: linear-gradient(135deg, #EF4444, #F59E0B);
}

.icon-title {
    font-size: 14px;
    color: var(--text2);
    font-weight: 500;
}

.channel-icons__item:hover .icon-title {
    color: var(--text1);
}

/* 右边频道区域 */
.right-channel-container {
    display: flex;
    align-items: center;
    gap: 40px;
}

.channel-items__left {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
}

.channel-items__right {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-left: 24px;
    border-left: 1px solid var(--line_regular);
}

.channel-link {
    padding: 8px 16px;
    border-radius: 20px;
    background: var(--bg2);
    color: var(--text2);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    white-space: nowrap;
}

.channel-link:hover {
    background: var(--v_brand_pink_thin);
    color: var(--v_brand_pink);
    transform: translateY(-1px);
}

.channel-link__right {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 8px;
    color: var(--text2);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.3s ease;
    white-space: nowrap;
}

.channel-link__right:hover {
    background: var(--bg2);
    color: var(--text1);
}

.channel-link__right i {
    font-size: 16px;
}

/* 响应式设计 */
@media (max-width: 1200px) {
    .header-channel {
        padding: 16px 20px;
    }
    
    .channel-items__right {
        display: none;
    }
    
    .right-channel-container {
        gap: 20px;
    }
}

@media (max-width: 768px) {
    .header-channel {
        flex-direction: column;
        gap: 20px;
        padding: 16px;
    }
    
    .channel-icons {
        gap: 16px;
    }
    
    .channel-items__left {
        justify-content: center;
        gap: 12px;
    }
    
    .channel-link {
        padding: 6px 12px;
        font-size: 13px;
    }
}
</style>