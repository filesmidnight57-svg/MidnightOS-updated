const axios = require("axios");

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "deepseek/deepseek-chat-v3-0324";

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
  const message = [
    `OpenRouter request failed in ${moduleName}.`,
    `API URL: ${url}`,
    `Model: ${model}`,
    `HTTP status: ${status || "NO_RESPONSE"}`,
    `Response body: ${responseBody || "<empty>"}`,
    `Root cause: OpenRouter rejected the chat completion request before metadata generation. This is a configuration/access problem for the requested model or API key, not an FFmpeg or metadata-generation issue.`,
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
