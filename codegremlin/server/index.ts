import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import 'dotenv/config'

const app = express()
const PORT = process.env.PORT || 8080

// Security
app.use(helmet())
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }))
app.use(express.json({ limit: '10kb' }))
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }))

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

// Roast endpoint - H0
// npm i ollama
import { Ollama } from 'ollama'
const ollama = new Ollama({ host: 'http://localhost:11434' })


app.post('/api/roast', async (req, res) => {
  const { code } = req.body
  if (!code || typeof code !== 'string') return res.status(400).json({ error: 'Bad code' })
  if (code.length > 5000) return res.status(413).json({ error: 'Too large' })

  try {
    // 1. Get roast from Ollama
    const ollamaRes = await ollama.chat({
      model: 'llama3.1:8b',
      messages: [
        { role: 'system', content: 'You are CodeGremlin, a brutal code roaster. 1 sentence only. Be funny. Be mean. And also help them fix their code.' },
        { role: 'user', content: `Roast this: ${code}` }
      ],
      options: { num_predict: 60, temperature: 0.9 }
    })
    const roast = ollamaRes.message.content // FIX 1: Extract string
    
    // 2. Get voice from ElevenLabs
    const voiceRes = await fetch('https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL', {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_KEY!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: roast, // FIX 1: Use string
        model_id: 'eleven_turbo_v2',
        voice_settings: { stability: 0.4, similarity_boost: 0.8 }
      })
    })

    if (!voiceRes.ok) {
      console.error('ElevenLabs error:', voiceRes.status)
      return res.json({ roast, audio: null }) // Fallback: still send text
    }
    
    // 3. Send JSON with text + base64 audio
    const audioBuffer = await voiceRes.arrayBuffer()
    const audioBase64 = Buffer.from(audioBuffer).toString('base64')
    
    res.json({ // FIX 2: JSON not raw MP3
      roast,
      audio: `data:audio/mpeg;base64,${audioBase64}`
    })

  } catch (err: any) {
    console.error('Roast error:', err.message)
    res.status(500).json({ error: 'Failed to roast' })
  }
})

app.listen(PORT, () => {
  console.log(`Server H0: http://localhost:${PORT}`)
})