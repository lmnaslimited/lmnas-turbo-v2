import express from "express";

const app = express();
const port = Number(process.env.RUDDER_MOCK_PORT || 4011);

app.use(express.json());
app.post("/track", (req, res) => {
  console.log("[rudder-mock] track", req.body);
  res.status(200).json({ ok: true });
});

app.listen(port, () => {
  console.log(`[rudder-mock] listening on ${port}`);
});
