export interface StoreData {
  token: string
  code: string
}

export class Store implements StoreData {
  get token(): string {
    return localStorage.getItem('token') || ''
  }

  set token(v: string) {
    localStorage.setItem('token', v)
  }
  get code(): string {
    return localStorage.getItem('code') || ''
  }

  set code(v: string) {
    localStorage.setItem('code', v)
  }
}

export default new Store()
