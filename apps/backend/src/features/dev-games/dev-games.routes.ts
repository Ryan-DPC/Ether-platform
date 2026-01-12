
import { Elysia, t } from 'elysia';
import { v2 as cloudinary } from 'cloudinary';

export const devGamesRoutes = new Elysia({ prefix: '/api/dev-games' })
    .get('/', async ({ set }) => {
        try {
            // Search for all manifest.json files in games/dev folder
            const searchResult = await cloudinary.search
                .expression('folder:games/dev/* AND filename:manifest')
                .max_results(50)
                .execute();

            const games = [];

            // Process each found manifest
            for (const resource of searchResult.resources) {
                try {
                    // Extract slug from folder path: games/dev/{slug}/manifest.json
                    const folderParts = resource.folder.split('/');
                    const slug = folderParts[folderParts.length - 1];

                    // Fetch the manifest content
                    const manifestUrl = resource.secure_url;
                    const manifestResponse = await fetch(manifestUrl);

                    if (manifestResponse.ok) {
                        const manifest = await manifestResponse.json();

                        // Add Cloudinary URLs
                        manifest.manifestUrl = manifestUrl;
                        manifest.zipUrl = cloudinary.url(`games/dev/${slug}/${slug}.zip`, {
                            resource_type: 'raw'
                        });
                        manifest.imageUrl = cloudinary.url(`games/dev/${slug}/image`, {
                            resource_type: 'image',
                            format: 'png'
                        });
                        manifest.defaultImageUrl = cloudinary.url('games/default-game', {
                            resource_type: 'image',
                            format: 'png'
                        });

                        // Ensure slug is set
                        manifest.slug = slug;

                        games.push(manifest);
                    }
                } catch (err: any) {
                    console.error(`Error processing game manifest: ${err.message}`);
                }
            }

            return {
                success: true,
                count: games.length,
                games
            };
        } catch (error: any) {
            console.error('Error fetching dev games from Cloudinary:', error);
            set.status = 500;
            return {
                success: false,
                error: error.message
            };
        }
    })
    .get('/:gameId', async ({ params: { gameId }, set }) => {
        try {
            // Construct manifest URL directly
            const manifestUrl = cloudinary.url(`games/dev/${gameId}/manifest.json`, {
                resource_type: 'raw'
            });

            const manifestResponse = await fetch(manifestUrl);

            if (!manifestResponse.ok) {
                set.status = 404;
                return {
                    success: false,
                    error: 'Game not found'
                };
            }

            const manifest = await manifestResponse.json();

            // Add URLs
            manifest.manifestUrl = manifestUrl;
            manifest.zipUrl = cloudinary.url(`games/dev/${gameId}/${gameId}.zip`, {
                resource_type: 'raw'
            });
            manifest.imageUrl = cloudinary.url(`games/dev/${gameId}/image`, {
                resource_type: 'image',
                format: 'png'
            });
            manifest.defaultImageUrl = cloudinary.url('games/default-game', {
                resource_type: 'image',
                format: 'png'
            });

            // Ensure slug is set
            manifest.slug = gameId;

            return {
                success: true,
                game: manifest
            };
        } catch (error: any) {
            set.status = 500;
            return {
                success: false,
                error: error.message
            };
        }
    });
