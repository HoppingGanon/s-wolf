import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

prisma.$transaction(async (prisma) => {
  await prisma.altUser.deleteMany()
  await prisma.userAction.deleteMany()
  await prisma.action.deleteMany()
  await prisma.gameOnUser.deleteMany()
  await prisma.game.deleteMany()
  await prisma.user.deleteMany()
})
