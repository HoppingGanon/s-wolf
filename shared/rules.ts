export const requiredRule = (v: string) => !!v || '必須入力です'

export const emailRules = [
  requiredRule,
  (v: string) =>
    /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v) ||
    '不正なメールアドレスです',
]

export const memberCountRule = (v: number) =>
  (3 <= v && v <= 16) || '参加人数は3～16人にする必要があります'

export const passwordRule = (v: string) =>
  /^[0-9a-zA-Z@_\-!?]{8,32}$/.test(v) ||
  '半角英数または記号(@_-!?)を8～32文字入力してください'

export const baseRule = (v: string) =>
  /^[^<>?*=!"'&$\\]*$/.test(v) ||
  '使用できない文字が含まれています(^<>?*=!"\'&$\\)'

export function valid(v: string, rules: ((_v: string) => true | string)[]) {
  for (let rule of rules) {
    const result = rule(v)
    if (typeof result === 'string') {
      return result
    }
  }
  return true
}
