import axios from 'axios';
const api = axios.create({
  baseURL: 'http://10.2.178.124:5000',
  withCredentials: true,
});

export default api;
