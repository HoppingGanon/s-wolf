import { User } from '@prisma/client'
import { baseRule, passwordRule, requiredRule, valid } from '../../shared/rules'
import {
  AltUserRequest,
  ErrorResponse,
  PostLogin,
  PostUserRequest,
  UserResponse,
} from '../apimodel'
import app from '../app'
import mail from '../mail'
import prisma from '../prisma'
import { createToken, digestMessage, verifyToken } from './helper'
import crypto from 'crypto'

app.post<any, any, any, AltUserRequest>('/temp/users', async (_req, res) => {
  const address = _req.body.mailaddress
  const typeStr = _req.body.type

  if (!['regist', 'update'].includes(typeStr)) {
    res.status(400)
    res.json({
      code: 'temp/user-001',
      message: 'type指定が間違っています',
    } as ErrorResponse)
    return
  }

  if (typeStr === 'regist') {
    if (
      (await prisma.user.count({
        where: {
          mailaddress: address,
        },
      })) > 0
    ) {
      res.status(400)
      res.json({
        code: 'temp/user-002',
        message: '既に登録済みのアドレスです',
      } as ErrorResponse)
      return
    }
  } else {
    const user = await verifyToken(_req, res)
    if (user === false) {
      return null
    }
    if (
      user.mailaddress !== address &&
      (await prisma.user.count({
        where: {
          mailaddress: address,
        },
      })) > 0
    ) {
      res.status(400)
      res.json({
        code: 'temp/user-002',
        message: '既に登録済みのアドレスです',
      } as ErrorResponse)
      return
    }
  }

  if (
    (await prisma.altUser.count({
      where: {
        mailaddress: address,
      },
    })) > 0
  ) {
    // 代替ユーザー有り
    try {
      await prisma.altUser.deleteMany({
        where: {
          mailaddress: address,
        },
      })
    } catch {
      res.status(400)
      res.json({
        code: 'temp/user-003',
        message: '仮登録ユーザーの削除に失敗しました',
      } as ErrorResponse)
      return
    }
  }

  const code = crypto.randomUUID()

  try {
    await mail.send(
      address,
      typeStr === 'regist' ? 's-wolf 仮登録' : 's-wolfユーザー情報変更',
      `
${typeStr === 'regist' ? 's-wolfへようこそ' : 's-wolfのユーザー情報変更'}


${typeStr === 'regist' ? '現在仮登録状態です。' : 'ユーザー情報を変更します。'}
以下のリンクを開くと、${
        typeStr === 'regist'
          ? '本登録が完了します。'
          : 'ユーザー情報を変更します。'
      }
${process.env.VITE_APP_FRONT_BASE_URL}/${typeStr}/temp/${code}

--------------------------------------------------
s-wolf運営 ほっぴんぐがのん

Twitter...じゃなくてX(笑): @hoppingganonapp
email: hoppingganon@gmail.com
--------------------------------------------------
`
    )
  } catch (err) {
    console.log(err)
    res.status(400)
    res.json({
      code: 'temp/user-004',
      message: 'メール送信に失敗しました',
    } as ErrorResponse)
    return
  }

  await prisma.altUser
    .create({
      data: {
        id: undefined,
        mailaddress: address,
        resistCode: code,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .then(() => {
      res.status(201)
      res.json()
    })
    .catch((err) => {
      console.log(err)
      res.status(400)
      res.json({
        code: 'temp/user-005',
        message: '仮ユーザーの作成に失敗しました',
      } as ErrorResponse)
    })
})

app.post<any, any, any, PostUserRequest>('/users', async (_req, res) => {
  const name = _req.body.name
  const password = _req.body.password
  const code = _req.body.code

  if (_req.body.password_retype !== password) {
    res.status(400)
    res.json({
      code: 'user-001',
      message: 'パスワードが一致しません',
    } as ErrorResponse)
    return
  }

  let result = valid(name, [requiredRule, baseRule])
  if (result !== true) {
    res.status(400)
    res.json({
      code: 'user-002',
      message: result,
    } as ErrorResponse)
    return
  }

  result = valid(password, [requiredRule, passwordRule])
  if (result !== true) {
    res.status(400)
    res.json({
      code: 'user-003',
      message: result,
    } as ErrorResponse)
    return
  }

  const altUser = await prisma.altUser.findFirst({
    where: {
      resistCode: code,
    },
  })

  if (altUser == null) {
    res.status(400)
    res.json({
      code: 'user-004',
      message: '仮登録データが存在しません',
    } as ErrorResponse)
    return
  }

  let user: User | undefined = undefined
  try {
    user = await prisma.user.create({
      data: {
        id: undefined,
        code: crypto.randomUUID(),
        games: undefined,
        hostGame: undefined,

        name: name,
        password: '',
        mailaddress: altUser.mailaddress,
        createdAt: undefined,
        updatedAt: undefined,
      },
    })
    await prisma.user.update({
      data: {
        password: await digestMessage(password, '' + user.id),
      },
      where: {
        id: user.id,
      },
    })
  } catch {
    res.status(400)
    res.json({
      code: 'user-005',
      message: 'ユーザーの作成に失敗しました',
    } as ErrorResponse)
  }

  try {
    await prisma.altUser.deleteMany({
      where: {
        resistCode: code,
      },
    })
  } catch {
    res.status(400)
    res.json({
      code: 'user-006',
      message: 'ユーザーの作成に失敗しました',
    } as ErrorResponse)
  }

  res.status(201)
  res.json({
    token:
      'jwt:' +
      createToken(user ? user.code : 'error-jwt=' + crypto.randomUUID()),
    code: user ? user.code : 'error-id',
  } as PostLogin)
})

app.put<any, any, any, PostUserRequest>('/users', async (req, res) => {
  const name = req.body.name
  const password = req.body.password
  const code = req.body.code

  if (req.body.password_retype !== password) {
    res.status(400)
    res.json({
      code: 'update/user-001',
      message: 'パスワードが一致しません',
    } as ErrorResponse)
    return
  }

  let result = valid(name, [requiredRule, baseRule])
  if (result !== true) {
    res.status(400)
    res.json({
      code: 'update/user-002',
      message: result,
    } as ErrorResponse)
    return
  }

  result = valid(password, [requiredRule, passwordRule])
  if (result !== true) {
    res.status(400)
    res.json({
      code: 'update/user-003',
      message: result,
    } as ErrorResponse)
    return
  }

  const user = await verifyToken(req, res)
  if (user === false) {
    return null
  }

  const altUser = await prisma.altUser.findFirst({
    where: {
      resistCode: code,
    },
  })

  if (altUser == null) {
    res.status(400)
    res.json({
      code: 'update/user-005',
      message: '仮登録データが存在しません',
    } as ErrorResponse)
    return
  }

  try {
    await prisma.user.update({
      data: {
        mailaddress: altUser.mailaddress,
        name: name,
        password: await digestMessage(password, '' + user.id),
      },
      where: {
        id: user.id,
      },
    })

    res.status(200)
    res.json({
      token:
        'jwt:' +
        createToken(user ? user.code : 'error-jwt=' + crypto.randomUUID()),
      code: user ? user.code : 'error-id',
    } as PostLogin)
  } catch {
    res.status(400)
    res.json({
      code: 'update/user-006',
      message: 'ユーザー更新に失敗しました',
    } as ErrorResponse)
  }

  try {
    await prisma.altUser.deleteMany({
      where: {
        resistCode: code,
      },
    })
  } catch {
    // ignore
  }
})

app.get('/user', async (_req, res) => {
  const user = await verifyToken(_req, res)
  if (user === false) {
    return
  }

  res.status(200)
  res.json({
    code: user.code,
    name: user.name,
    mailaddress: user.mailaddress,
  } as UserResponse)
})
