import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        host: true, // Needed for Docker
        port: 5173,
        proxy: {
            '/api': {
                // Docker 开发环境配置 - 生产环境不使用（前端由后端服务器提供）
                target: 'http://server:3000',
                changeOrigin: true
            }
        },
        watch: {
            usePolling: true // Needed for Windows Docker mounts sometimes
        }
    }
})
