import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

// Gera os PNGs de ícone a partir da mesma marca do favicon, para não existirem duas versões do
// logotipo divergindo com o tempo. Usa o Chromium que o Playwright já instala — nenhuma dependência
// nova, e o resultado é reproduzível: `node tools/generate-icons.mjs`.
//
// O ícone "maskable" é uma arte separada, e não o mesmo desenho redimensionado: sistemas que
// aplicam máscara recortam até 20% de cada borda, então a marca vive numa zona segura central e o
// fundo sangra até o limite. Reaproveitar o ícone comum ali faria o anel ser cortado num aparelho
// e não em outro.

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outputDir = join(root, 'public', 'icons')

const BACKGROUND = '#244b3c'
const RING = '#f4f6f2'
const DOT = '#8bc66b'

function mark({ scale, radius }) {
  const size = 64 * scale
  const offset = (64 - size) / 2
  return `
    <rect width="64" height="64" rx="${radius}" fill="${BACKGROUND}"/>
    <g transform="translate(${offset} ${offset}) scale(${scale})">
      <circle cx="32" cy="32" r="15" fill="none" stroke="${RING}" stroke-width="6"/>
      <circle cx="32" cy="32" r="5" fill="${DOT}"/>
    </g>`
}

const icons = [
  // Ícone comum: a marca ocupa a arte inteira, com o mesmo canto arredondado do favicon.
  { file: 'icon-192.png', size: 192, svg: mark({ scale: 1, radius: 20 }) },
  { file: 'icon-512.png', size: 512, svg: mark({ scale: 1, radius: 20 }) },
  // Maskable: fundo sangrando e marca a 60%, dentro da zona segura de 80% do diâmetro.
  { file: 'icon-maskable-512.png', size: 512, svg: mark({ scale: 0.6, radius: 0 }) },
  // Apple não aplica máscara nem transparência: o ícone é usado como está, com cantos do sistema.
  { file: 'apple-touch-icon.png', size: 180, svg: mark({ scale: 0.82, radius: 0 }) },
]

mkdirSync(outputDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage()

for (const icon of icons) {
  await page.setViewportSize({ width: icon.size, height: icon.size })
  await page.setContent(
    `<style>html,body{margin:0;padding:0}svg{display:block}</style>
     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${icon.size}" height="${icon.size}">${icon.svg}</svg>`,
  )
  writeFileSync(join(outputDir, icon.file), await page.screenshot({ omitBackground: false }))
  console.log(`${icon.file} (${icon.size}x${icon.size})`)
}

await browser.close()
