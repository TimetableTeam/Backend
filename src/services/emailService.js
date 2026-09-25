'use strict';

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendEmail({ to, subject, text, html }) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP credentials are not configured.');
  }

  return transporter.sendMail({
    from: `"Tanseek Time Table" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html,
  });
}

async function sendPasswordResetCode(to, code) {
  return sendEmail({
    to,
    subject: 'Tanseek - Password Reset Code',
    text: `Your password reset code is: ${code}\n\nThis code will expire soon.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>Tanseek Time Table</h2>
        <p>Your password reset code is:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:20px 0;">
          ${code}
        </div>
        <p>This code will expire soon.</p>
        <p>If you did not request a password reset, you can ignore this email.</p>
      </div>
    `,
  });
}

module.exports = {
  sendEmail,
  sendPasswordResetCode,
};