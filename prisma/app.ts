import express, { Response, Request } from 'express'

const app = express()

// デフォルトエラー処理 エラー処理されていないエラーが発生した場合に実行する処理
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error(err.stack)
  res.status(500).send("I'll be Internal Server Error!!!(Don!)")
})

// デフォルトヘッダ
app.use((req, res, next) => {
  res.setHeader(
    'Access-Control-Allow-Origin',
    process.env.ACCESS_CONTROL_ALLOW_ORIGIN || '*'
  )
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
  res.setHeader(
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

export default app
