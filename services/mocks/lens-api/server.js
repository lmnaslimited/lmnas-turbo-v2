import express from "express";

const app = express();
const port = Number(process.env.LENS_MOCK_PORT || 4010);

app.get("/appointments", (_req, res) => {
  res.json({
    appointments: [
      { id: "apt-100", clinician: "Dr. Singh", startsAt: "2026-02-21T09:00:00Z" },
      { id: "apt-101", clinician: "Dr. Rivera", startsAt: "2026-02-21T10:30:00Z" }
    ]
  });
});

app.listen(port, () => {
  console.log(`[lens-api-mock] listening on ${port}`);
});
