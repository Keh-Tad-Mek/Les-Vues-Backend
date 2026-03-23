import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { toNodeHandler } from 'better-auth/node';
import { db } from '../db/index.js';
import * as schema from "../db/schema.js"

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
    },
    emailVerification: {
        sendVerificationEmail: async ({ user, url, token }, request) => {
            // void sendEmail({
            //     to: user.email,
            //     subject: 'Verify your email address',
            //     text: `Click the link to verify your email: ${url}`
            // })

            console.log(`Click to verify ${url}`)
        },
        sendOnSignUp: true,
        requireEmailVerification: true,
        autoSignInAfterVerification: true,
        afterEmailVerification: async ({ user }) => {
            // Optional: runs after user verifies email
            console.log(`User ${user.email} verified`);
        }
    },
    baseURL: process.env.BETTER_AUTH_URL,
    trustedOrigins: [process.env.FRONTEND_URL],
    secret: process.env.BETTER_AUTH_SECRET,
});

export const mountAuthRoutes = (app) => {
    // Use the correct wildcard for your Express version
    app.all('/api/auth/*path', toNodeHandler(auth));
};