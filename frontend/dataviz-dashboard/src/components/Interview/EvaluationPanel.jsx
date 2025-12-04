import React, { useMemo } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Divider,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Colors
const SENTIMENT_COLORS = {
  POSITIVE: "#4caf50",
  NEGATIVE: "#f44336",
  NEUTRAL: "#9e9e9e",
};

const EMOTION_COLORS = {
  anger: "#e53935",
  disgust: "#8e24aa",
  fear: "#5e35b1",
  joy: "#ffb300",
  neutral: "#90a4ae",
  sadness: "#42a5f5",
  surprise: "#26a69a",
};

// Helper: parse "Overall score: 8.5/10" from evaluation text
function parseOverallScore(evaluationText) {
  if (!evaluationText) return null;
  const match = evaluationText.match(/Overall score:\s*([\d.]+)\s*\/\s*10/i);
  if (!match) return null;
  const score = parseFloat(match[1]);
  if (Number.isNaN(score)) return null;
  return score;
}

// Main component
export default function EvaluationPanel({ data }) {
  const {
    evaluation,
    explanation,
    sentiment_timeline = [],
    sentiment_summary = {},
  } = data || {};

  const overallScore = useMemo(
    () => parseOverallScore(evaluation),
    [evaluation]
  );

  // --- Sentiment summary data for charts ---
  const pieData = useMemo(() => {
    const counts = sentiment_summary?.counts_by_label || {};
    return Object.entries(counts).map(([label, value]) => ({
      name: label,
      value,
    }));
  }, [sentiment_summary]);

  const avgScoreData = useMemo(() => {
    const avg = sentiment_summary?.avg_sentiment_score_by_label || {};
    return Object.entries(avg).map(([label, value]) => ({
      label,
      score: value,
    }));
  }, [sentiment_summary]);

  // Timeline: only user messages with sentiment defined
  const timelineData = useMemo(
    () =>
      sentiment_timeline
        .filter((m) => m.role === "user" && m.sentiment)
        .map((m) => ({
          index: m.index,
          sentiment_score: m.sentiment.sentiment_score,
          label: m.sentiment.sentiment_label,
        })),
    [sentiment_timeline]
  );

  // Emotion data per user message
  const userEmotionBlocks = useMemo(
    () =>
      sentiment_timeline.filter(
        (m) => m.role === "user" && m.sentiment && m.sentiment.emotions
      ),
    [sentiment_timeline]
  );

  return (
    <Box sx={{ mt: 2 }}>
     
        {/* LEFT COLUMN: score + sentiment summaries */}
    
          {/* Overall score /10 */}
          <Card sx={{ mb: 2 }}>
            <CardContent
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
              }}
            >
              <Box>
                <Typography variant="h6">Overall Interview Score</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Based on the AI interviewer’s evaluation.
                </Typography>
              </Box>
              <Box
                sx={{
                  position: "relative",
                  display: "inline-flex",
                  minWidth: 90,
                  justifyContent: "center",
                }}
              >
                <CircularProgress
                  variant="determinate"
                  value={overallScore != null ? (overallScore / 10) * 100 : 0}
                  size={80}
                />
                <Box
                  sx={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    position: "absolute",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                  }}
                >
                  <Typography variant="h6" component="div">
                    {overallScore != null ? overallScore.toFixed(1) : "--"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    / 10
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Sentiment label distribution + average scores */}
          <Card sx={{ mb: 2, p: 2 }}>
            <CardContent>
              <Typography variant="h6">Sentiment Overview</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Distribution and average strength of sentiments across your answers.
              </Typography>
              <Grid container spacing={1} alignItems="center">
                <Grid item size={7}>
                  <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold'}}>
                    Label distribution
                  </Typography>
                  <Box sx={{ width: "100%", height: 250 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          outerRadius={80}
                          label={({ name, value }) => `${name} (${value})`}
                        >
                          {pieData.map((entry, index) => (
                            <Cell
                              key={index}
                              fill={SENTIMENT_COLORS[entry.name] || SENTIMENT_COLORS.NEUTRAL}
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                </Grid>

                <Grid item size={5}>
                  <Typography variant="subtitle1"  sx={{ mb: 1, fontWeight: 'bold'}}>
                    Average sentiment score
                  </Typography>
                  <Box sx={{ width: "100%", height: 250 }}>
                    <ResponsiveContainer>
                      <BarChart data={avgScoreData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="label" />
                        <YAxis domain={[0, 1]} />
                        <Tooltip />
                        <Bar dataKey="score">
                          {avgScoreData.map((entry, index) => (
                            <Cell
                              key={index}
                              fill={SENTIMENT_COLORS[entry.label] || SENTIMENT_COLORS.NEUTRAL}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>


          {/* Timeline of user sentiment */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6">Sentiment Timeline (User Answers)</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                How the sentiment of your responses changed across the interview.
              </Typography>
              <Box sx={{ width: "100%", height: 220 }}>
                <ResponsiveContainer>
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="index"
                      label={{ value: "Message index", position: "insideBottom", dy: 10 }}
                    />
                    <YAxis
                      domain={[0, 1]}
                      label={{
                        value: "Sentiment score",
                        angle: -90,
                        position: "insideLeft",
                      }}
                    />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="sentiment_score"
                      stroke="#1976d2"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        
        {/* RIGHT COLUMN: evaluation text + emotion details */}

          {/* Evaluation markdown */}
          <Card sx={{ mb: 2, maxHeight: 320, overflowY: "auto" }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Detailed Evaluation
              </Typography>
              <Typography
                variant="body2"
                component="div"
                sx={{
                  "& h2, & h3, & h4": { fontWeight: 600, mt: 1.5, mb: 0.5 },
                  "& ul": { pl: 3, mb: 1 },
                  "& li": { mb: 0.5 },
                }}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {evaluation || "No evaluation text available."}
                </ReactMarkdown>
              </Typography>
            </CardContent>
          </Card>

          {/* Emotion breakdown per user message */}
          <Card>
            <CardContent>
              <Typography variant="h6">Emotion Breakdown (User Answers)</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                For each of your responses, see how the model interpreted your emotions.
              </Typography>

              {userEmotionBlocks.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No emotion data available.
                </Typography>
              ) : (
                userEmotionBlocks.map((m) => {
                  const emotions = m.sentiment.emotions || [];
                  const chartData = emotions.map((e) => ({
                    emotion: e.label,
                    score: e.score,
                  }));

                  return (
                    <Accordion key={m.index} sx={{ mb: 0.5 }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            width: "100%",
                            gap: 0.5,
                          }}
                        >
                          <Typography variant="subtitle2">
                            User message #{m.index}
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            
                          >
                            {m.content}
                          </Typography>
                          <Box sx={{ mt: 0.5 }}>
                            <Chip
                              size="small"
                              label={`Sentiment: ${m.sentiment.sentiment_label} (${m.sentiment.sentiment_score.toFixed(
                                3
                              )})`}
                              sx={{
                                bgcolor:
                                  SENTIMENT_COLORS[m.sentiment.sentiment_label] +
                                  "20",
                                color: SENTIMENT_COLORS[m.sentiment.sentiment_label],
                              }}
                            />
                          </Box>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Box sx={{ width: "100%", height: 200 }}>
                          <ResponsiveContainer>
                            <BarChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="emotion" />
                              <YAxis domain={[0, 1]} />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="score" name="Intensity">
                                {chartData.map((entry, index) => (
                                  <Cell
                                    key={index}
                                    fill={EMOTION_COLORS[entry.emotion] || "#90a4ae"}
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  );
                })
              )}
            </CardContent>
          </Card>
  
    </Box>
  );
}
