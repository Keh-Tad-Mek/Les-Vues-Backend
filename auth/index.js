import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { toNodeHandler } from 'better-auth/node';
import { db } from '../db/index.js';
import * as schema from "../db/schema.js"
import transporter from './transporter.js';

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: 'pg',
        schema: {
            user: schema.user,
            session: schema.session,
            account: schema.account,
            verification: schema.verification,
        }
    }),
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
    },
    emailVerification: {
        sendOnSignUp: true,
        sendVerificationEmail: async ({ user, url, token }, request) => {
            try {
                await transporter.sendMail({
                    from: `Les Vues <${process.env.SMTP_USER}>`,
                    to: user.email,
                    subject: "Verify your Email Address",
                    html: `<p>Please click the link below to verify your email:</p>
                           <a href="${url}">${url}</a>`,
                });
                console.log(`Verification email sent to ${user.email}`)
            }
            catch(error){
                console.error("Error sending verification email:", error)
            }
        },
        autoSignInAfterVerification: true,
        expiresIn: 3600,
    },
    baseURL: process.env.BETTER_AUTH_URL,
    trustedOrigins: [process.env.FRONTEND_URL],
    secret: process.env.BETTER_AUTH_SECRET,
});

export const mountAuthRoutes = (app) => {
    // Use the correct wildcard for your Express version
    app.all('/api/auth/*path', toNodeHandler(auth));
};