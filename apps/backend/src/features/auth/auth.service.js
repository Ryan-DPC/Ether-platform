const Models = require('../users/user.model');
const Users = Models.default || Models;
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const CloudinaryService = require('../../services/cloudinary.service');
const crypto = require('crypto');

class AuthService {
    static async registerUser({ username, email, password, file, tag }) {
        if (!tag || !/^[a-zA-Z0-9]{3,4}$/.test(tag)) {
            throw new Error('Le tag doit être composé de 3 ou 4 caractères alphanumériques.');
        }

        const fullUsername = `${username}#${tag}`;

        const [existingUser, existingEmail] = await Promise.all([
            Users.getUserByUsername(fullUsername),
            Users.getUserByEmail(email)
        ]);

        if (existingUser) {
            throw new Error('Ce nom d\'utilisateur avec ce tag est déjà pris.');
        }

        if (existingEmail) {
            throw new Error('L\'email est déjà utilisé.');
        }

        let profile_pic = null;
        if (file) {
            const cloudinaryService = new CloudinaryService();
            if (cloudinaryService.isEnabled()) {
                const result = await cloudinaryService.uploadBuffer(file.buffer, `users/${username}/profile_pic`);
                profile_pic = result.url;
            }
        } else {
            // Assign random default avatar
            const defaultAvatars = [
                'avatar_blue.svg',
                'avatar_green.svg',
                'avatar_minimal_user.svg',
                'avatar_orange.svg',
                'avatar_purple.svg',
                'avatar_red.svg'
            ];
            const randomAvatar = defaultAvatars[Math.floor(Math.random() * defaultAvatars.length)];
            // Construct URL based on backend configuration
            // Assuming the backend serves /public/avatars/
            const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
            profile_pic = `${backendUrl}/public/avatars/${randomAvatar}`;
        }

        const newUser = await Users.createUser({ username: fullUsername, email, password, profile_pic });

        const token = jwt.sign(
            { id: newUser.id, username: newUser.username, isAdmin: false },
            process.env.JWT_SECRET || 'default_secret',
            { expiresIn: '24h' }
        );

        return { user: newUser, token };
    }

    static async login(identifier, password) {
        let user;
        if (identifier.includes('@')) {
            user = await Users.getUserByEmail(identifier);
        } else {
            // Optimization: If no tag provided, don't waste time checking for exact match (which includes tag)
            if (identifier.includes('#')) {
                user = await Users.getUserByUsername(identifier);
            } else {
                // Try to find by base username
                user = await Users.getUserByBaseUsername(identifier);
            }
        }

        if (!user) throw new Error('Utilisateur non trouvé.');

        if (!user.password) {
            throw new Error('Ce compte n\'a pas de mot de passe (connexion sociale ?).');
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) throw new Error('Mot de passe incorrect.');

        const token = jwt.sign(
            { id: user.id, username: user.username, isAdmin: user.isAdmin || false },
            process.env.JWT_SECRET || 'default_secret',
            { expiresIn: '24h' }
        );

        return { user, token };
    }

    static async logout() {
        return { message: 'Déconnexion réussie.' };
    }

    static getGithubAuthUrl() {
        const rootUrl = 'https://github.com/login/oauth/authorize';
        const options = {
            client_id: process.env.GITHUB_CLIENT_ID,
            redirect_uri: process.env.GITHUB_CALLBACK_URL,
            scope: 'user:email',
        };
        const qs = new URLSearchParams(options);
        return `${rootUrl}?${qs.toString()}`;
    }

    static async handleGithubCallback(code) {
        // 1. Exchange code for access token
        const tokenUrl = 'https://github.com/login/oauth/access_token';
        const tokenResponse = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({
                client_id: process.env.GITHUB_CLIENT_ID,
                client_secret: process.env.GITHUB_CLIENT_SECRET,
                code,
            }),
        });

        const tokenData = await tokenResponse.json();
        if (tokenData.error) {
            throw new Error(`GitHub Error: ${tokenData.error_description}`);
        }
        const accessToken = tokenData.access_token;

        // 2. Fetch user profile
        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        const userProfile = await userResponse.json();

        // 3. Fetch user email (if not public)
        let email = userProfile.email;
        if (!email) {
            const emailResponse = await fetch('https://api.github.com/user/emails', {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            const emails = await emailResponse.json();

            // Check if emails is an array before using .find()
            if (Array.isArray(emails)) {
                const primaryEmail = emails.find((e) => e.primary && e.verified);
                email = primaryEmail ? primaryEmail.email : null;
            } else {
                console.error('GitHub emails API returned non-array:', emails);
            }
        }

        if (!email) {
            throw new Error('Email not found or not verified on GitHub.');
        }

        // 4. Find or create user
        let user = await Users.getUserByGithubId(userProfile.id.toString());
        if (!user) {
            // Check if email already exists
            const existingUser = await Users.getUserByEmail(email);
            if (existingUser) {
                throw new Error('Un compte avec cet email existe déjà. Veuillez vous connecter avec votre mot de passe.');
            }

            // Create new user
            user = await Users.createUser({
                username: userProfile.login,
                email,
                github_id: userProfile.id.toString(),
                github_username: userProfile.login,
                profile_pic: userProfile.avatar_url,
                password: null,
            });
        }

        // 5. Generate JWT
        const token = jwt.sign(
            { id: user.id, username: user.username, isAdmin: user.isAdmin || false },
            process.env.JWT_SECRET || 'default_secret',
            { expiresIn: '24h' }
        );

        return { user, token };
    }

    static async forgotPassword(email) {
        const user = await Users.getUserByEmail(email);
        if (!user) {
            throw new Error('Aucun utilisateur trouvé avec cet email.');
        }

        // Generate token
        const resetToken = crypto.randomBytes(20).toString('hex');
        const resetTokenExpires = Date.now() + 3600000; // 1 hour

        // Save token to user
        await Users.updateUser(user.id, {
            resetPasswordToken: resetToken,
            resetPasswordExpires: resetTokenExpires
        });

        // In a real app, send email here
        // For now, we'll return the token for testing purposes if needed, 
        // but typically we just return success message.
        console.log(`[EMAIL MOCK] Reset Password Link: http://localhost:5173/reset-password?token=${resetToken}`);

        return { message: 'Un email de réinitialisation a été envoyé.' };
    }

    static async resetPassword(token, newPassword) {
        const user = await Users.getUserByResetToken(token);

        if (!user) {
            throw new Error('Jeton de réinitialisation invalide ou expiré.');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await Users.updateUser(user.id, {
            password: hashedPassword,
            resetPasswordToken: null,
            resetPasswordExpires: null
        });

        return { message: 'Mot de passe réinitialisé avec succès.' };
    }
}

module.exports = AuthService;
