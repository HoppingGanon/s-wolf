export const emailRules = [
  (v: string) => !!v || '必須入力です',
  (v: string) =>
    /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v) ||
    '不正なメールアドレスです',
]
