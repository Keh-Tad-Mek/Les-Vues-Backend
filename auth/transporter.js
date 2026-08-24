// transporter.js
import { BrevoClient } from '@getbrevo/brevo';

// Initialize the client once
const brevo = new BrevoClient({ 
    apiKey: process.env.BREVO_API_KEY 
});

const brevoTransporter = {
    sendMail: async ({ to, subject, text, html }) => {
        try {
            const result = await brevo.transactionalEmails.sendTransacEmail({
                subject: subject,
                textContent: text,
                htmlContent: html || text,
                sender: { email: process.env.BREVO_SENDER_EMAIL }, // Ensure this email is verified in Brevo!
                to: [{ email: to }]
            });
            
            console.log('✅ Email sent to:', to);
            return result;
        } catch (error) {
            console.error('❌ Brevo error:', error);
            throw new Error('Failed to send email');
        }
    }
};

export default brevoTransporter;