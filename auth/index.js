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
		onExistingUserSignUp: async ({ user }, request) => {
			await transporter.sendMail({
				to: user.email,
				subject: "Sign-up attempt with your email",
				text: "Someone tried to create an account using your email address...",
			});
		},
	},
	emailVerification: {
		autoSignInAfterVerification: true,
	},
	plugins: [
		emailOTP({
			overrideDefaultEmailVerification: true,
			async sendVerificationOTP({ email, otp, type }) {
				await transporter.sendMail({
					to: email,
					subject: "Your verification code",
					text: `Your verification code is: ${otp}`,
				});
			},
			expiresIn: 600,
			otpLength: 6,
		})
	],
	baseURL: process.env.BETTER_AUTH_URL,
	trustedOrigins: [process.env.FRONTEND_URL],

	// ✅ FIXED: Use advanced.defaultCookieAttributes
	advanced: {
		useSecureCookies: true,
		defaultCookieAttributes: {
			secure: true, // Required for sameSite: 'none'
			httpOnly: true,
		},
		// OR use useSecureCookies to force secure in all envs
		// useSecureCookies: true,
	},

	secret: process.env.BETTER_AUTH_SECRET,
});

export const mountAuthRoutes = (app) => {
    // Standard wildcard for Better Auth routes
    app.all('/api/auth/*path', toNodeHandler(auth));
};
