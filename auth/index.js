import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { toNodeHandler } from 'better-auth/node';
import { db } from '../db/index.js';
import { emailOTP } from "better-auth/plugins"
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
        autoSignInAfterVerification: true,
    },
    plugins: [
        emailOTP({
            // This is vital: it tells Better Auth to use this OTP logic 
            // whenever an email verification is required (like on signup)
            overrideDefaultEmailVerification: true,
            async sendVerificationOTP({ email, otp, type }) {
                console.log(`Sending OTP (${type}) to ${email}`);
                try {
                    await transporter.sendMail({
                        to: email,
                        subject: "Your verification code",
                        text: `Your verification code is: ${otp}`,
                    });
                } catch (error) {
                    console.error("Email send failed:", error);
                    throw new Error("Failed to send verification email");
                }
            },
            expiresIn: 600,
            otpLength: 6,
        })
    ],
    baseURL: process.env.BETTER_AUTH_URL,
    trustedOrigins: [process.env.FRONTEND_URL],
    secret: process.env.BETTER_AUTH_SECRET,
});

export const mountAuthRoutes = (app) => {
    // Standard wildcard for Better Auth routes
    app.all('/api/auth/*path', toNodeHandler(auth));
};