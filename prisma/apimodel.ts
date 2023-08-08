export interface AltUserRequest {
  mailaddress: string
}

export interface ErrorResponse {
  code: `${string}-${number}`
  message: string
}

export interface User {}
