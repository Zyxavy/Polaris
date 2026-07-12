import type { MiddlewareHandler } from "hono";
import { createAuth } from "../auth";


export const requireAuth: MiddlewareHandler = async(c, next) => {
    const existingUser = c.get('user');
    if (existingUser) return next();

    const auth = createAuth(c.env);
    const session = await auth.api.getSession({ headers: c.req.raw.headers});

    if(!session) {
        return c.json({ error: 'unauthorized', message: 'Sign in required.'}, 401);
    }

    c.set('user', session.user);
    c.set('session', session.session);
    await next();
};