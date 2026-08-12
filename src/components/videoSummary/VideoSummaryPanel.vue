<template>
    <section class="video-summary-panel">
        <div class="summary-header">
            <div>
                <span class="summary-title">AI 视频总结</span>
                <span class="summary-status" :class="status.toLowerCase()" v-if="task">
                    {{ statusText }}
                </span>
            </div>
            <button class="summary-action" :disabled="submitting || isProcessing || status === 'SUCCESS'"
                @click="startSummary">
                {{ actionText }}
            </button>
        </div>

        <p class="summary-tip" v-if="!task">
            提取视频音轨并生成关键观点和时间线，处理过程在后台异步完成。
        </p>
        <div class="summary-progress" v-else-if="isProcessing">
            <span class="loading-dot"></span>
            {{ statusText }}，你可以继续观看视频。
        </div>
        <div class="summary-error" v-else-if="status === 'FAILED'">
            {{ task.errorMessage || '生成失败，请稍后重试。' }}
        </div>
        <div class="summary-content" v-else-if="hasSummary">
            <h3>{{ task.summary.title || '视频总结' }}</h3>
            <p class="summary-abstract">{{ task.summary.abstract }}</p>

            <div class="summary-block" v-if="task.summary.keyPoints && task.summary.keyPoints.length">
                <h4>关键观点</h4>
                <ul>
                    <li v-for="(point, index) in task.summary.keyPoints" :key="`point-${index}`">
                        {{ point }}
                    </li>
                </ul>
            </div>

            <div class="summary-block" v-if="task.summary.timeline && task.summary.timeline.length">
                <h4>关键时间线</h4>
                <div class="timeline-item" v-for="(item, index) in task.summary.timeline"
                    :key="`timeline-${index}`">
                    <button class="timeline-time" @click="jumpTo(item.time)">{{ item.time }}</button>
                    <span>{{ item.content }}</span>
                </div>
            </div>

            <details class="transcript" v-if="task.transcript">
                <summary>查看语音转写文本</summary>
                <pre>{{ task.transcript }}</pre>
            </details>
        </div>
    </section>
</template>

<script>
import { ElMessage } from 'element-plus';

const PROCESSING_STATUSES = ['PENDING', 'EXTRACTING', 'TRANSCRIBING', 'SUMMARIZING'];

export default {
    name: 'VideoSummaryPanel',
    props: {
        vid: {
            type: Number,
            required: true,
        },
    },
    emits: ['jump'],
    data() {
        return {
            task: null,
            submitting: false,
            pollingTimer: null,
        };
    },
    computed: {
        status() {
            return this.task?.status || 'IDLE';
        },
        isProcessing() {
            return PROCESSING_STATUSES.includes(this.status);
        },
        hasSummary() {
            return this.status === 'SUCCESS' && this.task?.summary;
        },
        statusText() {
            const labels = {
                PENDING: '等待处理',
                EXTRACTING: '正在提取音轨',
                TRANSCRIBING: '正在语音转写',
                SUMMARIZING: '正在生成总结',
                SUCCESS: '已完成',
                FAILED: '生成失败',
            };
            return labels[this.status] || '';
        },
        actionText() {
            if (this.submitting) return '正在提交';
            if (this.isProcessing) return '生成中';
            if (this.status === 'FAILED') return '重新生成';
            if (this.status === 'SUCCESS') return '已生成';
            return '生成总结';
        },
    },
    watch: {
        vid: {
            immediate: true,
            handler() {
                this.stopPolling();
                this.task = null;
                this.loadLatest();
            },
        },
    },
    beforeUnmount() {
        this.stopPolling();
    },
    methods: {
        authHeaders() {
            const token = localStorage.getItem('teri_token');
            return token ? { Authorization: `Bearer ${token}` } : null;
        },
        async loadLatest() {
            const headers = this.authHeaders();
            if (!headers || !this.vid) return;
            const res = await this.$get('/video/summary/latest', {
                params: { vid: this.vid },
                headers,
            });
            if (res?.data?.data) {
                this.applyTask(res.data.data);
            }
        },
        async startSummary() {
            const headers = this.authHeaders();
            if (!headers) {
                ElMessage.warning('请登录后生成视频总结');
                return;
            }
            if (this.submitting || this.isProcessing || this.status === 'SUCCESS') return;

            this.submitting = true;
            try {
                const formData = new FormData();
                formData.append('vid', this.vid);
                const res = await this.$post('/video/summary', formData, { headers });
                if (res?.data?.data) {
                    this.applyTask(res.data.data);
                    ElMessage.success('视频总结任务已提交');
                }
            } finally {
                this.submitting = false;
            }
        },
        applyTask(task) {
            this.task = task;
            if (PROCESSING_STATUSES.includes(task.status)) {
                this.startPolling();
            } else {
                this.stopPolling();
            }
        },
        startPolling() {
            if (this.pollingTimer) return;
            this.pollingTimer = window.setInterval(() => this.pollTask(), 3000);
        },
        stopPolling() {
            if (this.pollingTimer) {
                window.clearInterval(this.pollingTimer);
                this.pollingTimer = null;
            }
        },
        async pollTask() {
            if (!this.task?.taskId) return;
            const headers = this.authHeaders();
            if (!headers) {
                this.stopPolling();
                return;
            }
            const res = await this.$get('/video/summary/task', {
                params: { taskId: this.task.taskId },
                headers,
            });
            if (res?.data?.data) {
                this.applyTask(res.data.data);
            }
        },
        jumpTo(time) {
            const matched = String(time || '').match(/(\d{1,2}):(\d{2}):(\d{2})/);
            if (!matched) return;
            const seconds = Number(matched[1]) * 3600 + Number(matched[2]) * 60 + Number(matched[3]);
            this.$emit('jump', seconds);
        },
    },
};
</script>

