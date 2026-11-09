'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Eraser, Pencil, Trash2 } from 'lucide-react'
import { playSound } from './audio'
import type { ScratchpadCanvasProps } from './types'

const PEN_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b'] as const

interface Point {
  x: number
  y: number
}

/**
 * The transparent scratchpad overlay (กระดานทดเลขบนจอ).
 *
 * A full screen HTML5 canvas the learner can draw on with a mouse or a
 * finger. The pen colour and the eraser state are owned by the shell (they are
 * part of ScratchpadCanvasProps), everything else - the bitmap, the drawing
 * state and the resize handling - lives inside this component.
 */
export function ScratchpadCanvas(props: ScratchpadCanvasProps) {
  // The scratchpad chrome (dark toolbar + neutral canvas) is tier independent
  // in the prototype, so props.theme is intentionally not used for colours.
  const { open, onClose, penColor, onPenColorChange, isEraser, onEraserChange } = props

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const isDrawingRef = useRef(false)
  const lastPointRef = useRef<Point | null>(null)
  const appliedDprRef = useRef(0)
  const resizeFrameRef = useRef<number | null>(null)

  /**
   * Match the backing store to the size of the parent element.
   *
   * The canvas is sized in device pixels (so the drawing stays crisp on a
   * retina screen) while the context is scaled by the device pixel ratio so
   * all drawing code can keep working in plain CSS pixels. Whatever was drawn
   * before the resize is copied over, so a window resize never wipes the
   * learner's work.
   */
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const surface = surfaceRef.current
    if (!canvas || !surface) return

    const rect = surface.getBoundingClientRect()
    const width = Math.max(1, Math.floor(rect.width))
    const height = Math.max(1, Math.floor(rect.height))
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

    const targetWidth = Math.floor(width * dpr)
    const targetHeight = Math.floor(height * dpr)
    if (canvas.width === targetWidth && canvas.height === targetHeight && appliedDprRef.current === dpr) {
      return
    }

    // Keep a copy of the current drawing before the bitmap is reallocated.
    let snapshot: HTMLCanvasElement | null = null
    if (canvas.width > 0 && canvas.height > 0) {
      snapshot = document.createElement('canvas')
      snapshot.width = canvas.width
      snapshot.height = canvas.height
      snapshot.getContext('2d')?.drawImage(canvas, 0, 0)
    }

    canvas.width = targetWidth
    canvas.height = targetHeight
    appliedDprRef.current = dpr

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (snapshot) {
      ctx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, width, height)
    }
  }, [])

  /**
   * Resize on the next animation frame.
   *
   * The measurement is deferred by one frame so the browser has already
   * applied the new layout *and* the new device pixel ratio - a window that
   * moves to a different-DPI screen fires its resize event before the ratio
   * has settled.
   */
  const scheduleResize = useCallback(() => {
    if (typeof window === 'undefined') return
    if (resizeFrameRef.current !== null) window.cancelAnimationFrame(resizeFrameRef.current)
    resizeFrameRef.current = window.requestAnimationFrame(() => {
      resizeFrameRef.current = null
      resizeCanvas()
    })
  }, [resizeCanvas])

  // Size the canvas as soon as the overlay opens and on every window resize.
  useEffect(() => {
    if (!open) return

    const handleResize = () => scheduleResize()
    resizeCanvas()
    scheduleResize()

    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)

    return () => {
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current)
        resizeFrameRef.current = null
      }
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [open, resizeCanvas, scheduleResize])

  /** Pointer position relative to the canvas, in CSS pixels. */
  const getCoordinates = useCallback((event: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }, [])

  const startDrawing = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return
      event.preventDefault()

      try {
        canvas.setPointerCapture(event.pointerId)
      } catch {
        // Pointer capture is a nicety, the drawing still works without it.
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      isDrawingRef.current = true
      const { x, y } = getCoordinates(event)

      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = penColor
      ctx.lineWidth = 4
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(x, y)
      // A tap (no movement) still leaves a visible dot.
      ctx.lineTo(x + 0.01, y)
      ctx.stroke()

      lastPointRef.current = { x, y }
    },
    [getCoordinates, penColor],
  )

  const draw = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return
      const canvas = canvasRef.current
      if (!canvas) return
      event.preventDefault()

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const { x, y } = getCoordinates(event)
      const last = lastPointRef.current ?? { x, y }

      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      if (isEraser) {
        ctx.globalCompositeOperation = 'destination-out'
        ctx.lineWidth = 26
      } else {
        ctx.globalCompositeOperation = 'source-over'
        ctx.strokeStyle = penColor
        ctx.lineWidth = 4
      }

      // Smooth quadratic curve: the stroke bends towards the midpoint of the
      // last two pointer positions instead of drawing hard straight segments.
      const midX = (last.x + x) / 2
      const midY = (last.y + y) / 2
      ctx.beginPath()
      ctx.moveTo(last.x, last.y)
      ctx.quadraticCurveTo(last.x, last.y, midX, midY)
      ctx.stroke()

      lastPointRef.current = { x, y }
    },
    [getCoordinates, isEraser, penColor],
  )

  const stopDrawing = useCallback(() => {
    isDrawingRef.current = false
    lastPointRef.current = null
  }, [])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
    playSound('pop')
  }, [])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-900/10 backdrop-blur-[1px] pointer-events-auto select-none">
      {/* Scratchpad Floating Toolbar */}
      <div className="m-2 p-2 rounded-2xl bg-slate-900/95 text-white border border-slate-700 shadow-xl flex items-center justify-between gap-3 self-center">
        <span className="text-xs font-extrabold px-2 text-amber-300 flex items-center gap-1">
          <Pencil className="w-3.5 h-3.5" /> กระดานทดเลข (Scratchpad)
        </span>
        <div className="flex items-center gap-1.5">
          {PEN_COLORS.map((col) => (
            <button
              key={col}
              onClick={() => {
                onEraserChange(false)
                onPenColorChange(col)
              }}
              aria-label={`เปลี่ยนสีปากกาเป็น ${col}`}
              title={`สีปากกา ${col}`}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${
                !isEraser && penColor === col ? 'scale-125 border-white' : 'border-transparent'
              }`}
              style={{ backgroundColor: col }}
            />
          ))}
          <button
            onClick={() => onEraserChange(!isEraser)}
            className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${
              isEraser ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
            }`}
            title="ยางลบ (Eraser)"
          >
            <Eraser className="w-3.5 h-3.5" /> ยางลบ
          </button>
          <button
            onClick={clearCanvas}
            className="p-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-1"
            title="ล้างกระดาน (Clear)"
          >
            <Trash2 className="w-3.5 h-3.5" /> ล้างกระดาน
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold"
            title="ปิดกระดานทดเลข (Close)"
          >
            ปิด
          </button>
        </div>
      </div>

      {/* Interactive HTML5 Drawing Canvas */}
      <div ref={surfaceRef} className="relative flex-1 min-h-0">
        <canvas
          ref={canvasRef}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          onPointerLeave={stopDrawing}
          className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
        />
      </div>
    </div>
  )
}

export default ScratchpadCanvas
