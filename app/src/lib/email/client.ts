import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");
  }
  return _resend;
}
const fromEmail = process.env.RESEND_FROM_EMAIL || "debates@yourdomain.com";

export async function sendDebateInvitation({
  to,
  studentName,
  assignmentTitle,
  debateLink,
  debateDeadline,
  instructorEmail,
}: {
  to: string;
  studentName: string;
  assignmentTitle: string;
  debateLink: string;
  debateDeadline: string;
  instructorEmail?: string;
}) {
  return getResend().emails.send({
    from: fromEmail,
    to,
    subject: `Your debate for ${assignmentTitle} is ready`,
    html: `
      <p>Hi ${studentName},</p>
      <p>You've been paired with a classmate for your oral debate on the <strong>${assignmentTitle}</strong> case.</p>
      <p><strong>Join your debate here:</strong> <a href="${debateLink}">${debateLink}</a></p>
      <p><strong>Deadline to complete:</strong> ${debateDeadline}</p>
      <h3>What to expect:</h3>
      <ul>
        <li>A ~15 minute structured debate with an AI moderator</li>
        <li>You'll present your position, respond to your opponent's arguments, and answer follow-up questions</li>
        <li>Make sure you've reviewed the readings — the moderator will ask you to cite specific evidence</li>
      </ul>
      <h3>Tips:</h3>
      <ul>
        <li>Use a quiet space with a stable internet connection</li>
        <li>Have your readings accessible for reference</li>
        <li>A webcam and microphone are required</li>
      </ul>
      ${instructorEmail ? `<p>Questions? Contact <a href="mailto:${instructorEmail}">${instructorEmail}</a></p>` : ""}
    `,
  });
}

export async function sendDebateReminder({
  to,
  studentName,
  assignmentTitle,
  debateLink,
  debateDeadline,
}: {
  to: string;
  studentName: string;
  assignmentTitle: string;
  debateLink: string;
  debateDeadline: string;
}) {
  return getResend().emails.send({
    from: fromEmail,
    to,
    subject: `Reminder: Complete your debate by ${debateDeadline}`,
    html: `
      <p>Hi ${studentName},</p>
      <p>You haven't completed your debate for <strong>${assignmentTitle}</strong> yet.</p>
      <p><strong>Your debate link:</strong> <a href="${debateLink}">${debateLink}</a></p>
      <p><strong>Deadline:</strong> ${debateDeadline}</p>
      <p>Please coordinate with your partner to schedule a time.</p>
    `,
  });
}
