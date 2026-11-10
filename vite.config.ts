import { createReadStream } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'docstream-browser-bundle',
      configureServer(server) {
        server.middlewares.use('/__docstream/officeparser.browser.js', (request, response, next) => {
          if (request.method !== 'GET') {
            next()
            return
          }

          response.setHeader('Content-Type', 'text/javascript')
          response.setHeader('Cache-Control', 'no-cache')
          createReadStream(resolve('node_modules/@jose.espana/docstream/dist/officeparser.browser.js'))
            .on('error', next)
            .pipe(response)
        })
      },
    },
  ],
})
