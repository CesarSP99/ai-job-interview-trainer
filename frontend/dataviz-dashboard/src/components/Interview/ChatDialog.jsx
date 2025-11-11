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
import {
  startInterviewSession,
  sendInterviewMessage,
  getInterviewReply,
} from "../../utils/interviewApi";

export default function ChatDialog({ open, onClose, job }) {
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [starting, setStarting] = useState(false);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  // Autoscroll to the last message
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  // Start session when the dialog opens
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (!open) return;
      setStarting(true);
      try {
        const res = await startInterviewSession({
          jobId: job?.id ?? job?._id ?? job?.jobId ?? null,
          jobTitle: job?.title ?? job?.jobTitle ?? "Unknown Role",
        });
        if (!cancelled) {
          setSessionId(res.sessionId);
          // Seed with a friendly system/assistant intro (optional: backend can also send it)
          setMessages([
            {
              role: "assistant",
              content: `Hi! I’m your AI interviewer for "${job?.title ?? "this role"}". I’ll ask questions like a real interview and give feedback. Ready to start?`,
              timestamp: Date.now(),
            },
          ]);
        }
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
    boot();
    return () => {
      cancelled = true;
      setSessionId(null);
      setMessages([]);
      setInput("");
    };
  }, [open, job]);

  const jobTitle = useMemo(
    () => job?.title ?? job?.jobTitle ?? "Job Interview",
    [job]
  );

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || !sessionId || sending) return;

    setSending(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: trimmed, timestamp: Date.now() },
    ]);
    setInput("");

    try {
      // 1) POST user message
      const { messageId } = await sendInterviewMessage({
        sessionId,
        content: trimmed,
      });

      // 2) GET assistant reply
      const reply = await getInterviewReply({
        sessionId,
        forMessageId: messageId,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: reply.role || "assistant",
          content: reply.content || "(empty reply)",
          timestamp: reply.timestamp || Date.now(),
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
                            color: m.role === "user" ? "text.secondary" : "#005dab",
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
                              m.role === "user" ? "background.paper" : "rgba(0,93,171,0.06)",
                            border:
                              m.role === "user"
                                ? "1px solid rgba(0,0,0,0.08)"
                                : "1px solid rgba(0,93,171,0.18)",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                          }}
                        >
                          <Typography variant="body2">{m.content}</Typography>
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
                        <Typography variant="body2">Waiting for reply…</Typography>
                      </Stack>
                    }
                  />
                </ListItem>
              )}
            </List>
          )}
        </Box>

        {/* Composer */}
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
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
            <Button
              onClick={handleSend}
              variant="contained"
              endIcon={<SendIcon />}
              disabled={!sessionId || !input.trim() || sending || starting}
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
