import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())
const PORT = process.env.PORT



app.listen(PORT, () => console.log(`The server is living on port ${PORT}`))
