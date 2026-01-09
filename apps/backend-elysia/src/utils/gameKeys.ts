
/**
 * Génère une clé de jeu au format Steam: XXXX-XXXX-XXXX-XXXX
 */
export function generateGameKey(): string {
    const parts: string[] = [];
    for (let i = 0; i < 4; i++) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let part = '';
        for (let j = 0; j < 4; j++) {
            part += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        parts.push(part);
    }
    return parts.join('-');
}

/**
 * Valide le format d'une clé de jeu
 */
export function isValidKeyFormat(key: string): boolean {
    const regex = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    return regex.test(key);
}
