// pages/InterviewEvaluationPage.jsx
import React, { useEffect, useState } from "react";
import { Button, Box, Typography, Container } from "@mui/material";
import EvaluationPanel from "../components/Interview/EvaluationPanel";

export default function InterviewEvaluationPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("interviewEvaluationData");
      if (raw) {
        setData(JSON.parse(raw));
      }
    } catch (e) {
      console.error("Failed to read evaluation data:", e);
    }
  }, []);

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Interview Evaluation
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        This view shows your interview score, sentiment analysis, and emotion breakdown.
      </Typography>

      {data ? (
        <EvaluationPanel data={data} />
      ) : (
        <Box sx={{ mt: 4 }}>
          <Typography variant="body1">
            No evaluation data found. Please run an interview evaluation first.
          </Typography>
        </Box>
      )}
      {/* Open external link button */}
        <Box sx={{ mt: 3, textAlign: "center" }}>
        <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={() => {
            window.open("https://docs.google.com/forms/d/e/1FAIpQLSfLdHSSwOqawASLDSKibBaOH2a-qmONMAnZ7I0NA1fd7otVMg/viewform", "_blank", "noopener,noreferrer");
            }}
            sx={{ borderRadius: 2, px: 4, py: 1.5 }}
        >
            Rate your Experience
        </Button>
        </Box>
    </Container>
  );
}
