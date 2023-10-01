import express, { Response, Request } from 'express'
import crypto from 'crypto'
import { ActionType, Game, GameStatusTytpe } from '@prisma/client'
import {
  MAX_OPENED_GAME_MINUTES,
  LIMIT_READY_SECONDS,
  LIMIT_INPUT_SECONDS,
  LIMIT_JUDGEMENT_SECONDS,
  // LIMIT_PLOT_SECONDS,
  ErrorResponse,
  GameUserData,
  GetGameResponse,
  MyGameResponse,
  PostGameRequest,
  PostGameResponse,
  PostLogin,
  UserActionData,
  PostJoinGameRequest,
  PutInputRequest,
  CheckedResponse,
  PutVoteRequest,
  LIMIT_EXECUTION_SECONDS,
} from './apimodel'
import {
  baseRule,
  memberCountRule,
  passwordRule,
  requiredRule,
  valid,
} from '../shared/rules'
import prisma from './prisma'
import {
  createRandomChars,
  createToken,
  digestMessage,
  verifyToken,
} from './api/helper'

const app = express()

// デフォルトエラー処理 エラー処理されていないエラーが発生した場合に実行する処理
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error(err.stack)
  res.status(500).send("I'll be Internal Server Error!!!(Don!)")
})

// デフォルトヘッダ
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, access_token'
  )

  if ('OPTIONS' === req.method) {
    res.send(200)
  } else {
    next()
  }
})
app.use(express.json())

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
  }
  result = valid(password, [requiredRule, baseRule])
  if (result !== true) {
    res.status(400)
    res.json({
      code: 'login-002',
      message: result,
    } as ErrorResponse)
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

app.get('/users', async (_req, res) => {
  if ((await verifyToken(_req, res)) === false) {
    return
  }

  const users = await prisma.user.findMany()
  res.json(users)
})

app.post<any, any, any, PostGameRequest>('/game', async (_req, res) => {
  const title = _req.body.title
  const password = _req.body.password
  const memberCount = _req.body.memberCount
  const finnalyReleasing = _req.body.finnalyReleasing
  const discussionSeconds = _req.body.discussionSeconds

  const user = await verifyToken(_req, res)
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
          password: await digestMessage(password, gameName),
          finnalyReleasing: finnalyReleasing,
          maxMembers: memberCount,
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
      code: 'postgames-004',
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
      code: 'postgames-005',
      message: 'ゲームの作成に失敗しました',
    } as ErrorResponse)
    return
  }
})

app.get('/my-game', async (_req, res) => {
  const user = await verifyToken(_req, res)
  if (user === false) {
    return
  }

  const game = await prisma.game.findFirst({
    where: {
      hostUserId: user.id,
      status: 'OPENED',
    },
  })

  if (game) {
    const action = await prisma.action.findFirst({
      where: {
        gameId: game.id,
      },
      orderBy: {
        id: 'desc',
      },
    })
    if (action) {
      const chk = await checkGame(game, action)
      if (!chk.opened) {
        res.status(200)
        res.json({
          exists: false,
          gameName: undefined,
        } as MyGameResponse)
        return
      }
    }
  }

  res.status(200)
  res.json({
    exists: !!game,
    gameName: game?.gameName,
  } as MyGameResponse)
  return
})

