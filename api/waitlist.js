const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const HONEYPOT_FIELD = 'website';

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { name, email, role, [HONEYPOT_FIELD]: honeypot } = req.body;

    // Honeypot check
    if (honeypot && honeypot.trim() !== '') {
      console.log('Honeypot triggered - possible bot submission blocked');
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
      subject: 'Bienvenido a Strikers Match / Welcome to Strikers Match',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #c0001e;">¡Bienvenido a Strikers Match!</h2>
          <p>Hola ${escapeHtml(name)},</p>
          <p>Gracias por unirte a nuestra lista de espera. Te notificaremos en cuanto lancemos en México.</p>
          <p>Tu rol seleccionado: <strong>${escapeHtml(role)}</strong></p>
          <br>
          <p>Saludos,<br>El equipo de Strikers Match</p>
          
          <hr style="border: none; border-top: 1px solid #e2e2e2; margin: 30px 0;">
          
          <h2 style="color: #c0001e;">Welcome to Strikers Match!</h2>
          <p>Hi ${escapeHtml(name)},</p>
          <p>Thanks for joining our waitlist. We'll notify you as soon as we launch in Mexico.</p>
          <p>Your selected role: <strong>${escapeHtml(role)}</strong></p>
          <br>
          <p>Best regards,<br>Strikers Match Team</p>
        </div>
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
};

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
