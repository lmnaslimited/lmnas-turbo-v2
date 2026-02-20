import express from 'express';

const app = express();
app.get('/appointments', (_req, res) => {
  res.json({ appointments: [{ id: 'apt-1', date: '2026-01-01', provider: 'Dr. LMNAS' }] });
});

const port = Number(process.env.LENS_API_PORT || 4010);
app.listen(port, () => console.log(`lens-api mock on ${port}`));
