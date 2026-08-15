import { createStore } from 'vuex'
import axios from 'axios';
import { ElMessage } from 'element-plus';
import { get } from '@/network/request'

let reconnectTimer = null;
let heartbeatTimer = null;
let intentionalClose = false;
let reconnectAttempts = 0;
const pendingTimeouts = new Map();
const imDeviceId = sessionStorage.getItem('teri_im_device_id') ||
    (window.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`);
sessionStorage.setItem('teri_im_device_id', imDeviceId);

const messageStatus = detail => detail.readAt ? 'read' : detail.deliveredAt ? 'delivered' : 'sent';

function stopSocketTimers() {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
}

function updateLocalMessageStatus(state, matcher, status, fields = {}) {
    state.chatList.forEach(chatItem => {
        const detail = chatItem.detail.list.find(matcher);
        if (detail) Object.assign(detail, fields, { deliveryStatus: status });
    });
}

export default createStore({
    state: {
        // 是否加载中
        isLoading: false,
        // 是否登录
        isLogin: false,
        // 是否外部触发打开登录框
        openLogin: false,
        // 当前用户
        user: {},
        // 分区列表
        channels: [],
        // 轮播图列表
        carousels: [],
        // 弹幕列表
        danmuList: [],
        // 未读消息数 分别对应"reply"/"at"/"love"/"system"/"whisper"/"dynamic"
        msgUnread: [0, 0, 0, 0, 0, 0],
        // 聊天列表
        chatList: [],
        // 当前聊天对象的uid (不是聊天的id)
        chatId: -1,
        // 当前页面是否在聊天界面
        isChatPage: false,
        // 实时通讯的socket
        ws: null,
        // disconnected / connecting / connected / reconnecting
        wsStatus: 'disconnected',
        // 等待服务端持久化确认的消息，断线重连后会按客户端消息ID重发
        pendingChatMessages: {},
        // 用户与当前播放视频的互动数据 {love, unlove, coin, collect}
        attitudeToVideo: {},
        // 用户点赞的评论 id
        likeComment: [],
        // 用户点踩的评论 id
        dislikeComment: [],
        // 登录用户的收藏夹列表
        favorites: [],
        // 访问用户的收藏夹列表
        userFavList: [],
        // 热搜列表
        trendings: [],
        // 搜索到的相关数据数量 [视频, 用户]
        matchingCount: [0, 0],
    },
    mutations: {
        // 退出登录或登录过期时初始化个别数据
        initData(state) {
            state.isLogin = false;
            state.user = {};
            state.msgUnread = [0, 0, 0, 0, 0, 0];
            state.attitudeToVideo = {};
            state.favorites = [];
            state.likeComment = [];
            state.dislikeComment = [];
        },
        // 更新登录状态
        updateIsLogin(state, isLogin) {
            state.isLogin = isLogin;
        },
        // 更新当前用户
        updateUser(state, user) {
            state.user = user;
            // console.log("更新vuex中用户信息: ", state.user);
        },
        // 更新分区列表
        updateChannels(state, channels) {
            state.channels = channels;
            // console.log("vuex中的分区: ", state.channels);
        },
        // 更新轮播图列表
        updateCarousels(state, carousels) {
            state.carousels = carousels;
            // console.log("vuex中的轮播图: ", state.carousels);
        },
        // 更新弹幕列表
        updateDanmuList(state, danmuList) {
            state.danmuList = danmuList;
            // console.log("vuex中的弹幕列表: ", state.danmuList);
        },
        // 追加更新聊天列表
        updateChatList(state, chatList) {
            state.chatList.push(...chatList);
            // console.log("vuex中的聊天列表: ", state.chatList);
        },
        // 更新视频互动数据
        updateAttitudeToVideo(state, atv) {
            state.attitudeToVideo = atv;
            // console.log("vuex中的视频互动数据: ", state.attitudeToVideo);
        },
        // 更新用户点赞评论id列表
        updateLikeComment(state, lc) {
            state.likeComment = lc;
        },
        // 更新用户点踩评论id列表
        updateDislikeComment(state, dlc) {
            state.dislikeComment = dlc;
        },
        updateFavorites(state, favorites) {
            state.favorites = favorites;
            // console.log("vuex中的收藏夹列表: ", state.favorites);
        },

        updateTrendings(state, trendings) {
            state.trendings = trendings;
            // console.log("vuex中的热搜列表: ", state.trendings);
        },

        updateMatchingCount(state, matchingCount) {
            state.matchingCount = matchingCount;
        },

        // 处理websocket事件
        setWebSocket(state, ws) {
            state.ws = ws;
        },
        updateWsStatus(state, status) {
            state.wsStatus = status;
        },
        handleWsOpen(state) {
            state.wsStatus = 'connected';
        },
        handleWsClose(state) {
            state.wsStatus = intentionalClose ? 'disconnected' : 'reconnecting';
        },
        handleWsMessage(state, e) {
            const data = JSON.parse(e.data);
            // console.log(data);
            switch (data.type) {
                case "connection": {
                    const content = data.data || {};
                    if (content.type === '离线批次' && content.hasMore && state.ws?.readyState === WebSocket.OPEN) {
                        state.ws.send(JSON.stringify({ code: 106, afterId: content.nextCursor }));
                    }
                    break;
                }
                case "error": {
                    // 系统错误
                    if (data.data === "登录已过期") {
                        // 由于 App.vue 那先做获取用户资料在前，所以基本上这里不会出现登录过期的情况
                        state.isLogin = false;
                        state.user = {};
                        state.msgUnread = [0, 0, 0, 0, 0, 0];
                        state.attitudeToVideo = {};
                        state.favorites = [];
                        state.likeComment = [];
                        state.dislikeComment = [];
                        // 清除本地token缓存
                        localStorage.removeItem("teri_token");
                    }
                    ElMessage.error(data.data);
                    break;
                }
                case "reply": {
                    // 回复我的
                    let content = data.data;
                    // console.log(content);
                    switch (content.type) {
                        case "全部已读": {
                            state.msgUnread[0] = 0; // 清除回复我的的未读数
                            break;
                        }
                        case "接收": {
                            state.msgUnread[0] ++;
                            break;
                        }
                    }
                    break;
                }
                case "at": {
                    // @ 我的
                    let content = data.data;
                    // console.log(content);
                    switch (content.type) {
                        case "全部已读": {
                            state.msgUnread[1] = 0; // 清除@我的的未读数
                            break;
                        }
                        case "接收": {
                            state.msgUnread[1] ++;
                            break;
                        }
                    }
                    break;
                }
                case "love": {
                    // 收到的赞
                    let content = data.data;
                    // console.log(content);
                    switch (content.type) {
                        case "全部已读": {
                            state.msgUnread[2] = 0; // 清除收到的赞的未读数
                            break;
                        }
                        case "接收": {
                            state.msgUnread[2] ++;
                            break;
                        }
                    }
                    break;
                }
                case "system": {
                    // 系统通知
                    let content = data.data;
                    // console.log(content);
                    switch (content.type) {
                        case "全部已读": {
                            state.msgUnread[3] = 0; // 清除系统通知的未读数
                            break;
                        }
                        case "接收": {
                            state.msgUnread[3] ++;
                            break;
                        }
                    }
                    break;
                }
                case "whisper": {
                    // 我的消息（私聊）
                    let content = data.data;
                    // console.log(content);
                    switch (content.type) {
                        case "全部已读": {
                            state.msgUnread[4] = 0; // 清除我的消息的未读数
                            state.chatList.forEach(item => {
                                item.chat.unread = 0;   // 将聊天列表中的全部未读清除
                            })
                            break;
                        }
                        case "已读": {
                            const chatid = content.id;  // 聊天id（不是url那个参数mid）
                            const count = content.count;
                            state.msgUnread[4] = Math.max(0, state.msgUnread[4] - count);   // 减少相应的未读数
                            let chat = state.chatList.find(item => item.chat.id === chatid);
                            if (chat) {
                                chat.chat.unread = 0;   // 清除对应聊天的未读
                            }
                            break;
                        }
                        case "移除": {
                            const chatid = content.id;  // 聊天id（不是url那个参数mid）
                            const count = content.count;
                            state.msgUnread[4] = Math.max(0, state.msgUnread[4] - count);   // 减少相应的未读数
                            let i = state.chatList.findIndex(item => item.chat.id === chatid);
                            if (i !== -1) {
                                // 如果是当前聊天先关闭窗口
                                if (state.chatList[i].user.uid === state.chatId) state.chatId = -1;
                                state.chatList.splice(i, 1);    // 再移除这个聊天
                            }
                            break;
                        }
                        case "接收": {
                            const chat = content.chat;
                            const detail = content.detail;  // 新消息详情
                            const user = content.user;
                            detail.deliveryStatus = messageStatus(detail);
                            // 按时间从最近到最远排序
                            const sortByLatestTime = list => {
                                list.sort((a, b) => {
                                    const timeA = new Date(a.chat.latestTime).getTime();
                                    const timeB = new Date(b.chat.latestTime).getTime();
                                    return timeB - timeA;
                                });
                            }
                            if (detail.userId === state.user.uid) {
                                // 如果发送方是自己
                                let chatItem = state.chatList.find(item => item.chat.userId === detail.anotherId);
                                if (chatItem) {
                                    const index = chatItem.detail.list.findIndex(item =>
                                        (item.id != null && item.id === detail.id) ||
                                        (item.clientMessageId && item.clientMessageId === detail.clientMessageId));
                                    if (index === -1) chatItem.detail.list.push(detail);
                                    else Object.assign(chatItem.detail.list[index], detail);
                                    chatItem.chat.latestTime = chat.latestTime;
                                    sortByLatestTime(state.chatList);
                                } else if (content.senderChat && content.recipientUser) {
                                    state.chatList.unshift({
                                        chat: content.senderChat,
                                        user: content.recipientUser,
                                        detail: { more: true, list: [detail] }
                                    });
                                }
                                if (detail.clientMessageId) {
                                    delete state.pendingChatMessages[detail.clientMessageId];
                                    clearTimeout(pendingTimeouts.get(detail.clientMessageId));
                                    pendingTimeouts.delete(detail.clientMessageId);
                                }
                            } else {
                                let inserted = false;
                                // 如果发送方是别人 需要判断当前是否有一个页面在该聊天窗口以更新全部未读数
                                // 不需判断当前页面是否聊天页面了 都要更新消息
                                let chatItem = state.chatList.find(item => item.chat.userId === detail.userId);
                                if (chatItem) {
                                    const index = chatItem.detail.list.findIndex(item =>
                                        (item.id != null && item.id === detail.id) ||
                                        (item.clientMessageId && item.clientMessageId === detail.clientMessageId));
                                    if (index === -1) {
                                        chatItem.detail.list.push(detail);
                                        inserted = true;
                                    } else {
                                        Object.assign(chatItem.detail.list[index], detail);
                                    }
                                    chatItem.chat = chat;
                                    sortByLatestTime(state.chatList);
                                } else {
                                    // 如果没有就创建聊天
                                    chatItem = {
                                        chat: chat,
                                        user: user,
                                        detail: {
                                            more: true,
                                            list: []
                                        }
                                    };
                                    chatItem.detail.list.push(detail);
                                    state.chatList.unshift(chatItem);
                                    inserted = true;
                                }
                                // 离线重放前已经通过 /msg-unread/all 初始化总数，避免重复累计。
                                if (inserted && !content.online && !content.offline) state.msgUnread[4]++;
                                if (state.ws && state.ws.readyState === WebSocket.OPEN) {
                                    const readingNow = state.isChatPage && state.chatId === detail.userId;
                                    state.ws.send(JSON.stringify(readingNow
                                        ? { code: 104, anotherId: detail.userId, upToMessageId: detail.id }
                                        : { code: 103, id: detail.id }));
                                }
                            }
                            break;
                        }
                        case "送达": {
                            updateLocalMessageStatus(
                                state,
                                item => item.id === content.id || item.clientMessageId === content.clientMessageId,
                                'delivered',
                                { deliveredAt: content.deliveredAt }
                            );
                            break;
                        }
                        case "已读回执": {
                            updateLocalMessageStatus(
                                state,
                                item => item.userId === state.user.uid &&
                                    item.anotherId === content.readerId &&
                                    (content.upToMessageId == null || item.id <= content.upToMessageId),
                                'read',
                                { readAt: content.readAt, deliveredAt: content.readAt }
                            );
                            break;
                        }
                        case "撤回": {
                            const msgId = content.id;
                            const sendId = content.sendId;
                            const acceptId = content.acceptId;
                            let chat;
                            if (sendId === state.user.uid) {
                                // 发送者是自己，找接收者的聊天
                                chat = state.chatList.find(item => item.chat.userId === acceptId);
                            } else {
                                // 发送者是对方，找发送者的聊天
                                chat = state.chatList.find(item => item.chat.userId === sendId);
                            }
                            if (chat) {
                                // 找到对应消息更改字段
                                let msg = chat.detail.list.find(item => item.id === msgId);
                                if (msg) {
                                    msg.withdraw = 1;
                                }
                            }
                            break;
                        }
                    }
                    break;
                }
                case "dynamic": {
                    // 动态
                    let content = data.content;
                    // console.log(content);
                    switch (content.type) {
                        case "全部已读": {
                            state.msgUnread[5] = 0; // 清除动态的未读数
                            break;
                        }
                        case "接收": {
                            state.msgUnread[5] ++;
                            break;
                        }
                    }
                    break;
                }
            }

        },
        handleWsError(_, e) {
            console.log("实时通信websocket报错: ", e);
        },
    },
    actions: {
        // 获取当前用户信息
        async getPersonalInfo(context) {
            // 这里为了更方便捕捉到错误后做出反应，就不使用封装的函数了
            const result = await axios.get("/api/user/personal/info", {
                headers: {
                    Authorization: "Bearer " + localStorage.getItem("teri_token"),
                },
            })
                .catch(() => {
                    // 一般这里捕抓到异常就表示token失效了，所以直接清空浏览器缓存就好了，不需要调用退出函数了
                    context.commit("initData");
                    // 关闭websocket
                    if (context.state.ws) {
                        context.state.ws.close();
                        context.commit('setWebSocket', null);
                    }
                    // 清除本地token缓存
                    localStorage.removeItem("teri_token");
                    ElMessage.error("请登录后查看");
                });
            if (!result) return;
            if (result.data.code === 200) {
                context.commit("updateUser", result.data.data);
                context.state.isLogin = true;
            }
        },

        // 退出登录
        logout(context) {
            // 先修改状态再发送请求，防止token过期导致退出失败
            context.commit("initData");
            // 关闭websocket
            if (context.state.ws) {
                context.state.ws.close();
                context.commit('setWebSocket', null);
            }
            // 发送退出请求，处理redis中的缓存信息，不能用异步，不然token过期导致退出失败，后面步骤卡死
            axios.get("/api/user/account/logout", {
                headers: {
                    Authorization: "Bearer " + localStorage.getItem("teri_token"),
                },
            })
            .catch(() => {});
            // 清除本地token缓存
            localStorage.removeItem("teri_token");
        },

        // 获取全部未读消息数
        async getMsgUnread({ state }) {
            const res = await get("/msg-unread/all", {
                headers: { Authorization: "Bearer " + localStorage.getItem('teri_token') }
            });
            const data = res.data.data;
            state.msgUnread[0] = data.reply;
            state.msgUnread[1] = data.at;
            state.msgUnread[2] = data.love;
            state.msgUnread[3] = data.system;
            state.msgUnread[4] = data.whisper;
            state.msgUnread[5] = data.dynamic;
        },

        // 初始化websocket实例
        connectWebSocket({ commit, state, dispatch }) {
            return new Promise((resolve) => {
                if (state.ws && (state.ws.readyState === WebSocket.OPEN || state.ws.readyState === WebSocket.CONNECTING)) {
                    resolve();
                    return;
                }
                intentionalClose = false;
                commit('updateWsStatus', reconnectAttempts > 0 ? 'reconnecting' : 'connecting');
                const wsBaseUrl = process.env.VUE_APP_WS_IM_URL;
                const ws = new WebSocket(`${wsBaseUrl}/im`);
                commit('setWebSocket', ws);

                ws.addEventListener('open', () => {
                    commit('handleWsOpen');
                    reconnectAttempts = 0;
                    ws.send(JSON.stringify({
                        code: 100,
                        content: "Bearer " + localStorage.getItem('teri_token'),
                        deviceId: imDeviceId,
                    }));
                    if (state.isChatPage && state.chatId > 0) {
                        ws.send(JSON.stringify({ code: 104, anotherId: state.chatId }));
                        ws.send(JSON.stringify({ code: 105, deviceId: imDeviceId, chatId: state.chatId }));
                    }
                    heartbeatTimer = setInterval(() => {
                        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({
                            code: 105,
                            deviceId: imDeviceId,
                            chatId: state.isChatPage ? state.chatId : -1,
                        }));
                    }, 25000);
                    dispatch('flushPendingChatMessages');
                    resolve();
                });

                ws.addEventListener('close', () => {
                    if (state.ws === ws) commit('setWebSocket', null);
                    if (heartbeatTimer) clearInterval(heartbeatTimer);
                    heartbeatTimer = null;
                    commit('handleWsClose');
                    if (!intentionalClose && state.isLogin && localStorage.getItem('teri_token')) {
                        const delay = Math.min(30000, 1000 * (2 ** Math.min(reconnectAttempts, 5))) + Math.floor(Math.random() * 500);
                        reconnectAttempts++;
                        reconnectTimer = setTimeout(() => dispatch('connectWebSocket'), delay);
                    }
                });
                ws.addEventListener('message', e => commit('handleWsMessage', e));
                ws.addEventListener('error', e => commit('handleWsError', e));
            });
        },

        sendRealtimeCommand({ state }, command) {
            if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return false;
            state.ws.send(JSON.stringify(command));
            return true;
        },

        sendChatMessage({ state, dispatch }, { anotherId, content }) {
            const clientMessageId = window.crypto?.randomUUID?.() ||
                `${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const command = { code: 101, anotherId, content, clientMessageId };
            state.pendingChatMessages[clientMessageId] = command;

            const chatItem = state.chatList.find(item => item.user.uid === anotherId);
            if (chatItem) {
                chatItem.detail.list.push({
                    id: null,
                    userId: state.user.uid,
                    anotherId,
                    content,
                    clientMessageId,
                    withdraw: 0,
                    time: new Date().toISOString(),
                    deliveryStatus: 'pending'
                });
            }
            if (!state.ws || state.ws.readyState !== WebSocket.OPEN) dispatch('connectWebSocket');
            dispatch('sendRealtimeCommand', command);
            pendingTimeouts.set(clientMessageId, setTimeout(() => {
                updateLocalMessageStatus(state, item => item.clientMessageId === clientMessageId, 'failed');
            }, 10000));
            return clientMessageId;
        },

        retryChatMessage({ state, dispatch }, clientMessageId) {
            const command = state.pendingChatMessages[clientMessageId];
            if (!command) return;
            updateLocalMessageStatus(state, item => item.clientMessageId === clientMessageId, 'pending');
            if (!state.ws || state.ws.readyState !== WebSocket.OPEN) dispatch('connectWebSocket');
            dispatch('sendRealtimeCommand', command);
        },

        flushPendingChatMessages({ state, dispatch }) {
            Object.values(state.pendingChatMessages).forEach(command => dispatch('sendRealtimeCommand', command));
        },

        // 关闭后清空 WebSocket 实例
        async closeWebSocket({ commit, state }) {
            intentionalClose = true;
            stopSocketTimers();
            if (state.ws) {
                state.ws.close();
                commit('setWebSocket', null);
            }
            commit('updateWsStatus', 'disconnected');
        },

        getImDeviceId() {
            return imDeviceId;
        },
    }
})
