import express from 'express';

const app = express();
app.use(express.json());
app.post('/track', (req, res) => {
  console.log('rudder-track', req.body);
  res.status(200).json({ ok: true });
});

const port = Number(process.env.RUDDER_PORT || 4011);
app.listen(port, () => console.log(`rudder mock on ${port}`));
