import { TransactionalEmailsApi, TransactionalEmailsApiApiKeys, SendSmtpEmail } from '@getbrevo/brevo';

const apiInstance = new TransactionalEmailsApi();
apiInstance.setApiKey(TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

const brevoTransporter = {
    sendMail: async ({ to, subject, text, html }) => {
        try {
            const sendSmtpEmail = new SendSmtpEmail();
            sendSmtpEmail.to = [{ email: to }];
            sendSmtpEmail.sender = { email: process.env.BREVO_SENDER_EMAIL };
            sendSmtpEmail.subject = subject;
            sendSmtpEmail.textContent = text;
            sendSmtpEmail.htmlContent = html || text;
            
            const response = await apiInstance.sendTransacEmail(sendSmtpEmail);
            console.log('✅ Email sent to:', to);
            return response;
        } catch (error) {
            console.error('❌ Brevo error:', error.response?.body || error.message);
            throw new Error('Failed to send email');
        }
    }
};

export default brevoTransporter;