const axios = require("axios");

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "deepseek/deepseek-chat";

function formatResponseBody(data) {
  if (typeof data === "string") return data;
  if (data === undefined) return "";
  try {
    return JSON.stringify(data);
  } catch (error) {
    return String(data);
  }
}

function createApiError(error, moduleName, url, model) {
  const status = error.response?.status;
  const responseBody = formatResponseBody(error.response?.data || error.message);
  const hasApiKey = Boolean(process.env.OPENROUTER_API_KEY);
  const message = [
    `OpenRouter request failed in ${moduleName}.`,
    `API URL: ${url}`,
    `Model: ${model}`,
    `HTTP status: ${status || "NO_RESPONSE"}`,
    `API key configured: ${hasApiKey ? "yes" : "no"}`,
    `Authorization header: Bearer ${hasApiKey ? "<OPENROUTER_API_KEY>" : "<missing>"}`,
    `Content-Type header: application/json`,
    `HTTP-Referer header: ${process.env.OPENROUTER_SITE_URL || "https://midnightos.local"}`,
    `X-Title header: ${process.env.OPENROUTER_APP_TITLE || "MidnightOS"}`,
    `Response body: ${responseBody || "<empty>"}`,
    `Diagnosis: HTTP 403 means OpenRouter accepted the endpoint but refused authorization for this request. Check that OPENROUTER_API_KEY is valid, the account has credits or free-model quota, and the model slug is enabled for the key/account. The old deepseek/deepseek-chat-v3-0324 slug can be unavailable or access-restricted; the production default is now deepseek/deepseek-chat.`,
  ].join("\n");

  const apiError = new Error(message);
  apiError.cause = error;
  apiError.status = status;
  apiError.responseBody = responseBody;
  apiError.moduleName = moduleName;
  apiError.apiUrl = url;
  apiError.model = model;
  return apiError;
}

async function requestChatCompletion({ moduleName, payload, timeout = 120000 }) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      `OpenRouter API key missing in ${moduleName}. Set OPENROUTER_API_KEY before running production mode.`
    );
  }

  const model = payload.model || process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const url = process.env.OPENROUTER_API_URL || OPENROUTER_API_URL;
  const requestPayload = { ...payload, model };

  try {
    const response = await axios.post(url, requestPayload, {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY || ""}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "https://midnightos.local",
        "X-Title": process.env.OPENROUTER_APP_TITLE || "MidnightOS",
      },
      timeout,
    });

    return response.data?.choices?.[0]?.message?.content?.trim() || "";
  } catch (error) {
    throw createApiError(error, moduleName, url, model);
  }
}

module.exports = {
  DEFAULT_MODEL,
  OPENROUTER_API_URL,
  requestChatCompletion,
};
