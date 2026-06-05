import axios from "axios";

export const backendApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://logday-api.duckdns.org",
  timeout: 15000
});

export const agentApi = axios.create({
  baseURL: "http://127.0.0.1:7890",
  timeout: 5000
});