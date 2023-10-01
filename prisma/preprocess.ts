import dotenv from 'dotenv'
import { existsSync } from 'fs'
import { join } from 'path'

const lpath = join(process.cwd(), '.env.local')
const ppath = join(process.cwd(), '.env')
if (existsSync(lpath)) {
  dotenv.config({
    path: lpath,
  })
} else if (ppath) {
  dotenv.config({
    path: ppath,
  })
} else {
  throw '.envまたは.env.localファイルが存在しません'
}
