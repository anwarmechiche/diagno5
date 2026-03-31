const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf']
const specialTens = [
  '',
  'dix',
  'onze',
  'douze',
  'treize',
  'quatorze',
  'quinze',
  'seize',
  'dix-sept',
  'dix-huit',
  'dix-neuf'
]
const tens = [
  '',
  'dix',
  'vingt',
  'trente',
  'quarante',
  'cinquante',
  'soixante',
  'soixante-dix',
  'quatre-vingt',
  'quatre-vingt-dix'
]

const convertChunk = (n: number): string => {
  if (n === 0) return ''
  if (n < 10) return units[n]
  if (n < 20) return specialTens[n]
  if (n < 100) {
    const t = Math.floor(n / 10)
    const u = n % 10
    if (t === 7) return `${tens[6]}-${convertChunk(10 + u)}`
    if (t === 9) return `${tens[8]}-${convertChunk(10 + u)}`
    if (t === 8) return `${tens[8]}${u ? `-${units[u]}` : ''}`
    return `${tens[t]}${u ? `${u === 1 ? '-et-' : '-'}${units[u]}` : ''}`
  }
  if (n < 1000) {
    const h = Math.floor(n / 100)
    const rest = n % 100
    const prefix = h === 1 ? 'cent' : `${units[h]} cent`
    return `${prefix}${rest ? ` ${convertChunk(rest)}` : ''}`
  }
  if (n < 1000000) {
    const thousands = Math.floor(n / 1000)
    const rest = n % 1000
    const prefix = thousands === 1 ? 'mille' : `${convertChunk(thousands)} mille`
    return `${prefix}${rest ? ` ${convertChunk(rest)}` : ''}`
  }
  if (n < 1000000000) {
    const millions = Math.floor(n / 1000000)
    const rest = n % 1000000
    const prefix = `${convertChunk(millions)} million${millions > 1 ? 's' : ''}`
    return `${prefix}${rest ? ` ${convertChunk(rest)}` : ''}`
  }
  return ''
}

export function numberToWordsDA(num: number) {
  if (Number.isNaN(num)) return 'ZERO DINARS'
  const dinars = Math.floor(num)
  const centimes = Math.round((num - dinars) * 100)
  const dinarsText = convertChunk(dinars) || 'zero'
  const centimesText = centimes ? ` et ${convertChunk(centimes)} centimes` : ''
  return `${dinarsText.toUpperCase()} dinars${centimesText.toUpperCase()}`
}
