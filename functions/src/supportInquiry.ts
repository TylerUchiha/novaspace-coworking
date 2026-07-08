import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from './db';
import { MAIL_FROM, SUPPORT_EMAIL } from './contact';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const submitSupportInquiry = onCall({ cors: true }, async (request) => {
  const name = typeof request.data?.name === 'string' ? request.data.name.trim() : '';
  const number = typeof request.data?.number === 'string' ? request.data.number.replace(/\D/g, '') : '';
  const email = typeof request.data?.email === 'string' ? request.data.email.trim() : '';
  const inquiry = typeof request.data?.inquiry === 'string' ? request.data.inquiry.trim() : '';

  if (!name || name.length < 2) {
    throw new HttpsError('invalid-argument', 'Please enter your name.');
  }
  if (number.length !== 11) {
    throw new HttpsError('invalid-argument', 'Please enter exactly 11 digits for your phone number.');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError('invalid-argument', 'Please enter a valid email address.');
  }
  if (!inquiry || inquiry.length < 10) {
    throw new HttpsError('invalid-argument', 'Please describe your inquiry in at least 10 characters.');
  }

  await db.collection('mail').add({
    to: SUPPORT_EMAIL,
    from: MAIL_FROM,
    replyTo: email,
    message: {
      subject: `NovaSpace support inquiry from ${name}`,
      text: [
        `Name: ${name}`,
        `Phone: ${number}`,
        `Email: ${email}`,
        '',
        inquiry,
      ].join('\n'),
      html: `
        <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #0f172a; margin-bottom: 16px;">New support inquiry</h2>
          <p style="color: #475569; margin: 0 0 8px;"><strong>Name:</strong> ${escapeHtml(name)}</p>
          <p style="color: #475569; margin: 0 0 8px;"><strong>Phone:</strong> ${escapeHtml(number)}</p>
          <p style="color: #475569; margin: 0 0 16px;"><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p style="color: #334155; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(inquiry)}</p>
        </div>
      `,
    },
  });

  return { success: true };
});
