export interface AssignmentEmailData {
  studentName?: string;
  className: string;
  lessonTitle: string;
  lessonLink: string;
  passingPercentage: number; // scale 100
  deadline: string; // ISO
  teacherName: string;
}

export interface ReminderEmailData {
  studentName?: string;
  className: string;
  lessonTitle: string;
  lessonLink: string;
  passingPercentage: number;
  deadline: string;
  teacherName: string;
  currentScore?: number; // scale 10, optional
  hasAttempted: boolean;
}

const formatDate = (isoString: string) => {
  return new Date(isoString).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export const buildAssignmentEmail = (data: AssignmentEmailData) => {
  const formattedDeadline = formatDate(data.deadline);
  const subject = `📚 Giao bài về nhà mới: ${data.className}`;
  
  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #334155; line-height: 1.6;">
      <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 40px 20px; border-radius: 24px 24px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.025em;">English Skills AI</h1>
        <p style="color: #e0e7ff; margin: 10px 0 0 0; font-weight: 500;">Thông báo giao bài tập mới</p>
      </div>
      
      <div style="background: white; padding: 40px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 24px 24px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
        <p style="font-size: 18px; margin-top: 0;">Chào <strong>${data.studentName || 'bạn'}</strong>,</p>
        <p>Cô <strong>${data.teacherName}</strong> vừa giao một bài tập mới cho lớp <strong>${data.className}</strong>. Hãy hoàn thành bài tập trước thời hạn nhé!</p>
        
        <div style="background: #f8fafc; border-radius: 16px; padding: 24px; margin: 30px 0; border: 1px dashed #cbd5e1;">
          <div style="margin-bottom: 15px;">
            <span style="display: block; font-size: 10px; font-weight: 900; color: #64748b; text-transform: uppercase; tracking: 0.1em; margin-bottom: 4px;">Tên bài tập</span>
            <span style="font-size: 18px; font-weight: 800; color: #1e293b;">${data.lessonTitle}</span>
          </div>
          
          <div style="margin-bottom: 15px;">
            <span style="display: block; font-size: 10px; font-weight: 900; color: #64748b; text-transform: uppercase; tracking: 0.1em; margin-bottom: 4px;">Yêu cầu đạt</span>
            <span style="font-size: 16px; font-weight: 700; color: #059669;">${data.passingPercentage}% (${(data.passingPercentage/10).toFixed(1)}/10 điểm)</span>
          </div>
          
          <div>
            <span style="display: block; font-size: 10px; font-weight: 900; color: #64748b; text-transform: uppercase; tracking: 0.1em; margin-bottom: 4px;">Hạn chót (Deadline)</span>
            <span style="font-size: 16px; font-weight: 700; color: #dc2626;">${formattedDeadline}</span>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 40px;">
          <a href="${data.lessonLink}" style="background: #4f46e5; color: white; padding: 16px 32px; border-radius: 12px; font-weight: 700; text-decoration: none; display: inline-block; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.4);">🚀 Bắt đầu làm bài ngay</a>
        </div>
        
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 40px; border-top: 1px solid #f1f5f9; pt: 20px;">
          Nếu nút không hoạt động, bạn có thể copy link sau: <br>
          <a href="${data.lessonLink}" style="color: #6366f1;">${data.lessonLink}</a>
        </p>
      </div>
    </div>
  `;

  return { subject, html, text: `Chào ${data.studentName || 'bạn'}, Cô ${data.teacherName} vừa giao bài tập "${data.lessonTitle}" cho lớp ${data.className}. Hạn chót: ${formattedDeadline}. Link: ${data.lessonLink}` };
};

export const buildReminderEmail = (data: ReminderEmailData) => {
  const formattedDeadline = formatDate(data.deadline);
  const subject = `⏰ Nhắc nhở: Sắp tới hạn chót bài tập ${data.className}`;
  
  const statusMessage = data.hasAttempted 
    ? `Bạn đã làm bài nhưng điểm hiện tại (<strong>${data.currentScore}/10</strong>) chưa đạt yêu cầu (<strong>${(data.passingPercentage/10).toFixed(1)}/10</strong>).`
    : `Bạn chưa hoàn thành bài tập này.`;

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #334155; line-height: 1.6;">
      <div style="background: linear-gradient(135deg, #ef4444 0%, #f97316 100%); padding: 40px 20px; border-radius: 24px 24px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.025em;">English Skills AI</h1>
        <p style="color: #fee2e2; margin: 10px 0 0 0; font-weight: 500;">Cảnh báo sắp hết hạn nộp bài</p>
      </div>
      
      <div style="background: white; padding: 40px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 24px 24px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
        <p style="font-size: 18px; margin-top: 0;">Chào <strong>${data.studentName || 'bạn'}</strong>,</p>
        
        <div style="background: #fef2f2; border: 1px solid #fee2e2; padding: 20px; border-radius: 16px; color: #991b1b; font-weight: 500; margin-bottom: 25px;">
          ⚠️ ${statusMessage} Hãy hoàn thành sớm để không bị trễ hạn nhé!
        </div>

        <p>Chi tiết bài tập của lớp <strong>${data.className}</strong>:</p>
        
        <div style="background: #f8fafc; border-radius: 16px; padding: 24px; margin: 30px 0; border: 1px dashed #cbd5e1;">
          <div style="margin-bottom: 15px;">
            <span style="display: block; font-size: 10px; font-weight: 900; color: #64748b; text-transform: uppercase; tracking: 0.1em; margin-bottom: 4px;">Tên bài tập</span>
            <span style="font-size: 18px; font-weight: 800; color: #1e293b;">${data.lessonTitle}</span>
          </div>
          
          <div>
            <span style="display: block; font-size: 10px; font-weight: 900; color: #64748b; text-transform: uppercase; tracking: 0.1em; margin-bottom: 4px;">Hạn chót (Deadline)</span>
            <span style="font-size: 16px; font-weight: 700; color: #dc2626;">${formattedDeadline} (Còn khoảng 4 tiếng)</span>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 40px;">
          <a href="${data.lessonLink}" style="background: #ef4444; color: white; padding: 16px 32px; border-radius: 12px; font-weight: 700; text-decoration: none; display: inline-block; box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.4);">
            ${data.hasAttempted ? '🔄 Làm lại bài ngay' : '🚀 Bắt đầu làm bài ngay'}
          </a>
        </div>
        
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 40px; border-top: 1px solid #f1f5f9; pt: 20px;">
          Mọi thắc mắc vui lòng liên hệ cô <strong>${data.teacherName}</strong>.
        </p>
      </div>
    </div>
  `;

  return { subject, html, text: `Nhắc nhở: Bài tập "${data.lessonTitle}" sắp hết hạn vào lúc ${formattedDeadline}. Link: ${data.lessonLink}` };
};
