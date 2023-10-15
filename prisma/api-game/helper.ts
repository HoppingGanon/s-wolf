import { Response, Request } from 'express'
import { verifyToken } from '../api/helper'
import { baseRule, requiredRule, valid } from '../../shared/rules'
import {
  CheckedResponse,
  ErrorResponse,
  GameUserData,
  GetGameResponse,
  LIMIT_COMPLETED_SECONDS,
  LIMIT_JUDGEMENT_SECONDS,
  UserActionData,
} from '../apimodel'
import prisma from '../prisma'
import { ActionType, GameStatusTytpe } from '@prisma/client'

export const getGameInfo = async (req: Request, res: Response) => {
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

  let fetishism = ''
  game.users.forEach((u) => {
    if (u.isWolf) {
      fetishism = u.fetishism
    }
    u.isWolf = false
  })

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
      killedUser: true,
      actionDecisiveUser: {
        include: {
          user: {
            select: {
              code: true,
              name: true,
            },
          },
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

  const checked = await checkGame(game, action, user)

  if (!checked.opened && action.type !== 'RESULT') {
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

  let killedUsers: {
    code: string
    fetishism: string
    isWolf: boolean
    name: string
    isDied: boolean
  }[] = []

  let winner: 'wolf' | 'human' | undefined = undefined
  if (action.type === 'RESULT') {
    // 最後なら特殊処理でユーザーを返す
    const resultUsers = await prisma.gameOnUser.findMany({
      include: {
        user: true,
      },
      where: {
        gameId: game.id,
      },
    })

    killedUsers = resultUsers
      .filter((u) => u.isDied || game.finnalyReleasing)
      .map((u) => {
        return {
          code: u.user.code,
          fetishism: u.fetishism,
          isWolf: u.isWolf,
          name: u.user.name,
          isDied: u.isDied,
        }
      })

    winner =
      resultUsers.filter((u) => u.isDied).filter((u) => u.isWolf).length === 0
        ? 'wolf'
        : 'human'
  } else {
    killedUsers = game.users
      .filter((u) => u.isDied)
      .map((u) => {
        return {
          code: u.user.code,
          fetishism: u.fetishism,
          isWolf: u.isWolf,
          name: u.user.name,
          isDied: u.isDied,
        }
      })
  }

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

    wolfFetishism: fetishism,

    maxMembers: game.maxMembers,
    discussionSeconds: game.discussionSeconds,

    userActions: userActions,
    currentAction: action.type,
    actionTimeLimit: Math.floor(
      (action.timeLimit.valueOf() - new Date().valueOf()) / 1000
    ),

    decisiveUsers: action.actionDecisiveUser.map((a) => {
      return a.user
    }),

    actionTitle: action.title,
    actionMessage: action.message,

    result: {
      users: killedUsers,
      winner,
    },

    encrypted: game.password === '',
  }

  if (action.killedUser) {
    // 殺害があったアクションにはユーザー情報を含める

    const hits = game.users.filter((u) => u.user.id === action.killedUser?.id)
    data.killedUser = {
      code: action.killedUser.code,
      name: action.killedUser.name,
      fetishism: hits.length === 0 ? '' : hits[0].fetishism,
      isDied: true,
    }
  }

  return {
    user,
    game,
    data,
    action,
  }
}

export async function checkGame(
  game: {
    id: number
    status: GameStatusTytpe
    createdAt: Date
    timeLimit: Date
    discussionSeconds: number
    hostUserId: number
    maxTurns: number
  },
  action: { id: number; type: ActionType; createdAt: Date; timeLimit: Date },
  requestUser: {
    id: number
  }
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
    // ゲームそのもののタイムリミット
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
      if (game.hostUserId !== requestUser.id) {
        // ホスト以外なら何もしない
        return {
          opened: true,
          message: '',
        }
      } else {
        // ホストの場合
        // 議論タイムのタイムアップはアクションの遷移
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
          const newAction = await prisma.action.create({
            data: {
              id: undefined,
              gameId: game.id,
              type: 'JUDGEMENT',
              timeLimit: timeLimit,
              title: '投票',
              message: '狼ワードを指定したと思われる人狼を投票で決定します',
            },
          })

          for (let u of foundGame.users) {
            await prisma.userAction.create({
              data: {
                id: undefined,
                gameId: game.id,
                userId: u.userId,
                actionId: newAction.id,
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
      }
    } else if (action.type === 'EXECUTION') {
      await doTurnEnd(game)
    } else if (action.type === 'RESULT') {
      return {
        opened: false,
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

export async function doTurnEnd(game: {
  id: number
  status: GameStatusTytpe
  createdAt: Date
  timeLimit: Date
  hostUserId: number
  maxTurns: number
  discussionSeconds: number
}) {
  const users = await prisma.gameOnUser.findMany({
    where: {
      gameId: game.id,
      isDied: false,
    },
  })

  const wolfs = users.filter((u) => u.isWolf)
  if (wolfs.length > 0) {
    if (users.filter((u) => !u.isWolf).length === wolfs.length) {
      // 人狼勝利
      await prisma.$transaction(async (prisma) => {
        const timeLimit = new Date()
        timeLimit.setSeconds(timeLimit.getSeconds() + LIMIT_COMPLETED_SECONDS)
        await prisma.action.create({
          data: {
            gameId: game.id,
            type: 'RESULT',
            title: 'ゲーム終了',
            message: '人狼の勝利です',
            timeLimit,
          },
        })

        await prisma.game.update({
          data: {
            status: 'COMPLETED',
          },
          where: {
            id: game.id,
          },
        })
      })
    } else {
      const turnCnt = await prisma.action.count({
        where: {
          type: 'EXECUTION',
          gameId: game.id,
        },
      })

      if (turnCnt >= game.maxTurns) {
        // 逃げ切り

        await prisma.$transaction(async (prisma) => {
          const timeLimit = new Date()
          timeLimit.setSeconds(timeLimit.getSeconds() + LIMIT_COMPLETED_SECONDS)
          await prisma.action.create({
            data: {
              gameId: game.id,
              type: 'RESULT',
              title: 'ゲーム終了',
              message: '人狼の逃げ切り勝利です',
              timeLimit,
            },
          })

          await prisma.game.update({
            data: {
              status: 'COMPLETED',
            },
            where: {
              id: game.id,
            },
          })
        })
      } else {
        // 継続
        const timeLimit = new Date()
        timeLimit.setSeconds(timeLimit.getSeconds() + game.discussionSeconds)
        await prisma.action.create({
          data: {
            gameId: game.id,
            type: 'DISCUSSION',
            title: '再議論タイム',
            message: '人狼はまだ生きています\n議論を再開してください',
            timeLimit: timeLimit,
          },
        })
      }
    }
  } else {
    // 市民勝利
    await prisma.$transaction(async (prisma) => {
      const timeLimit = new Date()
      timeLimit.setSeconds(timeLimit.getSeconds() + LIMIT_COMPLETED_SECONDS)
      await prisma.action.create({
        data: {
          gameId: game.id,
          type: 'RESULT',
          title: 'ゲーム終了',
          message: '人狼は死亡しました',
          timeLimit,
        },
      })

      await prisma.game.update({
        data: {
          status: 'COMPLETED',
        },
        where: {
          id: game.id,
        },
      })
    })
  }
}
