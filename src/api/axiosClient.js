import axios from "axios";

const BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  "https://oldschool-messanger-backend.onrender.com";

const axiosClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token;
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${cleanToken}`;
  }
  return config;
});

axiosClient.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error("API ERROR:", {
      status: err?.response?.status,
      url: (err?.config?.baseURL || "") + (err?.config?.url || ""),
      data: err?.response?.data,
    });
    return Promise.reject(err);
  }
);

export default axiosClient;