async function checkGame(
  game: {
    id: number
    status: GameStatusTytpe
    createdAt: Date
    timeLimit: Date
  },
  action: { id: number; type: ActionType; createdAt: Date; timeLimit: Date }
): Promise<CheckedResponse> {
  switch (game.status) {
    case 'OPENED':
      break
    case 'TIMEUP':
      return {
        opened: false,
        message: 'ゲームはタイムアップにより終了しました',
      }
    case 'CANCEL':
      return {
        opened: false,
        message: 'ゲームはホストユーザーによって終了しました',
      }
    case 'COLLAPSE':
      return {
        opened: false,
        message: 'ゲームは参加ユーザーによって解散しました',
      }
    case 'COMPLETED':
      return {
        opened: false,
        message: 'ゲームは正常に終了しました',
      }
    case 'ERROR':
      return {
        opened: false,
        message: 'ゲームは異常終了しました',
      }
  }
  if (game.timeLimit < new Date()) {
    await prisma.game
      .update({
        where: {
          id: game.id,
        },
        data: {
          status: 'TIMEUP',
        },
      })
      .catch((err) => {
        console.log(err)
      })
    return {
      opened: false,
      message: 'ゲームをタイムアップにより終了します',
    }
  }

  if (action.timeLimit < new Date()) {
    if (action.type === 'DISCUSSION') {
      await prisma.$transaction(async (prisma) => {
        const foundGame = await prisma.game.findFirst({
          where: {
            id: game.id,
          },
          include: {
            users: true,
          },
        })
        if (!foundGame) {
          // ここには来ないはず
          return {
            opened: false,
            message: 'ユーザーが見つかりません',
          }
        }

        const timeLimit = new Date()
        timeLimit.setSeconds(timeLimit.getSeconds() + LIMIT_JUDGEMENT_SECONDS)
        await prisma.action.create({
          data: {
            id: undefined,
            gameId: game.id,
            type: 'JUDGEMENT',
            timeLimit: timeLimit,
          },
        })

        for (let u of foundGame.users) {
          await prisma.userAction.create({
            data: {
              id: undefined,
              gameId: game.id,
              userId: u.userId,
              actionId: action.id,
              // 生きていなければfalse
              completed: u.isDied,
            },
          })
        }
      })

      return {
        opened: true,
        message: '',
      }
    } else {
      await prisma.game
        .update({
          where: {
            id: game.id,
          },
          data: {
            status: 'TIMEUP',
          },
        })
        .catch((err) => {
          console.log(err)
        })
      return {
        opened: false,
        message: 'ゲームをタイムアップにより終了します',
      }
    }
  }
  return {
    opened: true,
    message: '',
  }
}

const getGameInfo = async (req: Request, res: Response) => {
  const name = typeof req.params.name === 'string' ? req.params.name : ''

  const user = await verifyToken(req, res)
  if (user === false) {
    return null
  }

  const result = valid(name, [requiredRule, baseRule])
  if (result !== true) {
    res.status(400)
    res.json({
      code: 'getgameinfo-002',
      message: result,
    } as ErrorResponse)
    return null
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
    },
  })

  if (game === null) {
    res.status(404)
    res.json({
      code: 'getgameinfo-002',
      message: 'ゲームが見つかりませんでした',
    } as ErrorResponse)
    return null
  }

  if (game.hostUserId !== user.id) {
    if (game.users.filter((u) => u.userId === user.id).length === 0) {
      // 参加済みユーザー

      res.status(403)
      res.json({
        code: 'getgameinfo-003',
        message: '参加ユーザーではありません',
      } as ErrorResponse)
      return null
    }
  }

  const action = await prisma.action.findFirst({
    where: {
      gameId: game.id,
    },
    orderBy: {
      id: 'desc',
    },
    include: {
      userActions: {
        include: {
          user: true,
        },
      },
    },
  })

  if (action === null) {
    res.status(403)
    res.json({
      code: 'getgameinfo-004',
      message: 'ターンの整合性がありません',
    } as ErrorResponse)
    return null
  }

  const checked = await checkGame(game, action)

  if (!checked.opened) {
    res.status(200)
    res.json(checked)
    return null
  }

  const userActions: UserActionData[] = action.userActions.map((v) => {
    return {
      code: v.user.code,
      name: v.user.name,
      completed: v.completed,
    }
  })

  const users: GameUserData[] = game.users.map((v) => {
    return {
      code: v.user.code,
      name: v.user.name,
      isDied: v.isDied,
    }
  })

  const data: GetGameResponse = {
    opened: true,
    message: 'ゲームの取得に成功しました',

    name: game.gameName,
    title: game.gameTitle,

    hostUser: {
      code: game.hostUser.code,
      name: game.hostUser.name,
    },
    users: users,

    maxMembers: game.maxMembers,
    discussionSeconds: game.discussionSeconds,

    userActions: userActions,
    currentAction: action.type,
    actionTimeLimit: Math.floor(
      (action.timeLimit.valueOf() - new Date().valueOf()) / 1000
    ),
  }

  return {
    user,
    game,
    data,
    action,
  }
}

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

    if (game.password !== (await digestMessage(password, name))) {
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

export default app
