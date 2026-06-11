import { useEffect } from 'react';
import { familySocket } from '../lib/socket';
export function useSocket(handler: (msg: any) => void) {
  useEffect(() => {
    const unsubscribe = familySocket.subscribe(handler);
    return () => { unsubscribe(); };
  }, []);
}