import './preprocess'
import app from './app'
import './api/auth'
import './api/user'
import './api-game/common'
import './api-game/actions'

const PORT = process.env.PORT || 8000

app.listen(PORT, () => {
  console.log(`REST API server ready at: http://localhost:${PORT}`)
})
