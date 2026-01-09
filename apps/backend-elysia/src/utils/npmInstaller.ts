
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export class NpmInstaller {
    /**
     * Install npm dependencies in a game folder
     */
    static async installDependencies(gameFolderPath: string): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(gameFolderPath)) {
                return reject(new Error(`Le dossier du jeu n'existe pas: ${gameFolderPath}`));
            }

            const packageJsonPath = path.join(gameFolderPath, 'package.json');
            if (!fs.existsSync(packageJsonPath)) {
                console.log(`[NpmInstaller] Pas de package.json trouvé dans ${gameFolderPath}, aucune dépendance à installer`);
                return resolve({
                    success: true,
                    message: 'Aucune dépendance à installer (pas de package.json)',
                    skipped: true
                });
            }

            const nodeModulesPath = path.join(gameFolderPath, 'node_modules');
            if (fs.existsSync(nodeModulesPath)) {
                console.log(`[NpmInstaller] node_modules existe déjà dans ${gameFolderPath}, installation ignorée`);
                return resolve({
                    success: true,
                    message: 'Dépendances déjà installées',
                    skipped: true
                });
            }

            console.log(`[NpmInstaller] Installation des dépendances npm dans ${gameFolderPath}...`);

            const isWindows = process.platform === 'win32';
            const npmCmd = isWindows ? 'npm.cmd' : 'npm';

            const npmProcess = spawn(npmCmd, ['install'], {
                cwd: gameFolderPath,
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: false
            });

            let stdout = '';
            let stderr = '';

            npmProcess.stdout!.on('data', (data) => {
                stdout += data.toString();
                process.stdout.write(data);
            });

            npmProcess.stderr!.on('data', (data) => {
                stderr += data.toString();
                process.stderr.write(data);
            });

            npmProcess.on('close', (code) => {
                if (code === 0) {
                    console.log(`[NpmInstaller] ✅ Dépendances installées avec succès dans ${gameFolderPath}`);
                    resolve({
                        success: true,
                        message: 'Dépendances installées avec succès',
                        stdout: stdout,
                        stderr: stderr
                    });
                } else {
                    const error: any = new Error(`Échec de l'installation des dépendances (code: ${code})`);
                    error.code = code;
                    error.stdout = stdout;
                    error.stderr = stderr;
                    console.error(`[NpmInstaller] ❌ Erreur lors de l'installation des dépendances:`, error.message);
                    reject(error);
                }
            });

            npmProcess.on('error', (error) => {
                console.error(`[NpmInstaller] ❌ Erreur lors du lancement de npm install:`, error.message);
                reject(new Error(`Impossible de lancer npm install: ${error.message}`));
            });
        });
    }

    static areDependenciesInstalled(gameFolderPath: string): boolean {
        const nodeModulesPath = path.join(gameFolderPath, 'node_modules');
        return fs.existsSync(nodeModulesPath);
    }

    static needsNpmInstall(gameFolderPath: string): boolean {
        const packageJsonPath = path.join(gameFolderPath, 'package.json');
        return fs.existsSync(packageJsonPath);
    }
}

export default NpmInstaller;
