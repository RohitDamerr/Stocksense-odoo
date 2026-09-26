'use strict';

/**
 * Email service — swappable transport interface.
 *
 * The stub logs to console in development. To plug in a real provider
 * (Nodemailer + SMTP, SendGrid, AWS SES, Resend…), replace the `_send`
 * implementation below without touching any call sites.
 *
 * All public methods accept a plain options object and return a Promise
 * so callers are provider-agnostic.
 */

const env = require('../config/env');

// ─── Internal transport ───────────────────────────────────────────────────────

/**
 * Low-level send.  Replace this function body to swap providers.
 *
 * @param {{ to: string, subject: string, text: string, html?: string }} mail
 * @returns {Promise<void>}
 */
async function _send({ to, subject, text, html }) {
  if (env.NODE_ENV === 'production') {
    // TODO: wire up a real transport, e.g.:
    //
    //   const nodemailer = require('nodemailer');
    //   const transporter = nodemailer.createTransport({
    //     host: env.SMTP_HOST, port: env.SMTP_PORT,
    //     auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    //   });
    //   await transporter.sendMail({ from: env.EMAIL_FROM, to, subject, text, html });
    //
    throw new Error('Email transport not configured for production');
  }

  // Development stub — log to console, never actually send
  console.log('\n📧  [EMAIL STUB] ─────────────────────────────');
  console.log(`  To:      ${to}`);
  console.log(`  From:    ${env.EMAIL_FROM}`);
  console.log(`  Subject: ${subject}`);
  console.log(`  Body:\n${text}`);
  console.log('─────────────────────────────────────────────\n');
}

// ─── Public interface ─────────────────────────────────────────────────────────

/**
 * Send a password-reset OTP to the user.
 *
 * @param {{ to: string, name: string, otp: string }} opts
 */
async function sendPasswordResetOtp({ to, name, otp }) {
  const subject = 'StockSense — Your password reset code';
  const text = [
    `Hi ${name},`,
    '',
    `Your password reset code is: ${otp}`,
    '',
    'This code expires in 10 minutes.',
    'If you did not request a password reset, please ignore this email.',
    '',
    '— The StockSense Team',
  ].join('\n');

  const html = `
    <p>Hi <strong>${name}</strong>,</p>
    <p>Your password reset code is:</p>
    <h2 style="letter-spacing:4px">${otp}</h2>
    <p>This code expires in <strong>10 minutes</strong>.</p>
    <p>If you did not request a password reset, you can safely ignore this email.</p>
  `;

  await _send({ to, subject, text, html });
}

module.exports = { sendPasswordResetOtp };
