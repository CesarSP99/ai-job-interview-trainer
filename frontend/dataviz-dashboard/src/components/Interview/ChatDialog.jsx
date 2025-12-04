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
  Slider,
  Switch,
  FormControlLabel,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import MicIcon from "@mui/icons-material/Mic";
import {
  BASE_URL,
  startInterviewSession,
  sendInterviewMessage,
  evaluateInterview,
} from "../../utils/interviewApi";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Helper: format ms → mm:ss
function formatDuration(ms) {
  if (!ms || ms < 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// Helper: map backend Message -> local shape
function mapBackendMessage(m) {
  if (!m) return null;
  return {
    role: m.role || "assistant",
    content: m.content || "",
    modality: m.modality || "text",
    sentiment: m.sentiment || null,
    timestamp: Date.now(),
    ttsUrl: m.tts_url ?? null,
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

export default function ChatDialog({
  open,
  onClose,
  job,
  resumeSkills,
  resumeProfile,
}) {
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const [evaluating, setEvaluating] = useState(false);

  // master timer
  const [interviewStartTime, setInterviewStartTime] = useState(null);
  const [interviewEndTime, setInterviewEndTime] = useState(null);
  const [now, setNow] = useState(null);

  // per-message timer: last assistant message time
  const [lastAssistantTimestamp, setLastAssistantTimestamp] = useState(null);

  // audio recording state (user voice messages)
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  //audio playback options for the interview:
  const [playbackRate, setPlaybackRate] = useState(1.0);      // 1x default
  const [showInterviewerText, setShowInterviewerText] = useState(true);

  const listRef = useRef(null);
  const lastAudioRef = useRef(null); // for assistant TTS playback

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

  // master chronometer ticker
  useEffect(() => {
    if (!interviewStartTime || interviewEndTime) return;

    setNow(Date.now());
    const id = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(id);
  }, [interviewStartTime, interviewEndTime]);

  // Cleanup recording on unmount
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

        const startTs = Date.now();
        setSessionId(res.session_id);
        setInterviewStartTime(startTs);
        setInterviewEndTime(null);

        const firstMsgBackend = res.first_message;
        const firstMsg = firstMsgBackend
          ? {
              ...mapBackendMessage(firstMsgBackend),
              timestamp: startTs,
            }
          : {
              role: "assistant",
              content: `Hi! I’m your AI interviewer for "${jobTitle}". I’ll ask questions like a real interview and give feedback. Ready to start?`,
              timestamp: startTs,
              ttsUrl: null,
            };

        setMessages([firstMsg]);
        setLastAssistantTimestamp(startTs);
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
      setInterviewStartTime(null);
      setInterviewEndTime(null);
      setNow(null);
      setLastAssistantTimestamp(null);
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

  // auto-play assistant TTS audio when a new assistant message arrives
  // auto-play assistant TTS audio when a NEW assistant message arrives
  /*useEffect(() => {
    if (!messages.length) return;

    const last = messages[messages.length - 1];

    if (last.role === "assistant" && last.ttsUrl) {
      // stop any previous autoplay audio
      if (lastAudioRef.current) {
        try {
          lastAudioRef.current.pause();
        } catch {
          // ignore
        }
      }

      const audio = new Audio(`${BASE_URL}${last.ttsUrl}`);
      audio.playbackRate = playbackRate;  // use current slider value at start
      lastAudioRef.current = audio;

      audio
        .play()
        .catch((err) =>
          console.warn("Could not autoplay assistant audio:", err)
        );
    }
  }, [messages]);   // 👈 ONLY depends on messages now

  // whenever playbackRate changes, update the currently playing assistant audio
  useEffect(() => {
    if (lastAudioRef.current) {
      try {
        lastAudioRef.current.playbackRate = playbackRate;
      } catch {
        // ignore
      }
    }
  }, [playbackRate]);
*/

const lastAutoPlayedIndexRef = useRef(-1);


  const masterElapsedMs =
    interviewStartTime == null
      ? 0
      : (interviewEndTime ?? now ?? interviewStartTime) - interviewStartTime;

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || !sessionId || sending) return;

    const nowTs = Date.now();
    const responseTimeMs =
      lastAssistantTimestamp != null ? nowTs - lastAssistantTimestamp : null;

    setSending(true);
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: trimmed,
        timestamp: nowTs,
        responseTimeMs, // per-message timing
      },
    ]);
    setInput("");

    try {
      const chatResponse = await sendInterviewMessage({
        sessionId,
        content: trimmed,
        file: null,
      });

      const reply =
        mapBackendMessage(chatResponse.reply) || {
          role: "assistant",
          content: "(empty reply)",
          timestamp: Date.now(),
          ttsUrl: null,
        };

      setMessages((prev) => [...prev, reply]);
      setLastAssistantTimestamp(reply.timestamp ?? Date.now());
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

  // Evaluate button
  async function handleEvaluate() {
    if (!sessionId || evaluating || starting || recording) return;

    setEvaluating(true);
    setInterviewEndTime(Date.now()); // stop master timer

    try {
      const res = await evaluateInterview({ sessionId });

      const text = `### Overall Evaluation\n\n${res.evaluation}\n\n---\n\n${res.explanation}`;

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: text,
          timestamp: Date.now(),
          ttsUrl: null,
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

  // Voice recording logic (user voice messages)
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
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);

        if (audioChunksRef.current.length === 0) return;

        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        const fileName = `interview-recording-${Date.now()}.webm`;
        const file = new File([audioBlob], fileName, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(audioBlob);

        const timestamp = Date.now();
        const responseTimeMs =
          lastAssistantTimestamp != null
            ? timestamp - lastAssistantTimestamp
            : null;

        setSending(true);

        setMessages((prev) => [
          ...prev,
          {
            role: "user",
            content: "[Voice message]",
            modality: "voice",
            audioUrl,
            fileName,
            timestamp,
            responseTimeMs,
          },
        ]);

        try {
          const chatResponse = await sendInterviewMessage({
            sessionId,
            content: "",
            file,
          });

          const reply =
            mapBackendMessage(chatResponse.reply) || {
              role: "assistant",
              content: "(empty reply)",
              timestamp: Date.now(),
              ttsUrl: null,
            };

          setMessages((prev) => [...prev, reply]);
          setLastAssistantTimestamp(reply.timestamp ?? Date.now());
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
      maxWidth="xl"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle
        sx={{
          pr: 6,
          pl: 3,
          display: "flex",
          alignItems: "center",
          position: "relative",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            width: "100%",
            gap: 2,
          }}
        >
          {/* Left: title */}
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            AI Interviewer — {jobTitle}
          </Typography>

          {/* spacer */}
          <Box sx={{ flexGrow: 1 }} />

          {/* Timer: just to the left of the close button */}
          {interviewStartTime && (
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                fontStyle: "italic",
                mr: 1.5,
                fontSize: "16px",
              }}
            >
              Total time: {formatDuration(masterElapsedMs)}
            </Typography>
          )}

          {/* Close button */}
          <IconButton aria-label="close" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ pt: 1, pb: 0 }}>

      {/* Options toolbar: playback speed */}
{/* Options toolbar: playback speed + show/hide interviewer text */}
<Box
  sx={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    mb: 1.5,
    px: 0.5,
  }}
