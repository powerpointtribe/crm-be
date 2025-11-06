const { Resend } = require('resend');

// Test script to debug email delivery
async function testEmailDelivery() {
  console.log('🧪 Testing email delivery...');

  // Load environment variables
  require('dotenv').config();

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.error('❌ RESEND_API_KEY not found in environment variables');
    return;
  }

  console.log('✅ API Key found:', apiKey.substring(0, 10) + '...');

  const resend = new Resend(apiKey);

  try {
    console.log('📧 Sending test email...');

    const result = await resend.emails.send({
      from: 'Church Management System <onboarding@resend.dev>',
      to: ['gthankgod@gmail.com'], // Your verified email address
      subject: 'Test Email from Church Management System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2c3e50;">🎉 Email Test Successful!</h1>
          <p>This is a test email from your Church Management System.</p>
          <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #c3e6cb;">
            <p><strong>✅ If you receive this email, your email service is working correctly!</strong></p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
          </div>
          <h3>Troubleshooting Tips:</h3>
          <ul>
            <li>Check your spam/junk folder</li>
            <li>Verify the email address is correct</li>
            <li>Make sure your Resend domain is verified</li>
            <li>Check Resend dashboard for delivery logs</li>
          </ul>
          <p>Best regards,<br/>Church Management System Test</p>
        </div>
      `,
    });

    console.log('✅ Email sent successfully!');
    console.log('📬 Email ID:', result.data?.id);
    console.log('📊 Full response:', JSON.stringify(result, null, 2));

    console.log('\n🔍 Next steps:');
    console.log('1. Check your email inbox (including spam folder)');
    console.log('2. Check Resend dashboard at https://resend.com/dashboard');
    console.log('3. Verify your domain at https://resend.com/domains');

  } catch (error) {
    console.error('❌ Email sending failed:');
    console.error('Error message:', error.message);
    console.error('Error details:', error);

    if (error.message.includes('api_key')) {
      console.log('\n💡 API Key issue detected:');
      console.log('- Verify your API key is correct');
      console.log('- Make sure it starts with "re_"');
      console.log('- Check if the API key has proper permissions');
    }

    if (error.message.includes('domain')) {
      console.log('\n💡 Domain issue detected:');
      console.log('- Verify your sending domain in Resend dashboard');
      console.log('- Make sure the domain is verified');
      console.log('- Try using a verified domain in the "from" field');
    }
  }
}

// Run the test
testEmailDelivery().catch(console.error);