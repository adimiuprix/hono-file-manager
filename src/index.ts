import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const STORAGE = 'C:\\My Web Sites'
if (!fs.existsSync(STORAGE)) fs.mkdirSync(STORAGE, { recursive: true })

const app = new Hono()

// Serve single-page frontend
app.get('/', async (c) => {
  const html = await fs.promises.readFile(path.join(__dirname, 'index.html'), 'utf8')
  return c.html(html)
})

// API: list files
app.get('/api/list', async (c) => {
  const query = c.req.query()
  const rel = query.path || ''
  const dir = safePath(rel)
  if (!dir) return c.json({ error: 'invalid path' }, 400)
  try {
    const items = await fs.promises.readdir(dir, { withFileTypes: true })
    const out = await Promise.all(items.map(async (it) => {
      const p = path.join(dir, it.name)
      const stat = await fs.promises.stat(p)
      return {
        name: it.name,
        isDir: it.isDirectory(),
        size: stat.size,
        mtime: stat.mtimeMs
      }
    }))
    return c.json({ path: rel, items: out })
  } catch (e) {
    return c.json({ error: e.message }, 500)
  }
})

// API: get file content
app.get('/api/file', async (c) => {
  const { path: rel } = c.req.query()
  const fp = safePath(rel)
  if (!fp) return c.json({ error: 'invalid path' }, 400)
  try {
    const content = await fs.promises.readFile(fp, 'utf8')
    return c.json({ content })
  } catch (e) {
    return c.json({ error: e.message }, 500)
  }
})

// API: save file
app.post('/api/save', async (c) => {
  const body = await c.req.json()
  const { path: rel, content } = body
  const fp = safePath(rel)
  if (!fp) return c.json({ error: 'invalid path' }, 400)
  try {
    await fs.promises.writeFile(fp, content, 'utf8')
    return c.json({ ok: true })
  } catch (e) {
    return c.json({ error: e.message }, 500)
  }
})

// API: download
app.get('/api/download', async (c) => {
  const { path: rel } = c.req.query()
  const fp = safePath(rel)
  if (!fp) return c.text('invalid path', 400)
  try {
    const name = path.basename(fp)
    const stream = fs.createReadStream(fp)
    return c.body(stream, 200, { 'Content-Disposition': `attachment; filename="${name}"` })
  } catch (e) {
    return c.text(e.message, 500)
  }
})

// API: mkdir
app.post('/api/mkdir', async (c) => {
  const { path: rel } = await c.req.json()
  const fp = safePath(rel)
  if (!fp) return c.json({ error: 'invalid path' }, 400)
  try {
    await fs.promises.mkdir(fp, { recursive: true })
    return c.json({ ok: true })
  } catch (e) {
    return c.json({ error: e.message }, 500)
  }
})

// API: delete (file or dir)
app.post('/api/delete', async (c) => {
  const { path: rel } = await c.req.json()
  const fp = safePath(rel)
  if (!fp) return c.json({ error: 'invalid path' }, 400)
  try {
    const stat = await fs.promises.stat(fp)
    if (stat.isDirectory()) await fs.promises.rm(fp, { recursive: true, force: true })
    else await fs.promises.unlink(fp)
    return c.json({ ok: true })
  } catch (e) {
    return c.json({ error: e.message }, 500)
  }
})

// API: rename
app.post('/api/rename', async (c) => {
  const { from, to } = await c.req.json()
  const f = safePath(from)
  const t = safePath(to)
  if (!f || !t) return c.json({ error: 'invalid path' }, 400)
  try {
    await fs.promises.rename(f, t)
    return c.json({ ok: true })
  } catch (e) {
    return c.json({ error: e.message }, 500)
  }
})

// API: upload
app.post('/api/upload', async (c) => {
  try {
    const filename = c.req.header('x-filename') || 'upload.bin'
    const destPath = safePath(filename)
    if (!destPath) return c.json({ error: 'invalid path' }, 400)
    const buf = await c.req.arrayBuffer()
    await fs.promises.writeFile(destPath, Buffer.from(buf))
    return c.json({ ok: true })
  } catch (e) {
    return c.json({ error: e.message }, 500)
  }
})

// Serve storage files
app.get('/storage/*', async (c) => {
  const rel = c.req.param('0')
  const fp = safePath(rel)
  if (!fp) return c.text('invalid path', 400)
  try {
    const stream = fs.createReadStream(fp)
    return c.body(stream)
  } catch (e) {
    return c.text(e.message, 500)
  }
})

function safePath(rel = '') {
  const target = path.normalize(path.join(STORAGE, rel))
  if (!target.startsWith(STORAGE)) return null
  return target
}

const port = process.env.PORT || 8787

serve({
  fetch: app.fetch,
  port,
})

console.log(`💾 File Manager running at http://localhost:${port}`)
