import express from "express";
import cors from "cors";
import { apiRouter } from "./api/routes.js";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

app.use(cors());
app.use(express.json());

// Mount API router
app.use("/api", apiRouter);

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(` PacketPilot Diagnostic API Server`);
  console.log(` Listening on: http://localhost:${PORT}`);
  console.log(` Health check: http://localhost:${PORT}/health`);
  console.log(`==================================================\n`);
});
