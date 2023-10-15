import axios, { AxiosRequestConfig, AxiosResponse, AxiosStatic } from 'axios'
import {
  AltUserRequest,
  GetGameResponse,
  MyGameResponse,
  PostGameRequest,
  PostUserRequest,
  PostLogin,
  PostJoinGameRequest,
  PostGameResponse,
  PutInputRequest,
  PutVoteRequest,
  HistoryGameResponse,
  UserResponse,
} from '../../prisma/apimodel'
import store from './store'
import { toast } from 'vue3-toastify'

export interface ApiOptions {
  hideToast?: boolean
}

export class Api {
  axios: AxiosStatic

  constructor() {
    this.axios = axios
    this.axios.defaults.baseURL = import.meta.env.VITE_APP_BACK_BASE_URL
    this.setHeader()
  }

  async get<T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    config?: AxiosRequestConfig<D> | undefined,
    options?: ApiOptions
  ): Promise<R> {
    return await new Promise((resolve, reject) => {
      axios
        .get<T, R, D>(url, config)
        .then((response) => {
          resolve(response)
        })
        .catch((err) => {
          if (!options?.hideToast) {
            toast.error(
              err.response?.data?.message ||
                err.message ||
                'エラーが発生しました'
            )
          }
          reject(err)
        })
    })
  }

  async delete<T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    config?: AxiosRequestConfig<D> | undefined,
    options?: ApiOptions
  ): Promise<R> {
    return await new Promise((resolve, reject) => {
      axios
        .delete<T, R, D>(url, config)
        .then((response) => {
          resolve(response)
        })
        .catch((err) => {
          if (!options?.hideToast) {
            toast.error(
              err.response?.data?.message ||
                err.message ||
                'エラーが発生しました'
            )
          }
          reject(err)
        })
    })
  }

  async put<T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    data?: D | undefined,
    config?: AxiosRequestConfig<D> | undefined,
    options?: ApiOptions
  ): Promise<R> {
    return await new Promise((resolve, reject) => {
      axios
        .put<T, R, D>(url, data, config)
        .then((response) => {
          resolve(response)
        })
        .catch((err) => {
          if (!options?.hideToast) {
            toast.error(
              err.response?.data?.message ||
                err.message ||
                'エラーが発生しました'
            )
          }
          reject(err)
        })
    })
  }

  async post<T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    data?: D | undefined,
    config?: AxiosRequestConfig<D> | undefined,
    options?: ApiOptions
  ): Promise<R> {
    return await new Promise((resolve, reject) => {
      axios
        .post<T, R, D>(url, data, config)
        .then((response) => {
          resolve(response)
        })
        .catch((err) => {
          if (!options?.hideToast) {
            toast.error(
              err.response?.data?.message ||
                err.message ||
                'エラーが発生しました'
            )
          }
          reject(err)
        })
    })
  }

  setHeader() {
    this.axios.defaults.headers.common = {
      Authorization: store.token,
    }
  }

  postTempUser(mailaddress: string, type: 'regist' | 'update') {
    return this.post('/temp/users', {
      mailaddress,
      type,
    } as AltUserRequest)
  }

  postUser(
    code: string,
    name: string,
    password: string,
    passwordRetype: string
  ) {
    return this.post<PostLogin>('/users', {
      code: code,
      name: name,
      password: password,
      password_retype: passwordRetype,
    } as PostUserRequest)
  }

  putUser(
    code: string,
    name: string,
    password: string,
    passwordRetype: string
  ) {
    return this.put<PostLogin>('/users', {
      code: code,
      name: name,
      password: password,
      password_retype: passwordRetype,
    } as PostUserRequest)
  }

  getUser() {
    return this.get<UserResponse>('/user')
  }

  getLogin(mailaddress: string, password: string) {
    return this.get<PostLogin>('/login', {
      params: {
        mailaddress: mailaddress,
        password: password,
      },
    })
  }

  postGame(
    title: string,
    password: string,
    memberCount: number,
    finnalyReleasing: boolean,
    discussionSeconds: number,
    maxTurns: number
  ) {
    return this.post<PostGameResponse>('/game', {
      title,
      memberCount,
      password,
      finnalyReleasing,
      discussionSeconds,
      maxTurns,
    } as PostGameRequest)
  }

  deleteCancelGame(name: string) {
    return this.delete<PostGameResponse>(`/game/${name}/cancel`)
  }

  getMyGame() {
    return this.get<MyGameResponse>('/my-game', undefined)
  }

  getGame(name: string, options?: ApiOptions) {
    return this.get<GetGameResponse>(`/game/${name}`, undefined, options)
  }

  postJoinGame(name: string, password: string) {
    return this.post(`/game/${name}/join`, {
      password: password,
    } as PostJoinGameRequest)
  }

  getLoginCheck() {
    return this.get<PostLogin>('/login/check')
  }

  postStartAction(gameName: string) {
    return this.post(`/game/${gameName}/start`)
  }

  putInputWord(gameName: string, word: string) {
    return this.put(`/game/${gameName}/input`, {
      word,
    } as PutInputRequest)
  }

  putVote(gameName: string, userCode: string) {
    return this.put(`/game/${gameName}/vote`, {
      userCode,
    } as PutVoteRequest)
  }

  putNext(gameName: string) {
    return this.put(`/game/${gameName}/next`)
  }

  getHistory(params?: { page?: number; perPage?: number; search?: string }) {
    params = {
      page: 1,
      perPage: 30,
      search: '',
      ...params,
    }
    return this.get<HistoryGameResponse[]>(
      `/history?page=${params.page}&per_page=${params.perPage}&search=${params.search}`
    )
  }

  putEncrypt(gameName: string) {
    return this.put(`/game/${gameName}/encrypt`)
  }
}

const api = new Api()

export default api
