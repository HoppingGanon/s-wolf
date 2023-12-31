import { Game } from '@prisma/client'
import {
  MAX_OPENED_GAME_MINUTES,
  LIMIT_READY_SECONDS,
  ErrorResponse,
  MyGameResponse,
  PostGameRequest,
  PostGameResponse,
  PostJoinGameRequest,
} from '../apimodel'
import {
  baseRule,
  memberCountRule,
  passwordRule,
  requiredRule,
  valid,
} from '../../shared/rules'
import prisma from '../prisma'
import { createRandomChars, verifyToken } from '../api/helper'
import { checkGame, getGameInfo } from './helper'
import app from '../app'
import { encrypt } from '../../shared/crypto'

app.get('/my-game', async (_req, res) => {
  const user = await verifyToken(_req, res)
  if (user === false) {
    return
  }

  const gameOnUser = await prisma.gameOnUser.findFirst({
    include: {
      game: {
        include: {
          users: true,
        },
      },
    },
    where: {
      userId: user.id,
      game: {
        status: 'OPENED',
      },
    },
    orderBy: {
      game: {
        createdAt: 'desc',
      },
    },
  })

  if (gameOnUser) {
    const action = await prisma.action.findFirst({
      where: {
        gameId: gameOnUser.game.id,
      },
      orderBy: {
        id: 'desc',
      },
    })
    if (action) {
      const chk = await checkGame(gameOnUser.game, action, user)
      if (!chk.opened) {
        res.status(200)
        res.json({
          exists: false,
          gameName: undefined,
        } as MyGameResponse)
        return
      }
    }

    res.status(200)
    res.json({
      exists: true,
      gameName: gameOnUser.game.gameName,
    } as MyGameResponse)
    return
  } else {
    res.status(200)
    res.json({
      exists: false,
    } as MyGameResponse)
    return
  }
})

app.post<any, any, any, PostGameRequest>('/game', async (req, res) => {
  const title = req.body.title
  const password = req.body.password
  const memberCount = req.body.memberCount
  const finnalyReleasing = req.body.finnalyReleasing
  const discussionSeconds = req.body.discussionSeconds
  const maxTurns = req.body.maxTurns

  const user = await verifyToken(req, res)
  if (user === false) {
    return
  }

  let result = valid(title, [requiredRule, baseRule])
  if (result !== true) {
    res.status(400)
    res.json({
      code: 'postgames-001',
      message: result,
    } as ErrorResponse)
  }

  result = memberCountRule(memberCount)
  if (result !== true) {
    res.status(400)
    res.json({
      code: 'postgames-002',
      message: result,
    } as ErrorResponse)
  }

  result = valid(password, [requiredRule, passwordRule])
  if (result !== true) {
    res.status(400)
    res.json({
      code: 'postgames-003',
      message: result,
    } as ErrorResponse)
  }

  if (!(maxTurns && maxTurns >= 1 && maxTurns <= 15)) {
    res.status(400)
    res.json({
      code: 'postgames-004',
      message: '最大ターン数は1～15で指定する必要があります',
    } as ErrorResponse)
  }

  const gameName =
    `${createRandomChars(3)}-${createRandomChars(3)}` +
    `-${createRandomChars(3)}`

  const data: { game?: Game } = {
    game: undefined,
  }

  try {
    let timeLimit = new Date()
    timeLimit.setMinutes(timeLimit.getMinutes() + MAX_OPENED_GAME_MINUTES)
    await prisma.$transaction(async (prisma) => {
      const game = await prisma.game.create({
        data: {
          gameName: gameName,
          gameTitle: title,
          hostUserId: user.id,
          password: password,
          finnalyReleasing: finnalyReleasing,
          maxMembers: memberCount,
          maxTurns: maxTurns,
          timeLimit: timeLimit,
          discussionSeconds: discussionSeconds,
          status: 'OPENED',
        },
      })

      await prisma.gameOnUser.create({
        data: {
          userId: user.id,
          user: undefined,
          gameId: game.id,
          game: undefined,
          fetishism: '',
          isDied: false,
        },
      })

      data.game = game
      timeLimit = new Date()
      timeLimit.setSeconds(timeLimit.getSeconds() + LIMIT_READY_SECONDS)
      await prisma.action.create({
        data: {
          id: undefined,
          type: 'READY',
          gameId: game.id,
          game: undefined,
          timeLimit: timeLimit,
        },
      })
    })
  } catch (e) {
    console.log(e)
    res.status(400)
    res.json({
      code: 'postgames-005',
      message: 'ゲームの作成に失敗しました',
    } as ErrorResponse)
    return
  }

  if (data.game) {
    res.status(201)
    res.json({
      gameName: data.game.gameName,
      password: password,
    } as PostGameResponse)
    return
  } else {
    res.status(400)
    res.json({
      code: 'postgames-006',
      message: 'ゲームの作成に失敗しました',
    } as ErrorResponse)
    return
  }
})

