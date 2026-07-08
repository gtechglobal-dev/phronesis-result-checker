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

  useEffect(() => {
    if (!socket) return
    socket.on(event, handler)
    return () => socket.off(event, handler)
  }, [socket, event, handler])
}
