import app from '../app'
import {
  LIMIT_INPUT_SECONDS,
  ErrorResponse,
  PutInputRequest,
  PutVoteRequest,
  LIMIT_EXECUTION_SECONDS,
} from '../apimodel'
import { baseRule, requiredRule, valid } from '../../shared/rules'
import prisma from '../prisma'
import { getGameInfo } from './helper'

app.post('/game/:name/start', async (req, res) => {
  const gameObj = await getGameInfo(req, res)
  if (gameObj === null) {
    return
  }

  if (gameObj.action.type !== 'READY') {
    res.status(400)
    res.json({
      code: 'start-001',
      message: `ゲームの状態が${gameObj.action.type}なため開始できません`,
    } as ErrorResponse)
    return
  }

  if (gameObj.game.users.length < 3) {
    res.status(400)
    res.json({
      code: 'start-002',
      message: '参加人数は3人以上である必要があります',
    } as ErrorResponse)
    return
  }

  await prisma.$transaction(async (prisma) => {
    const timeLimit = new Date()
    timeLimit.setSeconds(timeLimit.getSeconds() + LIMIT_INPUT_SECONDS)
    const action = await prisma.action.create({
      data: {
        id: undefined,
        gameId: gameObj.game.id,
        type: 'INPUT',
        timeLimit: timeLimit,
      },
    })

    for (let u of gameObj.game.users) {
      await prisma.userAction.create({
        data: {
          id: undefined,
          gameId: gameObj.game.id,
          userId: u.user.id,
          actionId: action.id,
          completed: false,
        },
      })
    }
  })

  res.status(201)
  res.json()
})

app.put<any, any, any, PutInputRequest>(
  '/game/:name/input',
  async (req, res) => {
    const word = '' + req.body.word

    const result = valid(word, [requiredRule, baseRule])
    if (result !== true) {
      res.status(400)
      res.json({
        code: 'input-001',
        message: result,
      } as ErrorResponse)
      return
    }

    const gameObj = await getGameInfo(req, res)
    if (gameObj === null) {
      return
    }

    if (gameObj.action.type !== 'INPUT') {
      res.status(400)
      res.json({
        code: 'input-002',
        message: `ゲームの状態が${gameObj.action.type}なため開始できません`,
      } as ErrorResponse)
      return
    }

    const ualist = gameObj.action.userActions.filter((ua) => {
      return ua.userId === gameObj.user.id
    })
    if (ualist.length === 0) {
      res.status(404)
      res.json({
        code: 'input-003',
        message: 'ユーザーが存在しません',
      } as ErrorResponse)
      return
    }

    const userAction = ualist[0]

    if (userAction.completed) {
      res.status(400)
      res.json({
        code: 'input-004',
        message: 'すでに入力が終了しています',
      } as ErrorResponse)
      return
    }

    try {
      await prisma.$transaction(async (prisma) => {
        await prisma.gameOnUser.update({
          data: {
            fetishism: word,
          },
          where: {
            userId_gameId: {
              userId: gameObj.user.id,
              gameId: gameObj.game.id,
            },
          },
        })

        await prisma.userAction.update({
          data: {
            completed: true,
          },
          where: {
            id: userAction.id,
          },
        })
      })
    } catch {
      res.status(400)
      res.json({
        code: 'input-007',
        message: '参加に失敗しました',
      } as ErrorResponse)
    }

    await prisma.userAction
      .count({
        where: {
          actionId: gameObj.action.id,
          completed: true,
        },
      })
      .then((cnt) => {
        if (gameObj.game.users.length === cnt) {
          const timeLimit = new Date()
          timeLimit.setSeconds(
            timeLimit.getSeconds() + gameObj.game.discussionSeconds
          )
          prisma.action
            .create({
              data: {
                type: 'DISCUSSION',
                gameId: gameObj.game.id,
                timeLimit: timeLimit,
              },
            })
            .catch((err) => {
              console.log(err)
            })
        }
      })
      .catch((err) => {
        console.log(err)
      })
    res.status(200)
    res.json()
  }
)

app.put<any, any, any, PutVoteRequest>('/game/:name/vote', async (req, res) => {
  const userCode = '' + req.body.userCode

  const result = valid(userCode, [requiredRule])
  if (result !== true) {
    res.status(400)
    res.json({
      code: 'judge-001',
      message: result,
    } as ErrorResponse)
    return
  }

  const gameObj = await getGameInfo(req, res)
  if (gameObj === null) {
    return
  }

  if (gameObj.action.type !== 'JUDGEMENT') {
    res.status(400)
    res.json({
      code: 'judge-002',
      message: `ゲームの状態が${gameObj.action.type}なため投票できません`,
    } as ErrorResponse)
    return
  }

  const ualist = gameObj.action.userActions.filter((ua) => {
    return ua.userId === gameObj.user.id
  })
  if (ualist.length === 0) {
    res.status(404)
    res.json({
      code: 'judge-003',
      message: 'ユーザーが存在しません',
    } as ErrorResponse)
    return
  }

  const userAction = ualist[0]

  if (userAction.completed) {
    res.status(400)
    res.json({
      code: 'judge-004',
      message: 'すでに入力が終了しています',
    } as ErrorResponse)
    return
  }

  const votedGameOnUser = await prisma.gameOnUser.findFirst({
    where: {
      user: {
        code: userCode,
      },
      gameId: gameObj.game.id,
    },
  })

  if (!votedGameOnUser) {
    res.status(400)
    res.json({
      code: 'judge-005',
      message: '投票したユーザーはゲーム内に存在しません',
    } as ErrorResponse)
    return
  }

  try {
    await prisma.$transaction(async (prisma) => {
      // 投票
      await prisma.userAction.update({
        data: {
          completed: true,
          vote: {
            create: {
              votedUserId: votedGameOnUser.userId,
            },
          },
        },
        where: {
          id: userAction.id,
        },
      })
    })
  } catch {
    res.status(400)
    res.json({
      code: 'judge-006',
      message: '参加に失敗しました',
    } as ErrorResponse)
  }

  await prisma.userAction
    .count({
      where: {
        actionId: gameObj.action.id,
        completed: true,
      },
    })
    .then((cnt) => {
      if (gameObj.game.users.length === cnt) {
        const timeLimit = new Date()
        timeLimit.setSeconds(timeLimit.getSeconds() + LIMIT_EXECUTION_SECONDS)
        prisma.action
          .create({
            data: {
              type: 'EXECUTION',
              gameId: gameObj.game.id,
              timeLimit: timeLimit,
            },
          })
          .catch((err) => {
            console.log(err)
          })
      }
    })
    .catch((err) => {
      console.log(err)
    })
  res.status(200)
  res.json()
})

app.delete<any, any, any, PutInputRequest>(
  '/game/:name/cancel',
  async (req, res) => {
    const gameObj = await getGameInfo(req, res)
    if (gameObj === null) {
      return
    }

    if (gameObj.user.id !== gameObj.game.hostUserId) {
      res.status(401)
      res.json({
        code: 'cancel-001',
        message: '終了する権限がありません',
      } as ErrorResponse)
      return
    }

    await prisma.game
      .update({
        data: {
          status: 'CANCEL',
        },
        where: {
          id: gameObj.game.id,
        },
      })
      .then(() => {
        res.status(204)
        res.json()
      })
      .catch(() => {
        res.status(500)
        res.json({
          code: 'cancel-002',
          message: 'ゲームを終了できませんでした',
        } as ErrorResponse)
      })
  }
)
