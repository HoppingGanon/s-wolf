import { baseRule, requiredRule, valid } from '../../shared/rules'
import { ErrorResponse, PostLogin } from '../apimodel'
import app from '../app'
import prisma from '../prisma'
import { createToken, digestMessage } from './helper'
import crypto from 'crypto'

app.get('/login', async (_req, res) => {
  const mailaddress =
    typeof _req.query.mailaddress === 'string' ? _req.query.mailaddress : ''
  const password =
    typeof _req.query.password === 'string' ? _req.query.password : ''

  let result = valid(mailaddress, [requiredRule, baseRule])
  if (result !== true) {
    res.status(400)
    res.json({
      code: 'login-001',
      message: result,
    } as ErrorResponse)
    return
  }
  result = valid(password, [requiredRule, baseRule])
  if (result !== true) {
    res.status(400)
    res.json({
      code: 'login-002',
      message: result,
    } as ErrorResponse)
    return
  }

  const user = await prisma.user.findFirst({
    where: {
      mailaddress: mailaddress,
    },
  })

  if (user === null) {
    res.status(404)
    res.json({
      code: 'login-003',
      message: 'ユーザーが見つからないか、パスワードが一致しません',
    } as ErrorResponse)
    return
  }

  const userPasswordCount = await prisma.user.count({
    where: {
      mailaddress: mailaddress,
      password: await digestMessage(password, '' + user?.id),
    },
  })

  if (userPasswordCount === 0) {
    res.status(404)
    res.json({
      code: 'login-003',
      message: 'ユーザーが見つからないか、パスワードが一致しません',
    } as ErrorResponse)
    return
  }

  res.status(200)
  res.json({
    token:
      'jwt:' +
      createToken(user ? user.code : 'error-jwt=' + crypto.randomUUID()),
    code: user ? user.code : 'error-id',
  } as PostLogin)
})
