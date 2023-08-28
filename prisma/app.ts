import express, { Response, Request } from 'express'
import crypto from 'crypto'
import { ActionType, Game, GameStatusTytpe, User } from '@prisma/client'
import {
  AltUserRequest,
  ErrorResponse,
  GameUserData,
  GetGameResponse,
  MyGameResponse,
  PostGameRequest,
  PostGameResponse,
  PostUserRequest,
  PostLogin,
  UserActionData,
  PostJoinGameRequest,
  PutInputRequest,
  CheckedResponse,
} from './apimodel'
import mail from './mail'
import {
  baseRule,
  memberCountRule,
  passwordRule,
  requiredRule,
  valid,
} from '../shared/rules'
import jwt from 'jsonwebtoken'
import fs from 'fs'
import prisma from './prisma'

const TOKEN_LIFE_MINUTES = 2880
const MAX_OPENED_GAME_MINUTES = 30
const LIMIT_READY_SECONDS = 180
const LIMIT_INPUT_SECONDS = 180
const LIMIT_JUDGEMENT_SECONDS = 120
const LIMIT_PLOT_SECONDS = 120

const app = express()

const privateKey = fs.readFileSync('prisma/private.key')

/**
 * 文字列をハッシュ化する処理
 * 参考: https://www.datacurrent.co.jp/column/jssha256-20211222
 */
function digestMessage(message: string, salt: string) {
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

function createToken(code: string) {
  return jwt.sign({ code: code }, privateKey, {
    algorithm: 'HS256',
    expiresIn: `${TOKEN_LIFE_MINUTES}m`,
  })
}

function write401(res: Response, code: string, mes?: string) {
  res.status(401)
  res.json({
    code: `token-${code}`,
    message: mes || 'トークンが不正です',
  } as ErrorResponse)
}

function createRandomChars(cnt: number) {
  let s = ''
  for (let i = 0; i < cnt; i++) {
    s += crypto.randomInt(0, 32).toString(32)
  }
  return s
}

async function verifyToken(req: Request, res: Response) {
  try {
    if (!req.headers.authorization || req.headers.authorization.length < 5) {
      write401(res, '001', 'トークンがありません')
      return false
    }
    if (req.headers.authorization.substring(0, 4) !== 'jwt:') {
      write401(res, '002')
      return false
    }

    const token = req.headers.authorization.substring(4)

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
${process.env.VITE_APP_FRONT_BASE_URL}/resist/temp/${code}

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
    await prisma.$transaction(async (prisma) => {
      const game = await prisma.game.create({
        data: {
          id: undefined,
          gameName: gameName,
          gameTitle: title,
          hostUserId: user.id,
          password: await digestMessage(password, gameName),
          hostUser: undefined,
          users: undefined,
          createdAt: undefined,
          updatedAt: undefined,
          finnalyReleasing: finnalyReleasing,
          maxMembers: memberCount,
          actions: undefined,
        },
      })

      await prisma.gameOnUser.create({
        data: {
          userId: user.id,
          user: undefined,
          gameId: game.id,
          game: undefined,
          fetishism: '',
        },
      })

      data.game = game

      await prisma.action.create({
        data: {
          id: undefined,
          type: 'READY',
          gameId: game.id,
          game: undefined,
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

  res.status(200)
  res.json({
    exists: !!game,
    gameName: game ? game.gameName : undefined,
  } as MyGameResponse)
  return
})

async function checkGame(
  game: {
    id: number
    status: GameStatusTytpe
    discussionSeconds: number
    createdAt: Date
  },
  action: { id: number; type: ActionType; createdAt: Date }
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
  let timelimit = new Date()
  timelimit.setMinutes(timelimit.getMinutes() - MAX_OPENED_GAME_MINUTES)

  if (game.createdAt < timelimit) {
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

  timelimit = new Date()

  switch (action.type) {
    case 'READY':
      timelimit.setSeconds(timelimit.getSeconds() - LIMIT_READY_SECONDS)
      break
    case 'INPUT':
      timelimit.setSeconds(timelimit.getSeconds() - LIMIT_INPUT_SECONDS)
      break
    case 'DISCUSSION':
      timelimit.setSeconds(timelimit.getSeconds() - game.discussionSeconds)
      break
    case 'JUDGEMENT':
      timelimit.setSeconds(timelimit.getSeconds() - LIMIT_JUDGEMENT_SECONDS)
      break
    case 'PLOT':
      timelimit.setSeconds(timelimit.getSeconds() - LIMIT_PLOT_SECONDS)
      break
    default:
      return {
        opened: true,
        message: '',
      }
  }

  if (action.createdAt < timelimit) {
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
  return {
    opened: false,
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

    userActions: userActions,
    currentAction: action.type,
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
    const action = await prisma.action.create({
      data: {
        id: undefined,
        gameId: gameObj.game.id,
        type: 'INPUT',
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
    console.log(gameObj.user.id)
    console.log(gameObj.action.userActions)
    if (ualist.length === 0) {
      res.status(500)
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

    prisma.userAction
      .count({
        where: {
          actionId: gameObj.action.id,
          completed: true,
        },
      })
      .then((cnt) => {
        if (gameObj.game.users.length === cnt) {
          prisma.action.create({
            data: {
              type: 'DISCUSSION',
              gameId: gameObj.game.id,
            },
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

export default app
