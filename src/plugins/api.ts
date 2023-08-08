import axios, { AxiosStatic } from 'axios'

class Api {
  axios: AxiosStatic

  constructor() {
    this.axios = axios
    this.axios.defaults.baseURL = process.env.BACK_BASE_URL
    this.axios.defaults.headers.common = {
      Authorization: '',
    }
  }
}

export default new Api()
