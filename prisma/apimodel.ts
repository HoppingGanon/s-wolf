export interface AltUserRequest {
  mailaddress: string
}

export interface ErrorResponse {
  code: `${string}-${number}`
  message: string
}

export interface PostUserRequest {
  name: string
  password: string
  password_retype: string
  code: string
}

export interface PostLogin {
  token: string
  code: string
}

export interface PostGameRequest {
  title: string
  password: string
  memberCount: number
  finnalyReleasing: boolean
}

export interface PostGameResponse {
  gameName: string
  password: string
}

export interface MyGameResponse {
  exists: boolean
  gameName?: string
}

export type ActionType =
  | 'READY'
  | 'INPUT'
  | 'DISCUSSION'
  | 'JUDGEMENT'
  | 'EXECUTION'
  | 'PLOT'
  | 'KILL'
  | 'RESULT'

export interface MaskedUserData {
  code: string
  name: string
}
export interface GameUserData extends MaskedUserData {
  isDied: boolean
}

export interface CheckedResponse {
  opened: boolean
  message: string
}

export interface UserActionData {
  code: string
  name: string
  completed: boolean
}

export interface GetGameResponse extends CheckedResponse {
  name?: string
  title?: string

  hostUser?: MaskedUserData
  users?: GameUserData[]

  currentAction?: ActionType
  userActions?: UserActionData[]

  maxMembers?: number
}

export interface PostJoinGameRequest {
  password: string
}

export interface PutInputRequest {
  word: string
}
