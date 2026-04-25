import React, { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { Send } from 'lucide-react';
import { motion } from 'motion/react';

interface ChatProps {
  orderId: string;
  currentUserId: string;
  otherPartyName: string;
}

export default function Chat({ orderId, currentUserId, otherPartyName }: ChatProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'orders', orderId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `orders/${orderId}/messages`));

    return unsubscribe;
  }, [orderId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await addDoc(collection(db, 'orders', orderId, 'messages'), {
        senderId: currentUserId,
        text: newMessage.trim(),
        createdAt: serverTimestamp()
      });
      setNewMessage('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `orders/${orderId}/messages`);
    }
  };

  return (
    <div className="flex flex-col h-[400px] bg-white rounded-2xl border border-brand-border overflow-hidden">
      <div className="bg-brand-surface p-4 border-b border-brand-border">
        <h3 className="font-bold text-sm">محادثة مع {otherPartyName}</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUserId;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${isMe ? 'bg-brand-primary text-white rounded-br-none' : 'bg-gray-100 text-gray-800 rounded-bl-none'}`}>
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendMessage} className="p-3 border-t border-brand-border bg-gray-50 flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="اكتب رسالة..."
          className="flex-1 bg-white border border-brand-border rounded-full px-4 py-2 text-sm focus:outline-none focus:border-brand-primary"
        />
        <button 
          type="submit"
          disabled={!newMessage.trim()}
          className="bg-brand-primary text-white w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-50 hover:bg-brand-primary/90 transition-colors"
        >
          <Send className="w-4 h-4 rtl:-scale-x-100" />
        </button>
      </form>
    </div>
  );
}
