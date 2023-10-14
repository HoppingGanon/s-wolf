import { baseRule, valid } from '../../shared/rules'
import { verifyToken } from '../api/helper'
import { ErrorResponse, HistoryGameResponse } from '../apimodel'
import app from '../app'
import prisma from '../prisma'

app.get('/history', async (req, res) => {
  const pageStr = typeof req.query.page === 'string' ? req.query.page : '1'
  const perPageStr =
    typeof req.query.per_page === 'string' ? req.query.per_page : '30'
  const search = typeof req.query.search === 'string' ? req.query.search : ''

  let result = valid(search, [baseRule])
  if (result !== true) {
    res.status(400)
    res.json({
      code: 'hist-001',
      message: result,
    } as ErrorResponse)
    return
  }

  const page = Number.parseInt(pageStr)
  const perPage = Number.parseInt(perPageStr)

  if (
    Number.isNaN(page) ||
    Number.isNaN(perPage) ||
    page < 0 ||
    perPage < 0 ||
    perPage > 100
  ) {
    res.status(400)
    res.json({
      code: 'hist-002',
      message: 'ページ指定が異常です',
    } as ErrorResponse)
    return
  }

  const user = await verifyToken(req, res)
  if (user === false) {
    return
  }

  const data: HistoryGameResponse[] = []

  try {
    const gameOnUsers = await prisma.gameOnUser.findMany({
      include: {
        game: {
          select: {
            id: true,
            createdAt: true,
            status: true,
            gameName: true,
            gameTitle: true,
            users: {
              select: {
                user: {
                  select: {
                    name: true,
                    code: true,
                  },
                },
              },
            },
            hostUser: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
      where: {
        userId: user.id,
        game: {
          status: 'COMPLETED',
        },
      },
      orderBy: {
        game: {
          createdAt: 'desc',
        },
      },
      skip: (page - 1) * perPage,
      take: perPage,
    })

    for (let gameOnUser of gameOnUsers) {
      data.push({
        hostUser: {
          code: gameOnUser.game.hostUser.code,
          name: gameOnUser.game.hostUser.name,
        },
        name: gameOnUser.game.gameName,
        title: gameOnUser.game.gameTitle,
        users: gameOnUser.game.users.map((u) => {
          return { code: u.user.code, name: u.user.name }
        }),
      })
    }

    res.status(200)
    res.json(data)
    return
  } catch {
    res.status(400)
    res.json({
      code: 'hist-003',
      message: '履歴の確認に失敗しました',
    } as ErrorResponse)
    return
  }
})
