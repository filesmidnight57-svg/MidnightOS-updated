const axios = require("axios");

const OLLAMA_API_URL = "http://localhost:11434/api/chat";
const DEFAULT_MODEL = "qwen2.5:7b";

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
    return "HTTP 200: Ollama accepted the request and returned a chat response.";
  }

  if (status === 404) {
    return "HTTP 404: Ollama could not find the requested endpoint or model. Verify Ollama is running and the selected model is installed.";
  }

  if (status >= 400 && status < 500) {
    return `HTTP ${status}: Ollama rejected the request. Review the response body for request or local model details.`;
  }

  if (status >= 500) {
    return `HTTP ${status}: Ollama returned a server-side error. Check the local Ollama service and model runtime logs.`;
  }

  return "No Ollama HTTP response was received. This points to the local Ollama service being unavailable, networking, or timeout issues before Ollama returned a status code.";
}

function createApiError(error, moduleName, url, model) {
  const status = error.response?.status;
  const responseBody = formatResponseBody(error.response?.data || error.message);
  const message = [
    `Ollama request failed in ${moduleName}.`,
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

function buildOllamaPayload(payload, model) {
  const requestPayload = {
    model,
    messages: payload.messages || [],
    stream: false,
  };

  const options = { ...(payload.options || {}) };
  if (payload.temperature !== undefined) options.temperature = payload.temperature;
  if (payload.max_tokens !== undefined) options.num_predict = payload.max_tokens;
  if (Object.keys(options).length > 0) requestPayload.options = options;

  if (payload.response_format?.type === "json_object") {
    requestPayload.format = "json";
  } else if (payload.format !== undefined) {
    requestPayload.format = payload.format;
  }

  return requestPayload;
}

async function requestChatCompletion({ moduleName, payload, timeout = 120000 }) {
  const model = payload.model || process.env.OLLAMA_MODEL || DEFAULT_MODEL;
  const url = process.env.OLLAMA_API_URL || OLLAMA_API_URL;
  const requestPayload = buildOllamaPayload(payload, model);

  try {
    const response = await axios.post(url, requestPayload, {
      headers: { "Content-Type": "application/json" },
      timeout,
    });

    console.info(
      `Ollama request completed in ${moduleName}. HTTP status: ${response.status}. Model: ${model}`
    );

    return (
      response.data?.message?.content ||
      response.data?.choices?.[0]?.message?.content ||
      response.data?.response ||
      ""
    ).trim();
  } catch (error) {
    throw createApiError(error, moduleName, url, model);
  }
}

module.exports = {
  DEFAULT_MODEL,
  OLLAMA_API_URL,
  requestChatCompletion,
};
