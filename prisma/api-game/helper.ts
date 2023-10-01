import express, { Response, Request } from 'express'
import { verifyToken } from '../api/helper'
import { baseRule, requiredRule, valid } from '../../shared/rules'
import {
  CheckedResponse,
  ErrorResponse,
  GameUserData,
  GetGameResponse,
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

export async function checkGame(
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
