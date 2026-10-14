import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Nada de red ni de credenciales reales en los tests.
    env: { ANTHROPIC_API_KEY: '', SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', WHATSAPP_TOKEN: '', WHATSAPP_PHONE_NUMBER_ID: '' },
    coverage: { provider: 'v8', include: ['src/lib/**'], reporter: ['text', 'html'] },
  },
})
