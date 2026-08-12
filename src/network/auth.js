import axios from 'axios';

let refreshPromise = null;

const refreshClient = axios.create({
  baseURL: '/api',
  timeout: 30000,
  withCredentials: true,
});

export async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = refreshClient.post('/auth/refresh')
      .then((response) => {
        const token = response.data?.data?.accessToken || response.data?.data?.token;
        if (!token) throw new Error('Refresh response did not include an access token');
        localStorage.setItem('teri_token', token);
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export function clearAccessToken() {
  localStorage.removeItem('teri_token');
}

export function installAuthInterceptors(instance) {
  instance.defaults.withCredentials = true;

  instance.interceptors.request.use((config) => {
    const token = localStorage.getItem('teri_token');
    if (token && !config.headers?.Authorization) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  instance.interceptors.response.use(
    response => response,
    async (error) => {
      const request = error.config || {};
      const url = request.url || '';
      const isAuthenticationRequest = /\/auth\/refresh|\/account\/login|\/account\/register/.test(url);
      if (error.response?.status !== 401 || request.__authRetried || isAuthenticationRequest) {
        return Promise.reject(error);
      }
      request.__authRetried = true;
      try {
        const token = await refreshAccessToken();
        request.headers = request.headers || {};
        request.headers.Authorization = `Bearer ${token}`;
        return instance(request);
      } catch (refreshError) {
        clearAccessToken();
        return Promise.reject(refreshError);
      }
    },
  );
  return instance;
}
