import express from 'express'
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'
import { AltUserRequest, ErrorResponse } from './apimodel'
import mail from './mail'

const prisma = new PrismaClient()
const app = express()
app.use(express.json())

app.post<any, any, any, AltUserRequest>('/temp/users', async (_req, res) => {
  const address = _req.body.mailaddress

  if (
    (await prisma.user.count({
      where: {
        mailaddress: address,
      },
    })) > 0
  ) {
    res.status(400)
    res.json({
      code: 'temp/user-001',
      message: '既に登録済みのアドレスです',
    } as ErrorResponse)
    return
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
        code: 'temp/user-002',
        message: '仮登録ユーザーの削除に失敗しました',
      } as ErrorResponse)
      return
    }
  }

  const code = crypto.randomUUID()

  try {
    await mail.send(
      address,
      's-wolf 仮登録',
      `
s-wolfへようこそ

現在仮登録状態です。
以下のリンクをクリックすると、本登録が完了します。
${process.env.FRONT_BASE_URL}/resist/code/${code}

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
      code: 'temp/user-003',
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
        code: 'temp/user-004',
        message: '仮ユーザーの作成に失敗しました',
      } as ErrorResponse)
    })
})

app.get('/users', async (_req, res) => {
  const users = await prisma.user.findMany()
  res.json(users)
})

export default app
