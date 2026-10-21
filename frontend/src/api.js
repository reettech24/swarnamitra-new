import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((c) => {
  const t = localStorage.getItem('sm_token');
  if (t) c.headers.Authorization = 'Bearer ' + t;
  return c;
});

api.interceptors.response.use(
  (r) => r,
  (e) => {
    if (e.response?.status === 401 && !e.config.url.startsWith('/auth/login')) {
      localStorage.removeItem('sm_token');
      localStorage.removeItem('sm_user');
      window.location.href = '/login';
    }
    return Promise.reject(e);
  }
);

export const errMsg = (e) => e.response?.data?.error || e.message || 'Something went wrong';

export async function download(url, filename, params) {
  const r = await api.get(url, { responseType: 'blob', params });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(r.data);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

export default api;
