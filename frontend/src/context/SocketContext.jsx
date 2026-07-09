import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'

const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const { user } = useAuth()
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    const API_URL = import.meta.env.VITE_API_URL || ''
    const socket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    })

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('connect_error', (err) => console.error('Socket connect error:', err.message))

    socketRef.current = socket

    return () => { socket.close(); socketRef.current = null }
  }, [user])

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => useContext(SocketContext)

export function useSocketListener(event, handler) {
  const { socket } = useSocket()
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!socket) return
    const listener = (...args) => handlerRef.current(...args)
    socket.on(event, listener)
    return () => socket.off(event, listener)
  }, [socket, event])
}
