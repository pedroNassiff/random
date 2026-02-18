// Analiza el canal alpha de cada PNG de monitor para detectar el área de pantalla
// (los píxeles transparentes = pantalla del monitor)
import { createCanvas, loadImage } from 'canvas'
import { readdir } from 'fs/promises'
import { resolve, basename } from 'path'

const ROOT = new URL('..', import.meta.url).pathname

async function getScreenBounds(file) {
  const img = await loadImage(file)
  const { width: W, height: H } = img
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, W, H)

  let minX = W, minY = H, maxX = 0, maxY = 0, count = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = data[(y * W + x) * 4 + 3]
      if (a < 30) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
        count++
      }
    }
  }

  const sw = maxX - minX + 1
  const sh = maxY - minY + 1
  console.log(`${basename(file)} (${W}x${H}) — transparent pixels: ${count}`)
  console.log(`  bounds: x=${minX}–${maxX}  y=${minY}–${maxY}  (${sw}×${sh}px)`)
  console.log(`  as %:   left=${(minX/W*100).toFixed(1)}  top=${(minY/H*100).toFixed(1)}  width=${(sw/W*100).toFixed(1)}  height=${(sh/H*100).toFixed(1)}`)
  console.log()
}

const dir = resolve(ROOT, 'src/img/lab')
for (let i = 1; i <= 5; i++) {
  await getScreenBounds(resolve(dir, `monitor${i}.png`))
}
