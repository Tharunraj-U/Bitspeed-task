import express from "express";
import cors from "cors";
import { identifyHandler } from "./routes/identify";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get("/", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Bitespeed Identity Reconciliation Service",
  });
});

// Identity reconciliation endpoint
app.post("/identify", identifyHandler);

export default app;
