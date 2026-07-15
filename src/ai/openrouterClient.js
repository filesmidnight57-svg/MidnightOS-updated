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

function describeHttpStatus(status) {
  if (status === 200) {
    return "HTTP 200: OpenRouter accepted the request and returned a completion response.";
  }

  if (status === 401) {
    return "HTTP 401: OpenRouter rejected the request as unauthenticated. Verify the API key value configured on the machine running the app.";
  }

  if (status === 403) {
    return "HTTP 403: OpenRouter authenticated the request but refused access. Check account access, credits/quota, and whether the selected model is allowed for this account.";
  }

  if (status === 429) {
    return "HTTP 429: OpenRouter rate-limited the request or quota is exhausted. Wait before retrying or review account rate limits/credits.";
  }

  if (status >= 400 && status < 500) {
    return `HTTP ${status}: OpenRouter rejected the request. Review the response body for request or account details.`;
  }

  if (status >= 500) {
    return `HTTP ${status}: OpenRouter returned a server-side error. Retry later or check OpenRouter service status.`;
  }

  return "No OpenRouter HTTP response was received. This points to networking, DNS, timeout, or TLS issues before OpenRouter returned a status code.";
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
    `Diagnosis: ${describeHttpStatus(status)}`,
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

    console.info(
      `OpenRouter request completed in ${moduleName}. HTTP status: ${response.status}. Model: ${model}`
    );

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
