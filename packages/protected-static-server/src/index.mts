import 'source-map-support/register.js';

import Router from '@koa/router';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import morgan from 'koa-morgan';
import serve from 'koa-static';
import ReactDOMServer from 'react-dom/server';
import { z } from 'zod';
import LoggedPage from './components/LoggedPage.js';
import LoginForm from './components/LoginPage.js';
import RedirectPage from './components/RedirectPage.js';
import AuthCookie from './utils/AuthCookie.js';
import AuthToken from './utils/AuthToken.js';
import path from 'node:path';
import process from 'node:process';

// Environment configuration with Zod validation
const envSchema = z.object({
    SECRET: z.string().min(1),
    PASSWORD: z.string().min(1),
    COOKIE_NAME: z.string().default('auth_token'),
    MAX_AGE: z.string().default('86400000'), // 24 hours in milliseconds
    PORT: z.string().default('3000'),
    STATIC_DIR: z.string().transform((dir) => path.join(process.cwd(), dir)),
    ROOT_URL: z.url(),
});

const env = envSchema.parse(process.env);

console.log('Server configuration:', {
    COOKIE_NAME: env.COOKIE_NAME,
    MAX_AGE: env.MAX_AGE,
    PORT: env.PORT,
    STATIC_DIR: env.STATIC_DIR,
    ROOT_URL: env.ROOT_URL,
});

// Initialize utilities
const authToken = new AuthToken(env.SECRET, env.MAX_AGE);
const authCookie = new AuthCookie(env.COOKIE_NAME, env.MAX_AGE, env.ROOT_URL);

// Login form validator
const loginValidator = z.object({
    password: z.string().min(1).max(100),
});

// Create router
const router = new Router();

// GET /login - Show login form or logged-in page
router.get('/login', async (ctx) => {    
    const tokenStr = authCookie.parse(ctx.request);

    if (!tokenStr) {
        ctx.type = 'html';
        ctx.body = ReactDOMServer.renderToString(LoginForm({}));
        return;
    }

    const payload = authToken.validate(tokenStr);
    if (payload) {
        ctx.type = 'html';
        ctx.body = ReactDOMServer.renderToString(LoggedPage({
            issued_at: new Date(payload.iat),
            expires_at: new Date(payload.exp),
            uuid: payload.uuid,
        }));
    } else {
        ctx.type = 'html';
        ctx.set('Set-Cookie', authCookie.serialize());
        ctx.body = ReactDOMServer.renderToString(LoginForm({}));
    }
});

// POST /login - Validate password and set auth cookie
router.post('/login', async (ctx) => {
    const body = loginValidator.safeParse(ctx.request.body);

    if (!body.success) {
        ctx.status = 401;
        ctx.type = 'html';
        ctx.body = ReactDOMServer.renderToString(LoginForm({ errorMessage: 'Invalid password' }));
        return;
    }

    if (body.data.password !== env.PASSWORD) {
        ctx.status = 401;
        ctx.type = 'html';
        ctx.body = ReactDOMServer.renderToString(LoginForm({ errorMessage: 'Invalid password' }));
        return;
    }

    const token = authToken.create();
    ctx.set('Set-Cookie', authCookie.serialize(token));
    ctx.redirect('/');
});

// GET /login_link - Magic link authentication
router.get('/login_link', async (ctx) => {
    // Check if user is already authenticated via cookie
    const tokenStr = authCookie.parse(ctx.request);
    if (tokenStr) {
        ctx.redirect('/');
        return;
    }

    // Check for token in URL
    const token = ctx.query.token as string | undefined;

    if (!token) {
        ctx.status = 401;
        ctx.type = 'html';
        ctx.body = ReactDOMServer.renderToString(LoginForm({ errorMessage: 'Unauthorized Access' }));
        return;
    }

    // Check if token is valid (matches the password)
    if (token !== env.PASSWORD) {
        ctx.status = 401;
        ctx.type = 'html';
        ctx.body = ReactDOMServer.renderToString(LoginForm({ errorMessage: 'Invalid token' }));
        return;
    }

    const authTokenStr = authToken.create();
    ctx.type = 'html';
    ctx.set('Set-Cookie', authCookie.serialize(authTokenStr));
    ctx.body = ReactDOMServer.renderToString(RedirectPage({ url: '/' }));
});

// POST /logout - Clear auth cookie
router.post('/logout', async (ctx) => {
    ctx.set('Set-Cookie', authCookie.serialize());
    ctx.redirect('/');
});

// GET /login_link - Magic link authentication
router.get('/logout', async (ctx) => {
    ctx.type = 'html';
    ctx.set('Set-Cookie', authCookie.serialize());
    ctx.body = ReactDOMServer.renderToString(RedirectPage({ url: '/' }));
});

// Auth middleware for protected routes
async function requireAuth(ctx: Koa.Context, next: Koa.Next) {
    const token = authCookie.parse(ctx.request);

    if (!token) {
        ctx.redirect('/login');
        return;
    }

    const payload = authToken.validate(token);
    if (!payload) {
        ctx.type = 'html';
        ctx.set('Set-Cookie', authCookie.serialize());
        ctx.body = ReactDOMServer.renderToString(RedirectPage({ url: '/login' }));
        return;
    }

    await next();
}

// Catch-all route - protected
router.get('*splat', requireAuth, serve(env.STATIC_DIR, {
    extensions: ['html', 'htm'],
}));

// Create and configure app
const app = new Koa();

// Add HTTP request logging
app.use(morgan('combined'));

// Parse form data
app.use(bodyParser());

// Add routes
app.use(router.routes());
app.use(router.allowedMethods());


// Start server
const port = parseInt(env.PORT);
const server = app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

["SIGINT", "SIGTERM"].forEach((signal) => {
    process.on(signal, () => {
        console.log(`Received ${signal}, shutting down server...`);
        Promise.race([
            new Promise<void>((resolve) => server.close(() => resolve())),
            new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Shutdown timeout exceeded')), 10000)),
        ]).catch((error) => {
            console.error(error);
        }).finally(() => {
            console.log('Server shut down gracefully.');
            process.exit(1);
        });
    });
});