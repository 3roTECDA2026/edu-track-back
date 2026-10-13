
import 'dotenv/config'

import app from '@/app'

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`)
  console.log(`🔐 Login: http://localhost:${PORT}/api/auth/login`)
  console.log(`❤️ Health: http://localhost:${PORT}/health`)
})
