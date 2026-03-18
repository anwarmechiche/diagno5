'use client'

import { useState, useEffect } from 'react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Mail, RefreshCw, Send, Inbox, Archive, Trash2, Search } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Email {
  id: string
  from: string
  subject: string
  date: string
  text: string
  html: string
  seen: boolean
}

export default function EmailsTab({ merchantId }: { merchantId: string }) {
  const [emails, setEmails] = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const fetchEmails = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/mail/fetch?merchantId=${merchantId}&limit=50`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erreur lors de la récupération des emails')
      setEmails(json.emails)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmails()
  }, [merchantId])

  const filteredEmails = emails.filter(e => 
    e.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.from.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="flex flex-col h-[calc(100vh-250px)] bg-white rounded-xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-[#FAFAFA] border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold text-[#714B67] flex items-center gap-2">
            <Inbox className="w-5 h-5" /> Boîte de réception
          </h2>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text"
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 bg-white border border-[#D9D9D9] rounded-lg text-sm focus:outline-none focus:border-[#714B67] w-64"
            />
          </div>
        </div>
        <Button onClick={fetchEmails} disabled={loading} variant="outline" size="sm" icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}>
          Actualiser
        </Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Mini */}
        <div className="w-16 bg-[#FAFAFA] border-r flex flex-col items-center py-4 gap-4">
          <button className="p-2 bg-[#714B67] text-white rounded-lg shadow-md" title="Inbox">
            <Inbox className="w-6 h-6" />
          </button>
          <button className="p-2 text-gray-400 hover:text-[#714B67]" title="Sent">
            <Send className="w-6 h-6" />
          </button>
          <button className="p-2 text-gray-400 hover:text-[#714B67]" title="Archive">
            <Archive className="w-6 h-6" />
          </button>
          <button className="p-2 text-gray-400 hover:text-[#714B67]" title="Trash">
            <Trash2 className="w-6 h-6" />
          </button>
        </div>

        {/* Email List */}
        <div className="w-1/3 border-r overflow-y-auto bg-white">
          {loading && emails.length === 0 ? (
            <div className="p-8 text-center animate-pulse text-gray-400">Synchronisation...</div>
          ) : filteredEmails.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Aucun message</div>
          ) : (
            filteredEmails.map(email => (
              <div 
                key={email.id}
                onClick={() => setSelectedEmail(email)}
                className={`p-4 border-b cursor-pointer transition-colors hover:bg-[#FBF9FA] ${selectedEmail?.id === email.id ? 'bg-[#F3EBF1] border-l-4 border-l-[#714B67]' : ''} ${!email.seen ? 'bg-[#FAFAFA]' : ''}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-sm font-bold truncate pr-2 ${!email.seen ? 'text-[#2C2C2C]' : 'text-gray-600'}`}>
                    {email.from}
                  </span>
                  <span className="text-[10px] text-gray-400 whitespace-nowrap">
                    {format(new Date(email.date), 'dd MMM HH:mm', { locale: fr })}
                  </span>
                </div>
                <div className={`text-xs truncate ${!email.seen ? 'font-black text-[#714B67]' : 'text-gray-700'}`}>
                  {email.subject}
                </div>
                <div className="text-[11px] text-gray-500 truncate mt-1">
                  {email.text.slice(0, 60)}...
                </div>
              </div>
            ))
          )}
        </div>

        {/* Selected Email View */}
        <div className="flex-1 bg-white overflow-y-auto">
          {selectedEmail ? (
            <div className="p-8">
              <div className="flex justify-between items-start border-b pb-6 mb-8">
                <div>
                  <h1 className="text-2xl font-black text-[#2C2C2C] mb-2">{selectedEmail.subject}</h1>
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-[#714B67] text-white flex items-center justify-center font-bold">
                      {selectedEmail.from.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#2C2C2C]">{selectedEmail.from}</div>
                      <div className="text-xs text-gray-500">De: {selectedEmail.from}</div>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">{format(new Date(selectedEmail.date), 'EEEE dd MMMM yyyy, HH:mm', { locale: fr })}</div>
                  <div className="mt-4 flex gap-2 justify-end">
                    <Button variant="outline" size="sm">Répondre</Button>
                    <Button variant="outline" size="sm">Transférer</Button>
                  </div>
                </div>
              </div>

              <div className="prose max-w-none text-[#2C2C2C]">
                {selectedEmail.html ? (
                  <div dangerouslySetInnerHTML={{ __html: selectedEmail.html }} />
                ) : (
                  <div className="whitespace-pre-wrap">{selectedEmail.text}</div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-4">
              <Mail className="w-20 h-20 opacity-20" />
              <p className="text-lg font-medium">Sélectionnez un email pour le lire</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
