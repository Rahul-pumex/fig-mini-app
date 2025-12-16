const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    images: {
        domains: ['localhost']
    },
    webpack: (config) => {
        config.resolve.alias = {
            ...config.resolve.alias,
            '@': path.resolve(__dirname, 'src'),
            '@components': path.resolve(__dirname, 'src/components'),
            '@utils': path.resolve(__dirname, 'src/utils'),
            '@hooks': path.resolve(__dirname, 'src/hooks'),
            '@redux': path.resolve(__dirname, 'src/redux'),
            '@constants': path.resolve(__dirname, 'src/constants'),
        };
        return config;
    },
    async rewrites() {
        const copilotBackend = process.env.COPILOT_BACKEND_URL || 'http://localhost:8000';
        
        return [
            // Note: /api/auth is now handled by API route handler at src/pages/api/auth/[[...path]].ts
            // This ensures all headers (including x-session_id) are properly forwarded
            {
                source: '/api/copilotkit',
                destination: `${copilotBackend}/api/copilotkit`
            }
        ];
    }
};

module.exports = nextConfig;

