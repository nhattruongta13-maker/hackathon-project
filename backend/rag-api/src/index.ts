import express, {Request, Response} from 'express'
import cors from 'cors'
import {create} from './database/SQL.ts'

const app = express()
app.use(cors())
app.use(express.json())
const PORT = process.env.PORT
create()
app.post('/health', (req: Request, res: Response) => {res.send('ok')})

app.listen(PORT, () => console.log(`The server is living on port ${PORT}`))
