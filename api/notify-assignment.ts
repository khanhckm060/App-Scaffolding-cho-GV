import { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from './_lib/firebaseAdmin.js';
import { sendEmailBatch } from './_lib/resend.js';
import { buildAssignmentEmail } from './_lib/emailTemplates.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    assignmentId,
    lessonId,
    lessonTitle,
    className,
    studentEmails,
    deadline,
    passingPercentage,
    teacherName,
    teacherEmail,
    appBaseUrl
  } = req.body;

  if (!assignmentId || !lessonId || !studentEmails || !deadline) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  console.log(`[notify-assignment] Processing assignment ${assignmentId} for ${studentEmails.length} students`);

  try {
    const db = getDb();
    const baseUrl = appBaseUrl || `https://${req.headers.host}`;
    const lessonLink = `${baseUrl}/lesson/${lessonId}?assignmentId=${assignmentId}`;

    // Get student names from Firestore mapping
    // Firestore limited to 30 for 'in' queries
    const limitedEmails = studentEmails.slice(0, 30);
    const studentsRef = db.collection('students');
    const studentDocs = await studentsRef.where('email', 'in', limitedEmails.map((e: string) => e.toLowerCase().trim())).get();
    
    const studentNameMap = new Map();
    studentDocs.forEach(doc => {
      const data = doc.data();
      studentNameMap.set(data.email.toLowerCase().trim(), data.name);
    });

    const emailsToSend = studentEmails.map((email: string) => {
      const normalizedEmail = email.toLowerCase().trim();
      const studentName = studentNameMap.get(normalizedEmail);
      
      const emailContent = buildAssignmentEmail({
        studentName,
        className,
        lessonTitle,
        lessonLink,
        passingPercentage: passingPercentage || 80,
        deadline,
        teacherName
      });

      return {
        to: normalizedEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        replyTo: teacherEmail
      };
    });

    const result = await sendEmailBatch(emailsToSend);

    // Update assignment with notification status
    await db.collection('assignments').doc(assignmentId).update({
      notificationSent: true,
      notificationSentAt: new Date().toISOString(),
      notificationStats: {
        sent: result.sent,
        failed: result.failed
      }
    });

    return res.status(200).json({
      success: true,
      sent: result.sent,
      failed: result.failed,
      errors: result.errors.slice(0, 10)
    });
  } catch (error) {
    console.error('[notify-assignment] Critical error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal Server Error' 
    });
  }
}
