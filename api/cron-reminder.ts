import { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb, admin } from './_lib/firebaseAdmin';
import { sendEmailBatch } from './_lib/resend';
import { buildReminderEmail } from './_lib/emailTemplates';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Cron security check
  const authHeader = req.headers.authorization;
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // In local dev, we might want to bypass this, but for production it's critical
    if (process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() + 3 * 60 * 60 * 1000); // +3 hours
  const windowEnd = new Date(now.getTime() + 5 * 60 * 60 * 1000);   // +5 hours

  console.log(`[cron-reminder] Checking deadlines between ${windowStart.toISOString()} and ${windowEnd.toISOString()}`);

  try {
    const db = getDb();
    const assignmentsRef = db.collection('assignments');
    
    const snapshot = await assignmentsRef
      .where('deadline', '>=', windowStart.toISOString())
      .where('deadline', '<=', windowEnd.toISOString())
      .get();

    if (snapshot.empty) {
      return res.status(200).json({ success: true, message: 'No assignments in deadline window', checkedAt: now.toISOString() });
    }

    let totalSent = 0;
    let totalFailed = 0;
    let assignmentsProcessed = 0;
    const errors: string[] = [];
    
    // Teacher cache to avoid multiple auth queries
    const teacherCache = new Map();

    for (const doc of snapshot.docs) {
      const assignment = { id: doc.id, ...doc.data() } as any;

      // Skip if already sent
      if (assignment.reminderSent) continue;

      assignmentsProcessed++;
      
      try {
        // Query results for this assignment
        const resultsRef = db.collection('results');
        const resultsSnap = await resultsRef.where('assignmentId', '==', assignment.id).get();
        
        const emailToBestScore = new Map<string, number>();
        resultsSnap.forEach(rDoc => {
          const rData = rDoc.data();
          const email = rData.studentEmail.toLowerCase().trim();
          const currentBest = emailToBestScore.get(email) || 0;
          if (rData.score > currentBest) {
            emailToBestScore.set(email, rData.score);
          }
        });

        const passingScore = (assignment.passingPercentage || 80) / 10;
        const studentsToRemind = assignment.studentEmails.filter((email: string) => {
          const normEmail = email.toLowerCase().trim();
          const bestScore = emailToBestScore.get(normEmail);
          
          if (bestScore === undefined) return true; // Hasn't attempted
          return bestScore < passingScore; // Attempted but failed requirement
        });

        if (studentsToRemind.length === 0) {
          await doc.ref.update({ reminderSent: true, reminderSentAt: new Date().toISOString() });
          continue;
        }

        // Get teacher info
        let teacherInfo = teacherCache.get(assignment.teacherId);
        if (!teacherInfo) {
          try {
            const userRecord = await admin.auth().getUser(assignment.teacherId);
            teacherInfo = {
              name: userRecord.displayName || 'Giáo viên',
              email: userRecord.email
            };
            teacherCache.set(assignment.teacherId, teacherInfo);
          } catch (e) {
            console.warn(`[cron-reminder] Could not get teacher auth info for ${assignment.teacherId}`, e);
            teacherInfo = { name: 'Giáo viên', email: null };
          }
        }

        // Get student names
        const namesSnapshot = await db.collection('students')
          .where('email', 'in', studentsToRemind.slice(0, 30))
          .get();
        
        const nameMap = new Map();
        namesSnapshot.forEach(sDoc => {
          const sData = sDoc.data();
          nameMap.set(sData.email.toLowerCase().trim(), sData.name);
        });

        const baseUrl = process.env.APP_BASE_URL || `https://${req.headers.host}`;
        const lessonLink = `${baseUrl}/lesson/${assignment.lessonId}?assignmentId=${assignment.id}`;

        const emailsToSend = studentsToRemind.map((email: string) => {
          const normEmail = email.toLowerCase().trim();
          const bestScore = emailToBestScore.get(normEmail);
          const hasAttempted = bestScore !== undefined;

          const content = buildReminderEmail({
            studentName: nameMap.get(normEmail),
            className: assignment.className || 'Lớp học',
            lessonTitle: assignment.lessonTitle || 'Bài tập',
            lessonLink,
            passingPercentage: assignment.passingPercentage || 80,
            deadline: assignment.deadline,
            teacherName: teacherInfo.name,
            currentScore: bestScore,
            hasAttempted
          });

          return {
            to: normEmail,
            subject: content.subject,
            html: content.html,
            text: content.text,
            replyTo: teacherInfo.email
          };
        });

        const batchResult = await sendEmailBatch(emailsToSend);
        totalSent += batchResult.sent;
        totalFailed += batchResult.failed;
        if (batchResult.errors.length > 0) errors.push(...batchResult.errors);

        await doc.ref.update({
          reminderSent: true,
          reminderSentAt: new Date().toISOString(),
          reminderStats: {
            toRemind: studentsToRemind.length,
            sent: batchResult.sent,
            failed: batchResult.failed
          }
        });

      } catch (innerError) {
        console.error(`[cron-reminder] Error processing assignment ${assignment.id}:`, innerError);
        errors.push(`Assignment ${assignment.id}: ${innerError instanceof Error ? innerError.message : String(innerError)}`);
      }
    }

    return res.status(200).json({
      success: true,
      checkedAt: now.toISOString(),
      assignmentsProcessed,
      totalSent,
      totalFailed,
      errors: errors.slice(0, 20)
    });

  } catch (error) {
    console.error('[cron-reminder] Critical top-level error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal Server Error' });
  }
}
