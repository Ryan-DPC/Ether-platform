
import { t, Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { Users } from '@vext/database';

// Helper to generate a token
// Note: We'll access the `jwt` plugin instance from the handler context
export const authRoutes = new Elysia({ prefix: '/api/auth' })
    .use(jwt({
        name: 'jwt',
        secret: process.env.JWT_SECRET || 'default_secret'
    }))
    .post('/register', async ({ body, jwt, set }) => {
        const { username, email, password, tag } = body as any;

        if (!tag || !/^[a-zA-Z0-9]{3,4}$/.test(tag)) {
            set.status = 400;
            return { success: false, message: 'Tag must be 3-4 alphanumeric characters.' };
        }

        const fullUsername = `${username}#${tag}`;

        // Parallel checks
        const [existingUser, existingEmail] = await Promise.all([
            Users.getUserByUsername(fullUsername),
            Users.getUserByEmail(email)
        ]);

        if (existingUser) {
            set.status = 409;
            return { success: false, message: 'Username with this tag is already taken.' };
        }
        if (existingEmail) {
            set.status = 409;
            return { success: false, message: 'Email is already used.' };
        }

        // Random avatar logic
        const defaultAvatars = ['avatar_blue.svg', 'avatar_green.svg', 'avatar_red.svg'];
        const randomAvatar = defaultAvatars[Math.floor(Math.random() * defaultAvatars.length)];
        // Hardcoding backend URL for now or use env
        const backendUrl = process.env.BACKEND_URL;
        const profile_pic = `${backendUrl}/public/avatars/${randomAvatar}`;

        const hashedPassword = await Bun.password.hash(password, { algorithm: 'bcrypt', cost: 10 });
        const newUser = await Users.createUser({ username: fullUsername, email, password: hashedPassword, profile_pic });

        const token = await jwt.sign({
            id: newUser.id,
            username: newUser.username,
            isAdmin: false
        });

        return {
            success: true,
            token,
            user: newUser
        };
    }, {
        body: t.Object({
            username: t.String(),
            email: t.String(),
            password: t.String(),
            tag: t.String()
        })
    })
    .post('/login', async ({ body, jwt, set }) => {
        const { username: identifier, password } = body as any;

        let user: any;
        if (identifier.includes('@')) {
            user = await Users.getUserByEmail(identifier);
        } else {
            if (identifier.includes('#')) {
                user = await Users.getUserByUsername(identifier);
            } else {
                user = await Users.getUserByBaseUsername(identifier);
            }
        }

        if (!user) {
            set.status = 401;
            return { success: false, message: 'User not found.' };
        }

        if (!user.password) {
            set.status = 400;
            return { success: false, message: 'Account has no password (social login?).' };
        }

        const isPasswordValid = await Bun.password.verify(password, user.password);
        if (!isPasswordValid) {
            set.status = 401;
            return { success: false, message: 'Invalid password.' };
        }

        const token = await jwt.sign({
            id: user.id,
            username: user.username,
            isAdmin: user.isAdmin
        });

        return {
            success: true,
            token,
            user
        };
    }, {
        body: t.Object({
            username: t.String(), // can be email or username
            password: t.String()
        })
    });
