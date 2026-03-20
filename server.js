const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Honeypot field name (hidden field that bots will fill)
const HONEYPOT_FIELD = 'website';

// Form submission endpoint
app.post('/api/waitlist', async (req, res) => {
  try {
    const { name, email, role, [HONEYPOT_FIELD]: honeypot } = req.body;

    // Honeypot check - if filled, it's likely a bot
    if (honeypot && honeypot.trim() !== '') {
      console.log('Honeypot triggered - possible bot submission blocked');
      // Return success to trick bots, but don't process
      return res.status(200).json({ success: true, message: 'Thanks for joining!' });
    }

    // Validate required fields
    if (!name || !email || !role) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please fill in all required fields' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please enter a valid email address' 
      });
    }

    // Send email notification via Resend
    await resend.emails.send({
      from: 'Strikers Match <waitlist@strikersmatch.com>',
      to: process.env.NOTIFICATION_EMAIL || 'mc1986.99@gmail.com',
      subject: 'New Waitlist Signup - Strikers Match',
      html: `
        <h2>New Waitlist Signup</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Role:</strong> ${escapeHtml(role)}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
      `,
      replyTo: email
    });

    // Send confirmation email to user
    await resend.emails.send({
      from: 'Strikers Match <noreply@strikersmatch.com>',
      to: email,
      subject: 'Welcome to Strikers Match Waitlist',
      html: `
        <h2>¡Bienvenido a Strikers Match!</h2>
        <p>Hi ${escapeHtml(name)},</p>
        <p>Thanks for joining our waitlist. We'll notify you as soon as we launch in Mexico.</p>
        <p>Your selected role: <strong>${escapeHtml(role)}</strong></p>
        <br>
        <p>Best regards,<br>Strikers Match Team</p>
      `
    });

    res.status(200).json({ 
      success: true, 
      message: 'Successfully joined the waitlist!' 
    });

  } catch (error) {
    console.error('Form submission error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Something went wrong. Please try again.' 
    });
  }
});

// Helper function to escape HTML
function escapeHtml(text) {
  const div = { toString: () => text };
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
