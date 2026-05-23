import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'

function App() {
 const [code, setCode] = useState('')
const [roast, setRoast] = useState('')
const [loading, setLoading] = useState(false) // New

const getRoast = async () => {
  if (!code.trim()) return setRoast('Paste some code first')
  if (code.length > 5000) return setRoast('Too long. 5k chars max')
  
  setLoading(true)
  setRoast('')
  
  try {
    const res = await fetch('http://localhost:8080/api/roast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }) // Send the code from textarea
    })
    
    const data = await res.json() // Expect { roast: "...", audio: "data:audio..." }
    
    if (!res.ok) throw new Error(data.error || 'Server error')
    
    setRoast(data.roast)
    
    // Play ElevenLabs audio if we got it
    if (data.audio) {
      const audio = new Audio(data.audio)
      audio.play()
    } else {
      // Fallback: browser voice if ElevenLabs failed
      const utterance = new SpeechSynthesisUtterance(data.roast)
      utterance.rate = 1.2
      utterance.pitch = 0.8
      speechSynthesis.speak(utterance)
    }
    
  } catch (err: any) {
    setRoast(`Error: ${err.message}`)
  } finally {
    setLoading(false)
  }
}

return (
  <div style={{padding: 20, maxWidth: 600}}>
    <textarea 
      value={code} 
      onChange={e => setCode(e.target.value)}
      placeholder="Paste your ugly code here..."
      rows={10}
      style={{width: '100%', fontFamily: 'monospace'}}
      onKeyDown={e => e.ctrlKey && e.key === 'Enter' && getRoast()}
    />
    <p style={{color: code.length > 5000 ? 'red' : 'gray'}}>
    {code.length}/5000
    </p>
    <button onClick={getRoast} disabled={loading}>
      {loading ? 'Roasting...' : 'Roast Me'}
    </button>
    <p style={{whiteSpace: 'pre-wrap'}}>{roast}</p>
    {roast && <button onClick={() => navigator.clipboard.writeText(roast)}>Copy Roast</button>}
  </div>
)
}

export default App
