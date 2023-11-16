import app from '../app'

app.get('/others/health', async (_req, res) => {
  res.status(204)
  res.json()
})
