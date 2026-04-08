import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  getDoc, 
  doc, 
  updateDoc 
} from "firebase/firestore";
import fs from "fs";

// Load Firebase config
const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));

// Initialize Firebase Client SDK
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

const app = express();
app.use(express.json());
const PORT = 3000;

// Email Simulation Function
async function sendEmail(to: string, subject: string, body: string) {
  console.log(`[EMAIL SIMULATION] To: ${to}`);
  console.log(`[EMAIL SIMULATION] Subject: ${subject}`);
  console.log(`[EMAIL SIMULATION] Body: \n${body}`);
  console.log('-----------------------------------');
}

// API: Notify assignment creation
app.post("/api/notify-assignment", async (req, res) => {
  const { assignmentId, lessonTitle, studentEmails, deadline, teacherName, passingPercentage } = req.body;
  const targetPercent = passingPercentage || 80;

  try {
    for (const email of studentEmails) {
      const body = `Chào bạn,
      
Giáo viên ${teacherName} vừa giao bài tập mới cho bạn:
- Tên bài tập: ${lessonTitle}
- Thời hạn làm bài: ${new Date(deadline).toLocaleString('vi-VN')}
- Yêu cầu tối thiểu: chính xác đạt ${targetPercent}%

Hãy đăng nhập vào hệ thống để hoàn thành bài tập đúng hạn nhé!
Chúc bạn học tốt.`;

      await sendEmail(email, `[Bài tập mới] ${lessonTitle}`, body);
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Error sending notifications:", error);
    res.status(500).json({ error: "Failed to send notifications" });
  }
});

// Background Task: Check for reminders (runs every 5 minutes)
setInterval(async () => {
  console.log("[REMINDER TASK] Checking for upcoming deadlines...");
  const now = new Date();
  const fourHoursFromNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  
  try {
    // 1. Find assignments with deadline within the next 4 hours
    const assignmentsRef = collection(db, "assignments");
    const q = query(
      assignmentsRef,
      where("deadline", ">", now.toISOString()),
      where("deadline", "<=", fourHoursFromNow.toISOString())
    );
    
    const snapshot = await getDocs(q);
    
    for (const assignmentDoc of snapshot.docs) {
      const assignment = assignmentDoc.data();
      const assignmentId = assignmentDoc.id;
      
      // Check if we already sent a reminder for this assignment
      if (assignment.reminderSent) continue;

      // Get lesson title
      const lessonRef = doc(db, "lessons", assignment.lessonId);
      const lessonSnap = await getDoc(lessonRef);
      const lessonTitle = lessonSnap.exists() ? lessonSnap.data()?.title : "Bài tập";

      // For each student, check if they completed it with required score
      const targetPercent = assignment.passingPercentage || 80;
      const targetScore = (targetPercent / 100) * 10;

      for (const email of assignment.studentEmails) {
        const resultsRef = collection(db, "results");
        const resultsQuery = query(
          resultsRef,
          where("assignmentId", "==", assignmentId),
          where("studentEmail", "==", email)
        );
        
        const resultsSnap = await getDocs(resultsQuery);
          
        const bestScore = resultsSnap.docs.reduce((max, d) => Math.max(max, d.data().score), 0);
        
        if (bestScore < targetScore) {
          // Send reminder
          const body = `Chào bạn,
          
Đây là tin nhắn nhắc nhở về bài tập: ${lessonTitle}.
Thời hạn làm bài chỉ còn chưa đầy 4 giờ nữa (Hạn cuối: ${new Date(assignment.deadline).toLocaleString('vi-VN')}).

Hiện tại bạn vẫn chưa hoàn thành bài tập hoặc chưa đạt mục tiêu ${targetPercent}%.
Hãy nhanh chóng hoàn thành bài tập để đảm bảo tiến độ học tập nhé!`;

          await sendEmail(email, `[NHẮC NHỞ] Sắp hết hạn bài tập: ${lessonTitle}`, body);
        }
      }
      
      // Mark reminder as sent
      await updateDoc(doc(db, "assignments", assignmentId), {
        reminderSent: true
      });
    }
  } catch (error) {
    console.error("Error in reminder task:", error);
  }
}, 5 * 60 * 1000); // 5 minutes

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
