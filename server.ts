import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

// Load Firebase config for Client (if needed) or Project ID for Admin
let firebaseConfig: any;
try {
  firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
} catch (e) {
  console.error("Failed to load firebase-applet-config.json", e);
}

// Initialize Firebase Admin SDK
if (firebaseConfig && (!admin.apps || admin.apps.length === 0)) {
  try {
    admin.initializeApp({
      projectId: firebaseConfig.projectId,
    });
    console.log("Firebase Admin initialized for project:", firebaseConfig.projectId);
  } catch (e) {
    console.error("Firebase Admin initialization failed", e);
  }
}

// Target specific database if provided
const db = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(admin.apps[0], firebaseConfig.firestoreDatabaseId)
  : getFirestore(admin.apps[0]);

const app = express();
app.use(express.json());
const PORT = 3000;

/*
// Email Configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});
*/

// Mock Email Function (Disabled)
async function sendEmail(to: string, subject: string, body: string, teacherName: string = "Hệ thống Học tập") {
  console.log(`[EMAIL BYPASSED] To: ${to}, Subject: ${subject}`);
}

import notifyAssignmentHandler from "./api/notify-assignment";
import cronReminderHandler from "./api/cron-reminder";

// API: Notify assignment creation
app.post("/api/notify-assignment", async (req, res) => {
  try {
    await notifyAssignmentHandler(req as any, res as any);
  } catch (error) {
    console.error("API Route Error:", error);
    res.status(500).json({ error: "Internal Server Error in local dev relay" });
  }
});

// API: Trigger reminders (Vercel Cron equivalent for local testing)
app.get("/api/cron-reminder", async (req, res) => {
  try {
    await cronReminderHandler(req as any, res as any);
  } catch (error) {
    console.error("API Route Error:", error);
    res.status(500).json({ error: "Internal Server Error in local dev relay" });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false, // Explicitly disable HMR to avoid port 24678 conflicts
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
