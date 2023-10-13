import app from '../app'
import {
  LIMIT_INPUT_SECONDS,
  ErrorResponse,
  PutInputRequest,
  PutVoteRequest,
  LIMIT_EXECUTION_SECONDS,
  LIMIT_JUDGEMENT_SECONDS,
} from '../apimodel'
import { baseRule, requiredRule, valid } from '../../shared/rules'
import prisma from '../prisma'
import { doTurnEnd, getGameInfo } from './helper'
import crypto from 'crypto'

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
        title: 'ワードの入力',
        message: 'ゲームが開始されました\nワードを入力してください',
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
        message: `ゲームの状態が${gameObj.action.type}なため入力できません`,
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

    try {
      const cnt = await prisma.userAction.count({
        where: {
          actionId: gameObj.action.id,
          completed: true,
        },
      })
      if (gameObj.game.users.length === cnt) {
        // 全員入力完了

        const turn = await prisma.action.count({
          where: { gameId: gameObj.game.id },
        })
        if (turn < 4) {
          // 4アクション以下の初期状態なら、人狼決定を行う
          const wolfIndex = crypto.randomInt(0, gameObj.game.users.length)
          await prisma.gameOnUser.update({
            data: {
              isWolf: true,
            },
            where: {
              userId_gameId: {
                gameId: gameObj.game.id,
                userId: gameObj.game.users[wolfIndex].userId,
              },
            },
          })
        }

        const timeLimit = new Date()
        timeLimit.setSeconds(
          timeLimit.getSeconds() + gameObj.game.discussionSeconds
        )

        await prisma.action.create({
          data: {
            type: 'DISCUSSION',
            gameId: gameObj.game.id,
            timeLimit: timeLimit,
            title: '議論タイム',
            message: '全員がワードを入力しました！\n議論を開始して下さい',
          },
        })
      }
    } catch (err) {
      // ignore
      console.log(err)
    } finally {
      res.status(200)
      res.json()
    }
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
      message: '投票したユーザーは存在しません',
    } as ErrorResponse)
    return
  }

  const userAction = ualist[0]

  if (userAction.completed) {
    res.status(400)
    res.json({
      code: 'judge-004',
      message: 'すでに投票が終了しています',
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

  // 決選投票の場合は、対象者をチェック
  const actionDecisiveUsers = await prisma.actionDecisiveUser.findMany({
    select: {
      userId: true,
    },
    where: {
      actionId: gameObj.action.id,
    },
  })
  if (
    actionDecisiveUsers.length > 0 &&
    !actionDecisiveUsers.map((d) => d.userId).includes(votedGameOnUser.userId)
  ) {
    // 決選投票＆投票対象じゃないと判断された場合

    res.status(400)
    res.json({
      code: 'judge-006',
      message: '投票したユーザーは決選投票対象ではありません',
    } as ErrorResponse)
    return
  }

  try {
    await prisma.$transaction(async (prisma) => {
      // 投票
      const v = await prisma.vote.create({
        data: {
          actionId: gameObj.action.id,
          votedUserId: votedGameOnUser.userId,
        },
      })

      await prisma.userAction.update({
        data: {
          completed: true,
          voteId: v.id,
        },
        where: {
          id: userAction.id,
        },
      })
    })
  } catch {
    res.status(400)
    res.json({
      code: 'judge-007',
      message: '投票に失敗しました',
    } as ErrorResponse)
  }

  try {
    await prisma.$transaction(async (prisma) => {
      const cnt = await prisma.userAction.count({
        where: {
          actionId: gameObj.action.id,
          completed: true,
        },
      })

      if (gameObj.game.users.length === cnt) {
        // 投票完了

        const action = await prisma.action.findFirst({
          select: {
            votes: true,
          },
          where: {
            id: gameObj.action.id,
          },
        })

        if (!action) {
          res.status(400)
          res.json({
            code: 'judge-008',
            message: '投票に失敗しました',
          } as ErrorResponse)
          return
        }

        // 集計
        const list: { id: number; cnt: number; name: string }[] = []
        gameObj.game.users.forEach((u) => {
          list.push({ id: u.userId, cnt: 0, name: u.user.name })
        })
        action.votes.forEach((vote) => {
          const hit = list.filter((i) => i.id === vote.votedUserId)
          if (hit.length > 0) {
            hit[0].cnt++
          }
        })

        const sorted = list.sort((b, a) => a.cnt - b.cnt)

        let max = 0
        if (sorted.length > 0) {
          max = sorted[0].cnt
        }
        const topRankers = sorted.filter((i) => i.cnt === max)
        if (topRankers.length === 0) {
          res.status(400)
          res.json({
            code: 'judge-009',
            message: '投票に失敗しました',
          } as ErrorResponse)
          return
        } else if (topRankers.length === 1) {
          // 殺害対象決定

          // 殺害
          await prisma.gameOnUser.update({
            data: {
              isDied: true,
            },
            where: {
              userId_gameId: {
                gameId: gameObj.game.id,
                userId: topRankers[0].id,
              },
            },
          })

          // 処刑アクションへ移行
          const timeLimit = new Date()
          timeLimit.setSeconds(timeLimit.getSeconds() + LIMIT_EXECUTION_SECONDS)
          const newAction = await prisma.action.create({
            data: {
              type: 'EXECUTION',
              gameId: gameObj.game.id,
              timeLimit: timeLimit,
              killedUserId: topRankers[0].id,
              title: '処刑執行',
              message: `${topRankers[0].name}さんが処刑されました`,
            },
          })
          // 投票者追加
          for (let u of gameObj.game.users) {
            // 対象者以外が投票できる
            await prisma.userAction.create({
              data: {
                id: undefined,
                gameId: gameObj.game.id,
                userId: u.userId,
                actionId: newAction.id,
                // 生きていなければfalse
                completed: u.isDied,
              },
            })
          }
        } else {
          // 決選投票が必要

          if (
            gameObj.game.users.filter((u) => !u.isDied).length ===
            topRankers.length
          ) {
            // 決選投票ができない場合、ランダム殺害

            const rndIndex = Math.floor(
              crypto.randomInt(topRankers.length * 1000) / 1000
            )

            // 殺害
            await prisma.gameOnUser.update({
              data: {
                isDied: true,
              },
              where: {
                userId_gameId: {
                  gameId: gameObj.game.id,
                  userId: topRankers[rndIndex].id,
                },
              },
            })

            // 処刑アクションへ移行
            const timeLimit = new Date()
            timeLimit.setSeconds(
              timeLimit.getSeconds() + LIMIT_EXECUTION_SECONDS
            )
            const newAction = await prisma.action.create({
              data: {
                type: 'EXECUTION',
                gameId: gameObj.game.id,
                timeLimit: timeLimit,
                killedUserId: topRankers[rndIndex].id,
                title: '処刑執行',
                message: `投票が完全に拮抗したので、ランダムで処刑が実行されました`,
              },
            })
            // 投票者追加
            for (let u of gameObj.game.users) {
              // 対象者以外が投票できる
              await prisma.userAction.create({
                data: {
                  id: undefined,
                  gameId: gameObj.game.id,
                  userId: u.userId,
                  actionId: newAction.id,
                  // 生きていなければfalse
                  completed: u.isDied,
                },
              })
            }
          } else {
            // 決選投票アクションへ移行
            const timeLimit = new Date()
            timeLimit.setSeconds(
              timeLimit.getSeconds() + LIMIT_JUDGEMENT_SECONDS
            )
            const newAction = await prisma.action.create({
              data: {
                type: 'JUDGEMENT',
                gameId: gameObj.game.id,
                timeLimit: timeLimit,
                killedUserId: topRankers[0].id,
                title: '決選投票',
                message: `投票が完全に拮抗したので、決選投票を実施します`,
              },
            })

            // 決選投票対象追加
            for (let u of topRankers) {
              await prisma.actionDecisiveUser.create({
                data: {
                  userId: u.id,
                  actionId: newAction.id,
                },
              })
            }

            // 投票者追加
            for (let u of gameObj.game.users) {
              if (
                topRankers.filter((ranker) => ranker.id === u.userId).length ===
                0
              ) {
                // 対象者以外が投票できる
                await prisma.userAction.create({
                  data: {
                    id: undefined,
                    gameId: gameObj.game.id,
                    userId: u.userId,
                    actionId: newAction.id,
                    // 生きていなければfalse
                    completed: u.isDied,
                  },
                })
              }
            }
          }
        }
      }
    })
    res.status(200)
    res.json()
  } catch {
    res.status(400)
    res.json({
      code: 'judge-010',
      message: '投票に失敗しました',
    } as ErrorResponse)
  }
})

app.put<any, any, any, any>('/game/:name/next', async (req, res) => {
  const gameObj = await getGameInfo(req, res)
  if (gameObj === null) {
    return
  }

  if (gameObj.action.type !== 'EXECUTION') {
    res.status(400)
    res.json({
      code: 'exe-001',
      message: `ゲームの状態が${gameObj.action.type}なため死者の確認できません`,
    } as ErrorResponse)
    return
  }

  const ualist = gameObj.action.userActions.filter((ua) => {
    return ua.userId === gameObj.user.id
  })
  const userAction = ualist[0]

  if (userAction?.completed) {
    res.status(400)
    res.json({
      code: 'exe-002',
      message: 'すでに死者の確認は完了しています',
    } as ErrorResponse)
    return
  }

  await prisma.userAction.updateMany({
    data: {
      completed: true,
    },
    where: {
      gameId: gameObj.game.id,
      actionId: gameObj.action.id,
      userId: gameObj.user.id,
    },
  })

  const cnt = await prisma.userAction.count({
    where: {
      gameId: gameObj.game.id,
      actionId: gameObj.action.id,
      completed: true,
    },
  })

  if (cnt === gameObj.game.users.length) {
    // ユーザーが全員確認を完了した場合
    await doTurnEnd(gameObj.game)
  }
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

    if (!gameObj.data.opened) {
      res.status(401)
      res.json({
        code: 'cancel-002',
        message: '既に終了しています',
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
