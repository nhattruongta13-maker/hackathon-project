import express, {Request, Response} from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())
const PORT = process.env.PORT

app.post('/health', (req: Request, res: Response) => {res.send('ok')})

app.listen(PORT, () => console.log(`The server is living on port ${PORT}`))
