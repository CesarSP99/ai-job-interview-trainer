// components/Interview/ChatDialog.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  TextField,
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Divider,
  Stack,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import MicIcon from "@mui/icons-material/Mic";
import {
  startInterviewSession,
  sendInterviewMessage,
  evaluateInterview,
} from "../../utils/interviewApi";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Helper: map backend Message -> local shape
function mapBackendMessage(m) {
  if (!m) return null;
  return {
    role: m.role || "assistant",
    content: m.content || "",
    modality: m.modality || "text",
    sentiment: m.sentiment || null,
    timestamp: Date.now(),
  };
}

/*
StartRequest payload example (what we send to /interview/start):

{
  resume_skills: resume_skills,
  job_id: job.jobId,
  job_title: job.jobTitle,
  company: job.company,
  matched_skills: job.matchedSkills,
  match_score: job.matchScore,
  resume_profile: resumeProfile,
  trainee_name: resumeProfile?.name ?? null,
}
*/

export default function ChatDialog({ open, onClose, job, resumeSkills, resumeProfile }) {
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [evaluating, setEvaluating] = useState(false);

  // 🎙 audio recording state
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const listRef = useRef(null);

  // Autoscroll to last message
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  const jobTitle = useMemo(
    () => job?.title ?? job?.jobTitle ?? "Job Interview",
    [job]
  );

  // Cleanup recording on unmount/close
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current) {
        try {
          mediaRecorderRef.current.stream
            ?.getTracks()
            ?.forEach((t) => t.stop());
        } catch {
          // ignore
        }
        mediaRecorderRef.current = null;
      }
    };
  }, []);

  // Start session when the dialog opens
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!open || !job) return;
      setStarting(true);
      setMessages([]);
      setSessionId(null);

      try {
        const startPayload = {
          resume_skills: resumeSkills ?? [],
          job_id: job.jobId,
          job_title: job.jobTitle,
          company: job.company,
          matched_skills: job.matchedSkills ?? [],
          match_score:
            typeof job.matchScore === "number"
              ? job.matchScore
              : typeof job.__skillMatchScore === "number"
              ? job.__skillMatchScore / 100.0
              : 0,
          resume_profile: resumeProfile ?? null,
          trainee_name: resumeProfile?.name ?? null,
        };

        const res = await startInterviewSession(startPayload);
        if (cancelled) return;

        // Backend response: { session_id, first_message }
        setSessionId(res.session_id);

        const firstMsg = mapBackendMessage(res.first_message);
        setMessages([
          firstMsg || {
            role: "assistant",
            content: `Hi! I’m your AI interviewer for "${jobTitle}". I’ll ask questions like a real interview and give feedback. Ready to start?`,
            timestamp: Date.now(),
          },
        ]);
      } catch (e) {
        if (!cancelled) {
          setMessages([
            {
              role: "assistant",
              content:
                "I couldn’t start the interview session. Please try again in a moment.",
              timestamp: Date.now(),
              error: String(e.message || e),
            },
          ]);
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    }

    if (open) {
      boot();
    } else {
      // reset when closing
      setSessionId(null);
      setMessages([]);
      setInput("");
      setStarting(false);
      setSending(false);
      setEvaluating(false);
      setRecording(false);
      if (mediaRecorderRef.current) {
        try {
          mediaRecorderRef.current.stream
            ?.getTracks()
            ?.forEach((t) => t.stop());
        } catch {
          // ignore
        }
        mediaRecorderRef.current = null;
      }
    }

    return () => {
      cancelled = true;
    };
  }, [open, job, jobTitle, resumeSkills, resumeProfile]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || !sessionId || sending || starting || recording) return;

    setSending(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: trimmed, timestamp: Date.now() },
    ]);
    setInput("");

    try {
      // POST user message and get ChatResponse back
      const chatResponse = await sendInterviewMessage({
        sessionId,
        content: trimmed,
        file: null,
      });

      const reply = mapBackendMessage(chatResponse.reply);

      setMessages((prev) => [
        ...prev,
        reply || {
          role: "assistant",
          content: "(empty reply)",
          timestamp: Date.now(),
        },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Hmm, I couldn’t fetch a reply right now. Please try sending again.",
          timestamp: Date.now(),
          error: String(e.message || e),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ✅ Evaluate button
  async function handleEvaluate() {
    if (!sessionId || evaluating || starting || recording) return;

    setEvaluating(true);
    try {
      const res = await evaluateInterview({ sessionId });

      const text = `### Overall Evaluation\n\n${res.evaluation}\n\n---\n\n${res.explanation}`;

      // push as a normal assistant message (markdown rendered)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: text,
          timestamp: Date.now(),
        },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I couldn’t get the evaluation right now. Please try again later.",
          timestamp: Date.now(),
          error: String(e.message || e),
        },
      ]);
    } finally {
      setEvaluating(false);
    }
  }

  // 🎙 Voice recording logic
  async function handleToggleRecord() {
    if (!sessionId || starting || sending || evaluating) return;

    // Stop recording
    if (recording) {
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        // ignore
      }
      return;
    }

    // Start recording
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "This browser does not support audio recording. Please try a different browser.",
          timestamp: Date.now(),
        },
      ]);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // stop audio tracks
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);

        if (audioChunksRef.current.length === 0) return;

        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        const file = new File(
          [audioBlob],
          `interview-recording-${Date.now()}.webm`,
          { type: "audio/webm" }
        );

        // Show a placeholder message for the user voice
        setSending(true);
        setMessages((prev) => [
          ...prev,
          {
            role: "user",
            content: "[Voice message]",
            timestamp: Date.now(),
          },
        ]);

        try {
          const chatResponse = await sendInterviewMessage({
            sessionId,
            content: "",
            file,
          });

          const reply = mapBackendMessage(chatResponse.reply);
          setMessages((prev) => [
            ...prev,
            reply || {
              role: "assistant",
              content: "(empty reply)",
              timestamp: Date.now(),
            },
          ]);
        } catch (e) {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content:
                "I couldn’t send the voice message. Please try again or use text.",
              timestamp: Date.now(),
              error: String(e.message || e),
            },
          ]);
        } finally {
          setSending(false);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Could not access your microphone. Please check permissions and try again.",
          timestamp: Date.now(),
        },
      ]);
    }
  }

  return (
    <Dialog
      fullWidth
      maxWidth="md"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ pr: 6 }}>
        AI Interviewer — {jobTitle}
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{ position: "absolute", right: 12, top: 12 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 1, pb: 0 }}>
        {/* Chat timeline */}
        <Box
          ref={listRef}
          sx={{
            height: 420,
            overflowY: "auto",
            px: 1,
            pb: 2,
            background: "rgba(0,0,0,0.02)",
            borderRadius: 2,
          }}
        >
          {starting ? (
            <Stack alignItems="center" justifyContent="center" sx={{ mt: 8 }}>
              <CircularProgress size={28} />
              <Typography variant="body2" sx={{ mt: 2 }}>
                Starting interview…
              </Typography>
            </Stack>
          ) : (
            <List disablePadding>
              {messages.map((m, idx) => (
                <Box key={idx} sx={{ my: 1.5 }}>
                  <ListItem
                    sx={{
                      alignItems: "flex-start",
                      px: 0,
                    }}
                  >
                    <ListItemText
                      primary={
                        <Typography
                          variant="caption"
                          sx={{
                            color:
                              m.role === "user" ? "text.secondary" : "#005dab",
                            fontWeight: 600,
                          }}
                        >
                          {m.role === "user" ? "You" : "Interviewer"}
                        </Typography>
                      }
                      secondary={
                        <Box
                          sx={{
                            mt: 0.5,
                            p: 1.25,
                            borderRadius: 2,
                            boxShadow: 1,
                            bgcolor:
                              m.role === "user"
                                ? "background.paper"
                                : "rgba(0,93,171,0.06)",
                            border:
                              m.role === "user"
                                ? "1px solid rgba(0,0,0,0.08)"
                                : "1px solid rgba(0,93,171,0.18)",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                          }}
                        >
                          <Typography
                            variant="body2"
                            component="div"
                            sx={{
                              "& h1, & h2, & h3, & h4": {
                                fontWeight: 600,
                                mt: 1.5,
                                mb: 0.5,
                              },
                              "& ul": { pl: 3, mb: 1 },
                              "& li": { mb: 0.5 },
                              "& hr": { my: 1.5 },
                            }}
                          >
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {m.content}
                            </ReactMarkdown>
                          </Typography>
                          {m.error && (
                            <>
                              <Divider sx={{ my: 1 }} />
                              <Typography variant="caption" color="error">
                                {m.error}
                              </Typography>
                            </>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                </Box>
              ))}
              {sending && (
                <ListItem sx={{ px: 0 }}>
                  <ListItemText
                    secondary={
                      <Stack direction="row" alignItems="center" spacing={1.5}>
                        <CircularProgress size={18} />
                        <Typography variant="body2">
                          Waiting for reply…
                        </Typography>
                      </Stack>
                    }
                  />
                </ListItem>
              )}
            </List>
          )}
        </Box>

        {/* Composer + Evaluate + Voice + Send */}
        <Box
          sx={{
            position: "sticky",
            bottom: 0,
            pt: 1.25,
            background: "transparent",
          }}
        >
          <TextField
            placeholder="Type your answer…"
            fullWidth
            multiline
            minRows={2}
            maxRows={6}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Stack
            direction="row"
            alignItems="center"
            sx={{ mt: 1 }}
          >
            {/* Left: Evaluate */}
            <Button
              variant="outlined"
              onClick={handleEvaluate}
              disabled={
                !sessionId || evaluating || starting || sending || recording
              }
              sx={{ borderRadius: 2 }}
            >
              {evaluating ? "Evaluating…" : "Evaluate"}
            </Button>

            {/* Middle: Voice record */}
            <Box
              sx={{
                flex: 1,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <Button
                variant={recording ? "contained" : "outlined"}
                color={recording ? "error" : "secondary"}
                startIcon={<MicIcon />}
                onClick={handleToggleRecord}
                disabled={!sessionId || starting || sending || evaluating}
                sx={{ borderRadius: "999px" }}
              >
                {recording ? "Stop" : "Record"}
              </Button>
            </Box>

            {/* Right: Send */}
            <Button
              onClick={handleSend}
              variant="contained"
              endIcon={<SendIcon />}
              disabled={
                !sessionId ||
                !input.trim() ||
                sending ||
                starting ||
                recording
              }
              sx={{ borderRadius: 2 }}
            >
              Send
            </Button>
          </Stack>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
