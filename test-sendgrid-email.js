const sgMail = require('@sendgrid/mail');

// Set your SendGrid API Key
sgMail.setApiKey('wSsVR61z+hT2W6woyj2qdeoxkVkEVV6kE0wu0FahuHL1S/zF9cc5w0KaVACnSvFKQmQ8HDIV8Op/zBwF2zUIioh5wlADCCiF9mqRe1U4J3x17qnvhDzKW2pclhSKL4oPzwljmGdpFc0m+g==');

const msg = {
  to: 'test@example.com', // Change to your recipient
  from: 'hello@comtrova.com', // Change to your verified sender
  subject: 'Test SendGrid Integration',
  text: 'This is a test email from SendGrid integration',
  html: '<strong>This is a test email from SendGrid integration</strong>',
};

sgMail
  .send(msg)
  .then(() => {
    console.log('Email sent successfully!');
  })
  .catch((error) => {
    console.error('Error sending email:', error);
    if (error.response) {
      console.error('Response body:', error.response.body);
    }
  });