<style scoped>
.video-summary-panel {
    margin: 18px 0;
    padding: 18px 20px;
    border: 1px solid var(--line_regular);
    border-radius: 10px;
    background: linear-gradient(135deg, rgba(251, 114, 153, .08), rgba(0, 174, 236, .05));
    color: var(--text1);
}

.summary-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.summary-title {
    font-size: 17px;
    font-weight: 600;
}

.summary-status {
    margin-left: 10px;
    padding: 2px 8px;
    border-radius: 10px;
    color: var(--text3);
    background: var(--graph_weak);
    font-size: 12px;
}

.summary-status.success {
    color: #2f9b62;
    background: rgba(47, 155, 98, .1);
}

.summary-status.failed {
    color: #d44b4b;
    background: rgba(212, 75, 75, .1);
}

.summary-action {
    padding: 7px 16px;
    border: 0;
    border-radius: 16px;
    color: #fff;
    background: var(--brand_pink);
    cursor: pointer;
}

.summary-action:disabled {
    cursor: not-allowed;
    opacity: .55;
}

.summary-tip,
.summary-progress,
.summary-error {
    margin: 14px 0 0;
    color: var(--text2);
    line-height: 1.7;
}

.summary-error {
    color: #d44b4b;
}

.loading-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-right: 8px;
    border-radius: 50%;
    background: var(--brand_pink);
    animation: pulse 1.2s infinite;
}

.summary-content h3 {
    margin: 16px 0 8px;
    font-size: 17px;
}

.summary-content h4 {
    margin: 16px 0 8px;
    font-size: 15px;
}

.summary-abstract,
.summary-block li,
.timeline-item {
    line-height: 1.75;
}

.summary-block ul {
    margin: 0;
    padding-left: 20px;
}

.timeline-item {
    display: flex;
    gap: 10px;
    margin: 6px 0;
}

.timeline-time {
    flex: 0 0 auto;
    padding: 0;
    border: 0;
    color: var(--brand_pink);
    background: transparent;
    cursor: pointer;
}

.transcript {
    margin-top: 16px;
    color: var(--text2);
}

.transcript summary {
    cursor: pointer;
}

.transcript pre {
    max-height: 260px;
    padding: 12px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
    border-radius: 6px;
    background: rgba(0, 0, 0, .04);
    font-family: inherit;
    line-height: 1.65;
}

@keyframes pulse {
    0%, 100% { opacity: .35; }
    50% { opacity: 1; }
}
</style>