app.get('/game/:name', async (req, res) => {
  const gameData = await getGameInfo(req, res)
  if (gameData === null) {
    return
  }

  res.status(200)
  res.json(gameData.data)
  return
})

app.post<any, any, any, PostJoinGameRequest>(
  '/game/:name/join',
  async (req, res) => {
    const password = req.body.password
    const name = '' + req.params.name

    const user = await verifyToken(req, res)
    if (user === false) {
      return null
    }

    let result = valid(password, [requiredRule, passwordRule])
    if (result !== true) {
      res.status(400)
      res.json({
        code: 'joingame-001',
        message: result,
      } as ErrorResponse)
      return
    }

    result = valid(name, [requiredRule, baseRule])
    if (result !== true) {
      res.status(400)
      res.json({
        code: 'joingame-002',
        message: result,
      } as ErrorResponse)
      return
    }

    const game = await prisma.game.findFirst({
      where: {
        gameName: name,
      },
      include: {
        users: {
          include: {
            user: true,
          },
        },
        hostUser: true,
        actions: {
          orderBy: {
            id: 'desc',
          },
        },
      },
    })

    if (game === null) {
      res.status(404)
      res.json({
        code: 'joingame-003',
        message: 'ゲームが見つかりませんでした',
      } as ErrorResponse)
      return null
    }

    if (game.hostUserId !== user.id) {
      if (game.users.filter((u) => u.userId === user.id).length > 0) {
        // 参加済みユーザー

        res.status(400)
        res.json({
          code: 'joingame-004',
          message: '既に参加しています',
        } as ErrorResponse)
        return null
      }
    }

    if (game.password !== password) {
      res.status(403)
      res.json({
        code: 'joingame-005',
        message: 'パスワードが一致しません',
      } as ErrorResponse)
      return null
    }

    if (game.actions.length === 0 || game.actions[0].type !== 'READY') {
      res.status(401)
      res.json({
        code: 'joingame-006',
        message: 'ゲームの参加への募集が終了しています',
      })
      return
    }

    if (game.users.length >= game.maxMembers) {
      res.status(401)
      res.json({
        code: 'joingame-007',
        message: 'ゲームの参加人数が上限に達しています',
      })
      return
    }

    try {
      await prisma.gameOnUser.create({
        data: {
          gameId: game.id,
          userId: user.id,
          fetishism: '',
          isDied: false,
        },
      })
      res.status(201)
      res.json({})
    } catch {
      res.status(400)
      res.json({
        code: 'joingame-007',
        message: '参加に失敗しました',
      } as ErrorResponse)
    }
  }
)

app.get('/login/check', async (req, res) => {
  const user = await verifyToken(req, res)
  if (user === false) {
    return
  }
  res.status(200)
  res.json()
})

app.put('/game/:name/encrypt', async (req, res) => {
  try {
    const gameData = await getGameInfo(req, res)
    if (gameData === null) {
      return
    }

    if (gameData.game.status === 'OPENED') {
      res.status(400)
      res.json({
        code: 'encrypt-001',
        message: 'ゲームが開いてる間は暗号化できません',
      } as ErrorResponse)
      return
    }

    if (gameData.game.password === '') {
      res.status(400)
      res.json({
        code: 'encrypt-002',
        message: 'すでに暗号化済みです',
      } as ErrorResponse)
      return
    }

    await prisma.$transaction(async (prisma) => {
      for (let u of gameData.game.users) {
        if (u.fetishism) {
          await prisma.gameOnUser.updateMany({
            data: {
              fetishism: encrypt(u.fetishism, gameData.game.password),
            },
            where: {
              userId: u.userId,
              gameId: u.gameId,
            },
          })
        }
      }

      await prisma.game.update({
        data: {
          password: '',
        },
        where: {
          id: gameData.game.id,
        },
      })
    })

    res.status(200)
    res.json()
  } catch {
    res.status(400)
    res.json({
      code: 'encrypt-003',
      message: '暗号化に失敗しました',
    } as ErrorResponse)
  }
})
