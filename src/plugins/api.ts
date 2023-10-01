import axios, { AxiosStatic } from 'axios'
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
} from '../../prisma/apimodel'
import store from './store'

export class Api {
  axios: AxiosStatic

  constructor() {
    this.axios = axios
    this.axios.defaults.baseURL = import.meta.env.VITE_APP_BACK_BASE_URL
    this.setHeader()
  }

  setHeader() {
    this.axios.defaults.headers.common = {
      Authorization: store.token,
    }
  }

  postTempUser(mailaddress: string) {
    return this.axios.post('/temp/users', {
      mailaddress: mailaddress,
    } as AltUserRequest)
  }

  postUser(
    code: string,
    name: string,
    password: string,
    passwordRetype: string
  ) {
    return this.axios.post<PostLogin>('/users', {
      code: code,
      name: name,
      password: password,
      password_retype: passwordRetype,
    } as PostUserRequest)
  }

  getLogin(mailaddress: string, password: string) {
    return this.axios.get<PostLogin>('/login', {
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
    discussionSeconds: number
  ) {
    return this.axios.post<PostGameResponse>('/game', {
      title,
      memberCount,
      password,
      finnalyReleasing,
      discussionSeconds,
    } as PostGameRequest)
  }

  deleteCancelGame(name: string) {
    return this.axios.delete<PostGameResponse>(`/game/${name}/cancel`)
  }

  getMyGame() {
    return this.axios.get<MyGameResponse>('/my-game')
  }

  getGame(name: string) {
    return this.axios.get<GetGameResponse>(`/game/${name}`)
  }

  postJoinGame(name: string, password: string) {
    return this.axios.post(`/game/${name}/join`, {
      password: password,
    } as PostJoinGameRequest)
  }

  getLoginCheck() {
    return this.axios.get<PostLogin>('/login/check')
  }

  postStartAction(gameName: string) {
    return this.axios.post(`/game/${gameName}/start`)
  }

  putInputWord(gameName: string, word: string) {
    return this.axios.put(`/game/${gameName}/input`, {
      word,
    } as PutInputRequest)
  }

  putVote(gameName: string, userCode: string) {
    return this.axios.put(`/game/${gameName}/vote`, {
      userCode,
    } as PutVoteRequest)
  }
}

const api = new Api()

export default api
