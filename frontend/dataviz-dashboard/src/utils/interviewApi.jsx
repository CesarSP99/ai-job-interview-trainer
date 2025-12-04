// utils/interviewApi.jsx

export const BASE_URL = "https://p58bnv54-8000.usw3.devtunnels.ms";
//export const BASE_URL = "https://cloud.cesarsp.com:26000"; // update if needed

async function handleJsonResponse(res) {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * Start an interview session.
 * Matches /interview/start, StartRequest schema.
 */
export async function startInterviewSession(startPayload) {
  // startPayload MUST be a plain JS object, NOT a JSON string.
  // e.g. { job_id: 123, job_title: "Data Scientist", ... }
  const res = await fetch(`${BASE_URL}/interview/start`, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(startPayload),
  });
  return handleJsonResponse(res); // { session_id, first_message }
}

/**
 * Send a message in an interview session.
 * Matches /interview/message, multipart/form-data.
 * Returns ChatResponse: { session_id, reply, chat_history }.
 */
export async function sendInterviewMessage({ sessionId, content, file }) {
  const formData = new FormData();
  formData.append("session_id", sessionId);
  if (content !== undefined && content !== null && content !== "") {
    formData.append("text", content);
  }
  if (file) {
    formData.append("file", file);
  }

  const res = await fetch(`${BASE_URL}/interview/message`, {
    method: "POST",
    body: formData,
  });

  return handleJsonResponse(res);
}

export async function evaluateInterview({ sessionId }) {
  const body = new URLSearchParams();
  body.set("session_id", sessionId);

  const res = await fetch(`${BASE_URL}/interview/evaluate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  return handleJsonResponse(res);
}

// There is NO GET /interview/reply endpoint in the backend,
// so we don't export getInterviewReply.