>
          {/* Left: playback speed */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Typography variant="body2">Playback speed</Typography>
            <Slider
              value={playbackRate}
              onChange={(_, value) => setPlaybackRate(value)}
              step={0.25}
              min={0.5}
              max={1.5}
              sx={{ width: 160 }}
            />
            <Typography variant="caption">
              {playbackRate.toFixed(2)}x
            </Typography>
          </Box>

          {/* Right: show/hide interviewer text */}
          <FormControlLabel
            control={
              <Switch
                checked={showInterviewerText}
                onChange={(e) => setShowInterviewerText(e.target.checked)}
                size="small"
              />
            }
            label="Show interviewer text"
          />
        </Box>


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

                        {m.modality === "voice" && m.audioUrl ? (
                          // User voice message: always visible
                          <>
                            <Typography
                              variant="body2"
                              sx={{ mb: 0.5, fontStyle: "italic" }}
                            >
                              {m.content || "[Voice message]"}
                            </Typography>
                            <audio
                              controls
                              src={m.audioUrl}
                              style={{ width: "100%" }}
                              ref={(el) => {
                                if (el) {
                                  el.playbackRate = playbackRate;
                                }
                              }}
                            >
                              Your browser does not support the audio element.
                            </audio>
                          </>
                        ) : m.role === "assistant" && !showInterviewerText && m.ttsUrl ? (
                          // Assistant question with TTS: text hidden, encourage listening
                          <Typography
                            variant="body2"
                            sx={{ fontStyle: "italic", color: "text.secondary" }}
                          >
                            Interviewer text hidden — listen to the audio.
                          </Typography>
                        ) : (
                          // Default: render markdown text
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
                        )}


                          {/* user response time */}
                          {m.role === "user" && m.responseTimeMs != null && (
                            <Typography
                              variant="caption"
                              sx={{
                                display: "block",
                                mt: 0.5,
                                color: "text.secondary",
                              }}
                            >
                              Response time:{" "}
                              {formatDuration(m.responseTimeMs)}
                            </Typography>
                          )}

                          {/* assistant TTS audio player */}
                          {m.role === "assistant" && m.ttsUrl && (
                            <Box sx={{ mt: 0.5 }}>
                              <audio
                                controls
                                src={`${BASE_URL}${m.ttsUrl}`}
                                style={{ width: "100%" }}
                                ref={(el) => {
                                  if (!el) return;

                                  // always keep playback speed in sync with slider
                                  el.playbackRate = playbackRate;

                                  // Auto-play ONLY when this is the "newest" assistant message
                                  // and we haven’t auto-played this index yet
                                  if (
                                    idx === messages.length - 1 &&
                                    lastAutoPlayedIndexRef.current !== idx
                                  ) {
                                    lastAutoPlayedIndexRef.current = idx;
                                    el
                                      .play()
                                      .catch((err) =>
                                        console.warn("Could not autoplay assistant audio:", err)
                                      );
                                  }
                                }}
                              >
                                Your browser does not support the audio element.
                              </audio>
                            </Box>
                          )}



                          {m.error && (
                            <>
                              <Divider sx={{ my: 1 }} />
                              <Typography
                                variant="caption"
                                color="error"
                              >
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
          <Stack direction="row" alignItems="center" sx={{ mt: 2, p: 2 }}>
            {/* Left: Evaluate */}
            <Button
              variant="outlined"
              onClick={handleEvaluate}
              disabled={
                !sessionId || evaluating || starting || sending || recording
              }
              sx={{ borderRadius: 2, p: 2, ml: -2, mt: -2 }}
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
                !sessionId || !input.trim() || sending || starting || recording
              }
              sx={{ borderRadius: 2, p: 2, mr: -2, mt: -2 }}
            >
              Send
            </Button>
          </Stack>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
