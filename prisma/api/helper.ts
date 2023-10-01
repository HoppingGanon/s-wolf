import fs from 'fs'
import jwt from 'jsonwebtoken'
import express, { Response, Request } from 'express'
import crypto from 'crypto'
import prisma from '../prisma'
import { ErrorResponse, TOKEN_LIFE_MINUTES } from '../apimodel'

/**
 * 文字列をハッシュ化する処理
 * 参考: https://www.datacurrent.co.jp/column/jssha256-20211222
 */
export function digestMessage(message: string, salt: string) {
  return new Promise((resolve: (v: string) => void) => {
    var msgUint8 = new TextEncoder().encode(
      message + process.env.PASSWORD_SALT + salt
    )
    crypto.subtle.digest('SHA-256', msgUint8).then(function (hashBuffer) {
      var hashArray = Array.from(new Uint8Array(hashBuffer))
      var hashHex = hashArray
        .map(function (b) {
          return b.toString(16).padStart(2, '0')
        })
        .join('')
      return resolve(hashHex)
    })
  })
}

const privateKey = fs.readFileSync('prisma/private.key')

export function createToken(code: string) {
  return jwt.sign({ code: code }, privateKey, {
    algorithm: 'HS256',
    expiresIn: `${TOKEN_LIFE_MINUTES}m`,
  })
}

export function write401(res: Response, code: string, mes?: string) {
  res.status(401)
  res.json({
    code: `token-${code}`,
    message: mes || 'トークンが不正です',
  } as ErrorResponse)
}

export function createRandomChars(cnt: number) {
  let s = ''
  for (let i = 0; i < cnt; i++) {
    s += crypto.randomInt(0, 32).toString(32)
  }
  return s
}

export async function verifyToken(req: Request, res: Response) {
  try {
    const aToken = req.headers?.authorization || ''
    if (!aToken || aToken.length < 5) {
      write401(res, '001', 'トークンがありません')
      return false
    }
    if (aToken.substring(0, 4) !== 'jwt:') {
      write401(res, '002')
      return false
    }

    const token = aToken.substring(4)

    const decoded = jwt.decode(token)
    if (decoded && typeof decoded !== 'string' && decoded.exp) {
      if (decoded.exp < new Date().getTime() / 1000) {
        write401(res, '003', 'トークンが期限切れです')
        return false
      }
    }
    const payload = jwt.verify(token, privateKey) as { code: string }

    const user = await prisma.user.findFirst({
      where: {
        code: payload.code,
      },
    })
    if (user === null) {
      write401(res, '004')
      return false
    } else {
      return user
    }
  } catch (err) {
    write401(res, '005')
    return false
  }
}
