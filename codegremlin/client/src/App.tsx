import { useState, useRef, useEffect } from 'react'

function App() {
  const [code, setCode] = useState('')
  const [roast, setRoast] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [eyeScale, setEyeScale] = useState(1)
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 })
  const [isBlinking, setIsBlinking] = useState(false)
  const [laserActive, setLaserActive] = useState(false)
  const [tears, setTears] = useState<{id: number, x: number, delay: number}[]>([])

  // NEW: Voice controls
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoice, setSelectedVoice] = useState<string>('')
  const [pitch, setPitch] = useState(0.8)
  const [rate, setRate] = useState(1.2)
  const [useElevenLabs, setUseElevenLabs] = useState(true)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const animationRef = useRef<number | null>(null)
  const blinkTimeoutRef = useRef<number | undefined>(undefined)

  // Load available browser voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = speechSynthesis.getVoices()
      setVoices(availableVoices)
      // Default to first English voice, or first voice
      const defaultVoice = availableVoices.find(v => v.lang.startsWith('en')) || availableVoices[0]
      if (defaultVoice) setSelectedVoice(defaultVoice.name)
    }

    loadVoices()
    speechSynthesis.onvoiceschanged = loadVoices // Chrome loads async
  }, [])

  useEffect(() => {
    if (!isSpeaking &&!loading) {
      const blinkLoop = () => {
        const nextBlink = 2000 + Math.random() * 4000
        blinkTimeoutRef.current = window.setTimeout(() => {
          setIsBlinking(true)
          setTimeout(() => setIsBlinking(false), 150)
          blinkLoop()
        }, nextBlink)
      }
      blinkLoop()
    }
    return () => {
      if (blinkTimeoutRef.current) clearTimeout(blinkTimeoutRef.current)
    }
  }, [isSpeaking, loading])

  useEffect(() => {
    return () => {
      if (audioCtxRef.current) audioCtxRef.current.close()
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [])

  const triggerBloodTears = () => {
    const newTears = Array.from({ length: 5 }, (_, i) => ({
      id: Date.now() + i,
      x: 40 + Math.random() * 40,
      delay: i * 0.15
    }))
    setTears(prev => [...prev,...newTears])
    setTimeout(() => {
      setTears(prev => prev.filter(t =>!newTears.find(nt => nt.id === t.id)))
    }, 2000)
  }

  const animateEyeFromAudio = () => {
    if (!analyserRef.current) return
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)

    const update = () => {
      analyserRef.current!.getByteFrequencyData(dataArray)
      const volume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length

      const scale = 1 - (volume / 255) * 0.7
      setEyeScale(Math.max(0.3, scale))
      setLaserActive(volume > 180)

      if (volume > 50) {
        setPupilOffset({
          x: (Math.random() - 0.5) * (volume / 25),
          y: (Math.random() - 0.5) * (volume / 25)
        })
      }

      animationRef.current = requestAnimationFrame(update)
    }
    update()
  }

  const stopEyeAnimation = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
    setEyeScale(1)
    setPupilOffset({ x: 0, y: 0 })
    setIsSpeaking(false)
    setLaserActive(false)
  }

  const playWithLipSync = async (audioData: string) => {
    setIsSpeaking(true)
    const audio = new Audio(audioData)
    audioRef.current = audio

    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
    const source = audioCtxRef.current.createMediaElementSource(audio)
    const analyser = audioCtxRef.current.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    analyser.connect(audioCtxRef.current.destination)
    analyserRef.current = analyser

    audio.onplay = () => animateEyeFromAudio()
    audio.onended = () => stopEyeAnimation()
    audio.onerror = () => stopEyeAnimation()

    await audio.play()
  }

  const speakWithFallback = (text: string) => {
    setIsSpeaking(true)
    const utterance = new SpeechSynthesisUtterance(text)

    // Apply selected voice + settings
    const voice = voices.find(v => v.name === selectedVoice)
    if (voice) utterance.voice = voice
    utterance.rate = rate
    utterance.pitch = pitch

    utterance.onboundary = (e) => {
      if (e.name === 'word') {
        setEyeScale(0.4 + Math.random() * 0.3)
        setPupilOffset({
          x: (Math.random() - 0.5) * 8,
          y: (Math.random() - 0.5) * 4
        })
        setLaserActive(Math.random() > 0.7)
      }
    }
    utterance.onend = () => stopEyeAnimation()
    utterance.onerror = () => stopEyeAnimation()

    speechSynthesis.speak(utterance)
  }

  const getRoast = async () => {
    if (!code.trim()) return setRoast('Paste some code first, coward')
    if (code.length > 5000) return setRoast('Too long. 5k chars max. I’m not reading your entire node_modules')

    setLoading(true)
    setRoast('')
    stopEyeAnimation()

    try {
      const res = await fetch('http://localhost:8080/api/roast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          voice: useElevenLabs? 'elevenlabs' : selectedVoice, // Tell backend which voice
          pitch,
          rate
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Server exploded')

      setRoast(data.roast)

      if (data.roast.match(/garbage|trash|disgusting|horrible|dogshit|shit/gi)) {
        triggerBloodTears()
      }

      if (useElevenLabs && data.audio) {
        await playWithLipSync(data.audio)
      } else {
        speakWithFallback(data.roast)
      }
    } catch (err: any) {
      setRoast(`Error: ${err.message}. Even your errors are mid.`)
      triggerBloodTears()
      speakWithFallback(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const EvilEye = () => (
    <div style={{ position: 'relative', width: 180, height: 180 }}>
      <svg width="180" height="180" viewBox="0 0 180 180" style={{ filter: isSpeaking? 'drop-shadow(0 0 35px #ff0000)' : 'drop-shadow(0 0 15px #8b0000)', transition: 'filter 0.3s' }}>
        <ellipse cx="90" cy="90" rx="70" ry={70 * eyeScale} fill={isSpeaking? "#2a0000" : "#1a0000"} stroke="#ff0000" strokeWidth="4" style={{ transition: 'all 0.1s' }} />
        <circle cx={90 + pupilOffset.x} cy={90 + pupilOffset.y} r="32" fill="#8b0000" style={{ transition: 'all 0.05s' }} />
        <circle cx={90 + pupilOffset.x * 1.5} cy={90 + pupilOffset.y * 1.5} r="14" fill="#000" style={{ transition: 'all 0.05s' }} />
        <circle cx={78 + pupilOffset.x} cy={78 + pupilOffset.y} r="5" fill="#fff" opacity="0.9" />
        <path d={`M 20 90 Q 90 ${isBlinking || (!isSpeaking &&!loading)? 90 : 20} 160 90`} fill="#0a0a0a" stroke="#ff0000" strokeWidth="3" style={{ transition: 'all 0.15s', opacity: isBlinking? 1 : (!isSpeaking &&!loading? 0.7 : 0) }} />
        {laserActive && (
          <>
            <line x1={90 + pupilOffset.x * 1.5} y1={90 + pupilOffset.y * 1.5} x2={90 + pupilOffset.x * 1.5} y2={400} stroke="#ff0000" strokeWidth="4" opacity="0.9" style={{ filter: 'drop-shadow(0 0 8px #ff0000)' }} />
            <line x1={90 + pupilOffset.x * 1.5} y1={90 + pupilOffset.y * 1.5} x2={90 + pupilOffset.x * 1.5 - 10} y2={400} stroke="#ff3300" strokeWidth="2" opacity="0.6" />
            <line x1={90 + pupilOffset.x * 1.5} y1={90 + pupilOffset.y * 1.5} x2={90 + pupilOffset.x * 1.5 + 10} y2={400} stroke="#ff3300" strokeWidth="2" opacity="0.6" />
          </>
        )}
      </svg>
      {tears.map(tear => (
        <div key={tear.id} style={{ position: 'absolute', left: tear.x + '%', top: '60%', width: 8, height: 14, background: '#8b0000', borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%', animation: `fall 2s ease-in ${tear.delay}s forwards`, filter: 'drop-shadow(0 0 4px #ff0000)' }} />
      ))}
      <style>{`@keyframes fall { to { transform: translateY(100px); opacity: 0; } }`}</style>
    </div>
  )

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0a0a0a', color: '#e0e0e0', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ textAlign: 'center', padding: '15px', borderBottom: '2px solid #1a0000', background: 'linear-gradient(180deg, #1a0000 0%, #0a0a0a 100%)' }}>
        <p>Disclaimer: The eye may cause traume or psychological issue</p>
        <EvilEye />
        <h1 style={{ color: '#ff0000', margin: '8px 0', textShadow: '0 0 15px #ff0000', fontSize: 'clamp(24px, 4vw, 48px)' }}>
          {loading? 'SUMMONING JUDGMENT...' : isSpeaking? 'BEHOLD YOUR SHAME' : 'THE ALL-SEEING ROASTER'}
        </h1>

        {/* VOICE CONTROLS */}
        <div style={{ display: 'flex', gap: 15, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={useElevenLabs}
              onChange={e => setUseElevenLabs(e.target.checked)}
            />
            ElevenLabs
          </label>

          {!useElevenLabs && (
            <>
              <select
                value={selectedVoice}
                onChange={e => setSelectedVoice(e.target.value)}
                style={{ background: '#1a1a1a', color: '#e0e0e0', border: '1px solid #333', padding: '4px 8px', fontFamily: 'monospace', fontSize: 12 }}
              >
                {voices.map(v => (
                  <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                ))}
              </select>

              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                Pitch: {pitch.toFixed(1)}
                <input type="range" min="0" max="2" step="0.1" value={pitch} onChange={e => setPitch(Number(e.target.value))} style={{ width: 80 }} />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                Rate: {rate.toFixed(1)}
                <input type="range" min="0.5" max="2" step="0.1" value={rate} onChange={e => setRate(Number(e.target.value))} style={{ width: 80 }} />
              </label>
            </>
          )}
        </div>

        <p style={{ color: '#666', fontSize: 12, margin: '8px 0 0 0' }}>
          {laserActive && 'LASER ACTIVE. '} Voice: {useElevenLabs? 'ElevenLabs Premium' : selectedVoice || 'Browser Default'}
        </p>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 20, padding: 20, overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <textarea
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="Paste your ugly code here... the eye is watching and it has lasers"
            style={{ flex: 1, width: '100%', fontFamily: 'monospace', background: '#1a1a1a', color: '#00ff00', border: `2px solid ${code.length > 5000? '#ff0000' : laserActive? '#ff6600' : '#333'}`, padding: 15, borderRadius: 4, boxShadow: laserActive? '0 0 20px #ff6600' : 'none', transition: 'all 0.2s', fontSize: 14, resize: 'none' }}
            onKeyDown={e => e.ctrlKey && e.key === 'Enter' && getRoast()}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <p style={{ color: code.length > 5000? '#ff0000' : '#666', margin: 0 }}>
              {code.length}/5000 {code.length > 4000 && ' - The eye is getting irritated'}
              {laserActive && ' - TARGET ACQUIRED'}
            </p>
            <button
              onClick={getRoast}
              disabled={loading || isSpeaking}
              style={{ background: loading || isSpeaking? '#333' : '#8b0000', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: 4, cursor: loading || isSpeaking? 'not-allowed' : 'pointer', fontFamily: 'monospace', fontWeight: 'bold', fontSize: 16, boxShadow: loading? 'none' : '0 0 15px #8b0000', transform: isSpeaking? 'scale(0.95)' : 'scale(1)', transition: 'all 0.2s' }}
            >
              {loading? 'SUMMONING...' : isSpeaking? 'FIRING...' : 'ROAST ME'}
            </button>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {roast? (
            <div style={{ flex: 1, background: 'linear-gradient(135deg, #1a0000 0%, #0a0000 100%)', border: '2px solid #8b0000', padding: 20, borderRadius: 4, boxShadow: 'inset 0 0 30px rgba(139, 0, 0, 0.4)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              <p style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.8, fontSize: 15, flex: 1 }}>{roast}</p>
              <button
                onClick={() => navigator.clipboard.writeText(roast)}
                style={{ background: 'transparent', border: '2px solid #8b0000', color: '#ff6666', padding: '8px 16px', marginTop: 15, cursor: 'pointer', fontFamily: 'monospace', fontSize: 14, alignSelf: 'flex-start' }}
              >
                Copy Trauma
              </button>
            </div>
          ) : (
            <div style={{ flex: 1, border: '2px dashed #333', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: 18 }}>
              Awaiting your shameful code...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App