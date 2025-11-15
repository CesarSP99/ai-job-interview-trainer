//Utils to interact wihth the AI interiview API

const BASE_URLUrl = 'https://api.example.com/interview';

// utils/interviewApi.jsx
const BASE_URL = "https://your-backend.example.com/interview"; // TODO: replace

// Helper: standard JSON fetch
async function jsonFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

// 1) Start a new interview session when the dialog opens
export async function startInterviewSession({ jobId, jobTitle }) {
  // POST on entry (you asked: “indicating that we are entering the chatbot”)
  return jsonFetch(`${BASE_URL}/session`, {
    method: "POST",
    body: JSON.stringify({ jobId, jobTitle }),
  }); // expected: { sessionId: "..." }
}

// 2) Send a user message (POST each message)
export async function sendInterviewMessage({ sessionId, content }) {
  return jsonFetch(`${BASE_URL}/message`, {
    method: "POST",
    body: JSON.stringify({ sessionId, role: "user", content }),
  }); // expected: { messageId: "...", timestamp: ... }
}

// 3) Retrieve the assistant reply (GET)
export async function getInterviewReply({ sessionId, forMessageId }) {
  // You said: “reply should be a GET”. This polls a single reply for a user message.
  const url = new URL(`${BASE_URL}/reply`);
  url.searchParams.set("sessionId", sessionId);
  url.searchParams.set("for", forMessageId); // the user message we’re waiting on

  return jsonFetch(url.toString(), { method: "GET" });
  // expected: { role: "assistant", content: "...", timestamp: ... }
}
