import nodemailer from 'nodemailer';
import imaps from 'imap-simple';
import axios from 'axios';

/**
 * Gmail MCP Service
 * Implements Model Context Protocol tools for Gmail integration:
 * - testGmailConnection: validates credentials (App Password or OAuth Token)
 * - checkRecentEmails: retrieves recent emails from Inbox
 * - sendEmail: composes and sends emails via AI
 * - searchEmails: searches emails by query/keyword
 */

/**
 * Test Gmail connection
 * Supports:
 * 1. Google App Password (via SMTP / IMAP)
 * 2. OAuth Bearer Token (via Gmail REST API)
 */
export async function testGmailConnection(config = {}) {
  const { email, appPassword, oauthToken } = config;

  // 1. Check OAuth Token if provided
  if (oauthToken && oauthToken.trim()) {
    try {
      const res = await axios.get('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${oauthToken.trim()}` },
        timeout: 10000
      });
      return {
        success: true,
        type: 'oauth',
        email: res.data.emailAddress,
        messagesTotal: res.data.messagesTotal,
        threadsTotal: res.data.threadsTotal
      };
    } catch (err) {
      return {
        success: false,
        type: 'oauth',
        error: err.response?.data?.error?.message || err.message
      };
    }
  }

  // 2. Check App Password via Nodemailer SMTP verify
  if (!email || !appPassword) {
    return {
      success: false,
      error: 'Gmail address and App Password (or OAuth token) are required'
    };
  }

  // Clean app password (remove spaces if user copied "xxxx yyyy zzzz wwww")
  const cleanPass = appPassword.replace(/\s+/g, '').trim();

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: email.trim(),
        pass: cleanPass
      }
    });

    await transporter.verify();

    return {
      success: true,
      type: 'app_password',
      email: email.trim(),
      message: 'SMTP connection verified successfully'
    };
  } catch (err) {
    return {
      success: false,
      type: 'app_password',
      error: `Gmail authentication failed: ${err.message}. Please ensure 2-Step Verification is on and use a 16-character Google App Password.`
    };
  }
}

/**
 * Check recent emails from Inbox
 */
export async function checkRecentEmails(config = {}, limit = 5) {
  const { email, appPassword, oauthToken } = config;

  // 1. Via OAuth REST API if token available
  if (oauthToken && oauthToken.trim()) {
    try {
      const listRes = await axios.get('https://gmail.googleapis.com/gmail/v1/users/me/messages', {
        headers: { Authorization: `Bearer ${oauthToken.trim()}` },
        params: { maxResults: Math.min(limit, 15), labelIds: 'INBOX' },
        timeout: 10000
      });

      const messageList = listRes.data.messages || [];
      const messages = [];

      for (const m of messageList.slice(0, limit)) {
        try {
          const detailRes = await axios.get(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}`, {
            headers: { Authorization: `Bearer ${oauthToken.trim()}` },
            params: { format: 'metadata', metadataHeaders: ['Subject', 'From', 'Date'] },
            timeout: 8000
          });
          const headers = detailRes.data.payload?.headers || [];
          const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

          messages.push({
            id: m.id,
            threadId: m.threadId,
            from: getHeader('From'),
            subject: getHeader('Subject') || '(No Subject)',
            date: getHeader('Date'),
            snippet: detailRes.data.snippet || ''
          });
        } catch (detailErr) {
          // ignore single message error
        }
      }

      return { success: true, count: messages.length, emails: messages };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  }

  // 2. Via IMAP with App Password
  if (!email || !appPassword) {
    return { success: false, error: 'Gmail credentials not configured' };
  }

  const cleanPass = appPassword.replace(/\s+/g, '').trim();

  const imapConfig = {
    imap: {
      user: email.trim(),
      password: cleanPass,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000
    }
  };

  try {
    const connection = await imaps.connect(imapConfig);
    await connection.openBox('INBOX');

    // Search latest messages
    const searchCriteria = ['ALL'];
    const fetchOptions = {
      bodies: ['HEADER'],
      struct: true,
      markSeen: false
    };

    const results = await connection.search(searchCriteria, fetchOptions);
    // Sort descending by sequence number or date to get the latest
    const sorted = results.sort((a, b) => b.attributes.uid - a.attributes.uid).slice(0, limit);

    const emails = sorted.map(res => {
      const headerPart = res.parts.find(p => p.which === 'HEADER');
      const headers = headerPart?.body || {};
      const subject = Array.isArray(headers.subject) ? headers.subject[0] : (headers.subject || '(No Subject)');
      const from = Array.isArray(headers.from) ? headers.from[0] : (headers.from || 'Unknown');
      const date = Array.isArray(headers.date) ? headers.date[0] : (headers.date || '');

      return {
        id: String(res.attributes.uid),
        from,
        subject,
        date: date ? new Date(date).toLocaleString() : 'Recent',
        flags: res.attributes.flags || []
      };
    });

    connection.end();
    return { success: true, count: emails.length, emails };
  } catch (err) {
    return {
      success: false,
      error: `IMAP connection error: ${err.message}`
    };
  }
}

/**
 * Send an email via Gmail
 */
export async function sendGmailEmail(config = {}, { to, subject, body, html }) {
  const { email, appPassword, oauthToken } = config;

  if (!to || !subject || (!body && !html)) {
    return { success: false, error: 'Recipient "to", "subject", and message body are required' };
  }

  // 1. OAuth API method
  if (oauthToken && oauthToken.trim()) {
    try {
      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
      const messageParts = [
        `To: ${to}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${utf8Subject}`,
        '',
        html || body
      ];
      const rawMessage = messageParts.join('\r\n');
      const encodedMessage = Buffer.from(rawMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const res = await axios.post(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        { raw: encodedMessage },
        {
          headers: {
            Authorization: `Bearer ${oauthToken.trim()}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      return {
        success: true,
        messageId: res.data.id,
        to,
        subject,
        sentAt: new Date().toISOString()
      };
    } catch (err) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  }

  // 2. SMTP with App Password
  if (!email || !appPassword) {
    return { success: false, error: 'Gmail credentials (email and appPassword) are required to send emails' };
  }

  const cleanPass = appPassword.replace(/\s+/g, '').trim();

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: email.trim(),
        pass: cleanPass
      }
    });

    const mailOptions = {
      from: `"Teacher Luna Study Assistant" <${email.trim()}>`,
      to: to.trim(),
      subject,
      text: body || '',
      html: html || (body ? body.replace(/\n/g, '<br/>') : '')
    };

    const info = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: info.messageId,
      to,
      subject,
      sentAt: new Date().toISOString()
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to send email: ${err.message}`
    };
  }
}
