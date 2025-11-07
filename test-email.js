// Simple test script to verify Nodemailer + SendGrid integration
require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmail() {
  console.log('Using SendGrid API Key from environment:', process.env.SENDGRID_API_KEY ? 'Set' : 'Not Set');
  // console.log('API Key format check:', process.env.SENDGRID_API_KEY?.substring(0, 3) === 'SG.' ? 'Valid format' : 'Invalid format - should start with SG.');

  // SendGrid SMTP configuration
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SENDGRID_API_KEY
    }
  });

  // Verify connection
  try {
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!');
  } catch (error) {
    console.error('❌ SMTP connection failed:', error.message);
    return;
  }

  // Test email
  const mailOptions = {
    from: 'Church Management System <hello@comtrova.com>',
    to: 'gthankgod@gmail.com', // Your email address
    subject: 'Test Email - Nodemailer + SendGrid',
    html: `
      <h1>Test Email</h1>
      <p>This is a test email sent using <strong>Nodemailer</strong> with <strong>SendGrid SMTP</strong>.</p>
      <p>If you receive this email, the integration is working correctly! 🎉</p>
      <p>Sent at: ${new Date().toLocaleString()}</p>
    `
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', result.messageId);
    console.log('Response:', result.response);
  } catch (error) {
    console.error('❌ Failed to send test email:', error.message);
    console.error('Error details:', error);
  }
}

testEmail();
