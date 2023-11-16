import CryptoJS from 'crypto-js'

export function encrypt(value: string, password: string) {
  const iv = CryptoJS.lib.WordArray.random(16)
  return CryptoJS.AES.encrypt(value, password, { iv }).toString()
}

export function decrypt(value: string, password: string) {
  try {
    var bytes = CryptoJS.AES.decrypt(value, password)
    var originalText = bytes.toString(CryptoJS.enc.Utf8)
    return originalText
  } catch {
    return ''
  }
}
