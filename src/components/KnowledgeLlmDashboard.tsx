import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { BookOpen, Cpu, Plus, Search, Loader2, Database, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { knowledgeService, llmService } from '../services/advisorService';

interface KnowledgeDoc {
  id: string;
  title: string;
  content: string;
  docType: string;
  symbol?: string;
  tags?: string[];
  updatedAt: string;
}

export function KnowledgeLlmDashboard() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [adapters, setAdapters] = useState<unknown[]>([]);
  const [llmStatus, setLlmStatus] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [queryResult, setQueryResult] = useState<{ hits: Array<{ text: string; score: number }>; mode?: string } | null>(null);
  const [newDoc, setNewDoc] = useState({ title: '', content: '', docType: 'note', symbol: '' });
  const [trainName, setTrainName] = useState('Portfolio Advisor LoRA');
  const [trainType, setTrainType] = useState<'lora' | 'qlora'>('qlora');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [d, s, a] = await Promise.all([
        knowledgeService.listDocuments(),
        llmService.getStatus().catch(() => null),
        llmService.listAdapters().catch(() => [])
      ]);
      setDocs(d);
      setLlmStatus(s);
      setAdapters(a);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreateDoc = async () => {
    if (!newDoc.title || !newDoc.content) return;
    setActionLoading('create-doc');
    try {
      await knowledgeService.createDocument({
        title: newDoc.title,
        content: newDoc.content,
        docType: newDoc.docType,
        symbol: newDoc.symbol || undefined
      });
      setNewDoc({ title: '', content: '', docType: 'note', symbol: '' });
      await load();
    } finally {
      setActionLoading(null);
    }
  };

  const handleQuery = async () => {
    if (!query.trim()) return;
    setActionLoading('query');
    try {
      const result = await knowledgeService.query(query);
      setQueryResult(result);
    } finally {
      setActionLoading(null);
    }
  };

  const handleTrain = async () => {
    setActionLoading('train');
    try {
      await llmService.startTraining({
        name: trainName,
        trainType,
        config: { force_cpu: true }
      });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Training failed');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/20 rounded-lg border border-cyan-500/30">
            <Database className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-2xl text-white">Knowledge & LLM Training</h2>
            <p className="text-sm text-gray-400">Semantic RAG documents + LoRA/QLoRA fine-tuning for the advisor</p>
          </div>
        </div>
      </motion.div>

      <Tabs defaultValue="knowledge">
        <TabsList className="bg-gray-900 border border-gray-800">
          <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
          <TabsTrigger value="llm">LLM Training</TabsTrigger>
        </TabsList>

        <TabsContent value="knowledge" className="mt-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 space-y-3">
                  <h3 className="text-white font-medium flex items-center gap-2"><Plus className="w-4 h-4" /> Add Research Note</h3>
                  <Input placeholder="Title" value={newDoc.title} onChange={e => setNewDoc({ ...newDoc, title: e.target.value })} className="bg-gray-800 border-gray-700" />
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={newDoc.docType} onValueChange={v => setNewDoc({ ...newDoc, docType: v })}>
                      <SelectTrigger className="bg-gray-800 border-gray-700"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="note">Note</SelectItem>
                        <SelectItem value="research">Research</SelectItem>
                        <SelectItem value="strategy">Strategy</SelectItem>
                        <SelectItem value="news">News</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Symbol (optional)" value={newDoc.symbol} onChange={e => setNewDoc({ ...newDoc, symbol: e.target.value })} className="bg-gray-800 border-gray-700" />
                  </div>
                  <Textarea placeholder="Content..." value={newDoc.content} onChange={e => setNewDoc({ ...newDoc, content: e.target.value })} className="bg-gray-800 border-gray-700 min-h-[100px]" />
                  <Button onClick={handleCreateDoc} disabled={actionLoading === 'create-doc'} className="bg-cyan-500/20 border border-cyan-500/30 text-cyan-400">
                    {actionLoading === 'create-doc' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save & Index'}
                  </Button>
                </div>

                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 space-y-3">
                  <h3 className="text-white font-medium flex items-center gap-2"><Search className="w-4 h-4" /> Semantic Search</h3>
                  <Input placeholder="Query knowledge base..." value={query} onChange={e => setQuery(e.target.value)} className="bg-gray-800 border-gray-700" />
                  <Button onClick={handleQuery} disabled={actionLoading === 'query'} variant="outline" className="border-gray-700">
                    {actionLoading === 'query' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                  </Button>
                  {queryResult && (
                    <div className="text-sm text-gray-300 space-y-2 max-h-48 overflow-y-auto">
                      <Badge className="bg-purple-500/20 text-purple-300">{queryResult.mode || 'hybrid'}</Badge>
                      {queryResult.hits?.map((h, i) => (
                        <p key={i} className="p-2 bg-gray-800/50 rounded border border-gray-700">
                          <span className="text-cyan-400 text-xs">{(h.score * 100).toFixed(0)}% </span>
                          {h.text.slice(0, 200)}{h.text.length > 200 ? '...' : ''}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                <h3 className="text-white font-medium mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4" /> Documents ({docs.length})</h3>
                {docs.length === 0 ? (
                  <p className="text-gray-500 text-sm">No documents yet. Defaults are seeded on first advisor chat.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {docs.map(d => (
                      <div key={d.id} className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                        <div className="flex justify-between">
                          <span className="text-white font-medium">{d.title}</span>
                          <Badge className="bg-gray-700 text-gray-300">{d.docType}</Badge>
                        </div>
                        {d.symbol && <span className="text-xs text-cyan-400">{d.symbol}</span>}
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{d.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="llm" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
              <h3 className="text-gray-400 text-sm mb-1">LLM Service</h3>
              <Badge className={llmStatus?.healthy ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}>
                {llmStatus?.healthy ? 'Online' : 'Offline (deploy llm-service)'}
              </Badge>
              <p className="text-xs text-gray-500 mt-2">GPU: {llmStatus?.gpuAvailable ? 'Yes' : 'No'}</p>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 md:col-span-2 space-y-3">
              <h3 className="text-white font-medium flex items-center gap-2"><Sparkles className="w-4 h-4" /> Start LoRA / QLoRA Training</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Input value={trainName} onChange={e => setTrainName(e.target.value)} className="bg-gray-800 border-gray-700" placeholder="Job name" />
                <Select value={trainType} onValueChange={v => setTrainType(v as 'lora' | 'qlora')}>
                  <SelectTrigger className="bg-gray-800 border-gray-700"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lora">LoRA</SelectItem>
                    <SelectItem value="qlora">QLoRA (4-bit)</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleTrain} disabled={!!actionLoading} className="bg-purple-500/20 border border-purple-500/30 text-purple-400">
                  {actionLoading === 'train' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Train from Knowledge'}
                </Button>
              </div>
              <p className="text-xs text-gray-500">Uses your knowledge documents as training data. Requires llm-service on port 8082.</p>
            </div>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <h3 className="text-white font-medium mb-3 flex items-center gap-2"><Cpu className="w-4 h-4" /> Trained Adapters ({adapters.length})</h3>
            {adapters.length === 0 ? (
              <p className="text-gray-500 text-sm">No adapters yet. Train one to personalize the advisor.</p>
            ) : (
              <div className="space-y-2">
                {(adapters as Array<{ id: string; name: string; baseModel: string; adapterType: string; status: string }>).map(a => (
                  <div key={a.id} className="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                    <div>
                      <span className="text-white">{a.name}</span>
                      <p className="text-xs text-gray-500">{a.baseModel} · {a.adapterType}</p>
                    </div>
                    <Badge className="bg-green-500/20 text-green-400">{a.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
