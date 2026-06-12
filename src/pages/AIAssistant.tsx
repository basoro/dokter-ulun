import { FormEvent, useMemo, useState } from 'react';
import { Bot, Loader2, RotateCcw, Send, Sparkles, User2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { API_CONFIG, API_URLS } from '@/config/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface AssistantPayload {
  intent: string;
  careType?: 'all' | 'ralan' | 'ranap' | null;
  answer: string;
  rows: Record<string, unknown>[];
  columns: string[];
  sqlPreview: string | null;
  suggestions?: string[];
  context?: {
    patientName?: string | null;
    targetDate?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    noRawat?: string | null;
    noRkmMedis?: string | null;
    identifier?: string | null;
    identifierType?: string | null;
    careType?: 'all' | 'ralan' | 'ranap' | null;
    inpatientTab?: 'rawat-bersama' | 'rawat-gabung' | null;
    inpatientStatus?: 'all' | 'masih-dirawat' | 'sudah-pulang' | 'pindah-kamar' | null;
    resumeStatus?: 'all' | 'belum_resume' | 'sudah_resume' | null;
    lastIntent?: string | null;
  };
}

type AssistantContext = NonNullable<AssistantPayload['context']>;

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  message: string;
  payload?: AssistantPayload;
}

type ChatFilterMode = 'all' | 'intent' | 'natural';
const ROW_CONTEXT_KEYS = {
  patientName: ['nm_pasien', 'patient_name', 'nama_pasien'],
  noRawat: ['no_rawat', 'nomor_rawat'],
  noRkmMedis: ['no_rkm_medis', 'no_rm', 'nomor_rm'],
  targetDate: ['tgl_registrasi', 'tgl_periksa', 'tanggal', 'tanggal_registrasi'],
  identifier: ['no_rkm_medis', 'no_ktp', 'nik', 'no_rawat']
} as const;

const EMPTY_CONTEXT: AssistantContext = {
  patientName: null,
  targetDate: null,
  startDate: null,
  endDate: null,
  noRawat: null,
  noRkmMedis: null,
  identifier: null,
  identifierType: null,
  careType: null,
  inpatientTab: null,
  inpatientStatus: null,
  resumeStatus: null,
  lastIntent: null
};

const examplePrompts = [
  'Tampilkan data pasien saya hari ini',
  'Tampilkan data pasien saya kemarin',
  'Berapa pasien rawat inap saya yang belum pulang?',
  'Tampilkan data pasien rawat gabung saya',
  'Cari pasien dengan no rekam medis 000123',
  'Tampilkan kunjungan terakhir pasien Siti Aminah',
  'Tampilkan diagnosis pasien Siti Aminah',
  'Tampilkan resep pasien Siti Aminah',
  'Berikan hasil lab pasien Siti Aminah tanggal 2026-06-12',
  'Berikan hasil radiologi pasien Siti Aminah tanggal 2026-06-12',
  'Tampilkan riwayat rawat inap pasien Siti Aminah',
  'Tampilkan laporan operasi pasien Siti Aminah'
];

const getTodayWibString = () => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  return formatter.format(new Date());
};

const getRelativeDateWibString = (dayOffset: number) => {
  const currentDate = new Date();
  currentDate.setDate(currentDate.getDate() + dayOffset);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  return formatter.format(currentDate);
};

const formatCellValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
};

const suggestionMatchesContext = (prompt: string, context: AssistantContext, lastIntent?: string | null) => {
  const normalizedPrompt = prompt.toLowerCase();

  if (context.careType === 'ranap' && normalizedPrompt.includes('rawat inap')) return true;
  if (context.careType === 'ralan' && normalizedPrompt.includes('rawat jalan')) return true;
  if (context.inpatientTab === 'rawat-bersama' && /rawat bersama|raber|konsul/.test(normalizedPrompt)) return true;
  if (context.inpatientTab === 'rawat-gabung' && normalizedPrompt.includes('rawat gabung')) return true;
  if (context.inpatientStatus === 'masih-dirawat' && /belum pulang|masih dirawat/.test(normalizedPrompt)) return true;
  if (context.inpatientStatus === 'sudah-pulang' && normalizedPrompt.includes('sudah pulang')) return true;
  if (context.inpatientStatus === 'pindah-kamar' && normalizedPrompt.includes('pindah kamar')) return true;
  if (context.resumeStatus === 'belum_resume' && normalizedPrompt.includes('belum resume')) return true;
  if (context.resumeStatus === 'sudah_resume' && normalizedPrompt.includes('sudah resume')) return true;
  if (context.patientName && /pasien ini|diagnosis|resep|lab|radiologi|kunjungan terakhir/.test(normalizedPrompt)) return true;
  if ((context.startDate && context.endDate) && /rentang tanggal|tanggal awal|tanggal akhir/.test(normalizedPrompt)) return true;
  if (context.targetDate && /tanggal ini|tanggal yang sama/.test(normalizedPrompt)) return true;
  if (lastIntent === 'today_patient_list' && /berapa pasien|kemarin/.test(normalizedPrompt)) return true;

  return false;
};

const rankSuggestions = (
  prompts: string[],
  context: AssistantContext,
  input: string,
  lastIntent?: string | null
) => {
  const normalizedInput = input.trim().toLowerCase();

  return [...prompts]
    .sort((left, right) => {
      const leftMatchesContext = suggestionMatchesContext(left, context, lastIntent) ? 1 : 0;
      const rightMatchesContext = suggestionMatchesContext(right, context, lastIntent) ? 1 : 0;
      const leftMatchesInput = normalizedInput && left.toLowerCase().includes(normalizedInput) ? 1 : 0;
      const rightMatchesInput = normalizedInput && right.toLowerCase().includes(normalizedInput) ? 1 : 0;
      const leftScore = leftMatchesContext * 4 + leftMatchesInput * 2;
      const rightScore = rightMatchesContext * 4 + rightMatchesInput * 2;

      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }

      return left.length - right.length;
    })
    .slice(0, 8);
};

const filterPromptsByInput = (prompts: string[], input: string) => {
  const normalizedInput = input.trim().toLowerCase();
  if (!normalizedInput) {
    return prompts.slice(0, 6);
  }

  return prompts
    .filter((prompt) => prompt.toLowerCase().includes(normalizedInput))
    .slice(0, 6);
};

const materializeSuggestion = (prompt: string, context: AssistantContext) => {
  const defaultPatientName = context.patientName || 'Siti Aminah';
  const defaultIdentifier = context.noRkmMedis || context.identifier || '000123';
  const defaultDate = context.targetDate || getTodayWibString();
  const defaultStartDate = context.startDate || getRelativeDateWibString(-7);
  const defaultEndDate = context.endDate || getTodayWibString();

  return prompt
    .replace(/\[nama pasien\]/gi, defaultPatientName)
    .replace(/\[tanggal awal\]/gi, defaultStartDate)
    .replace(/\[tanggal akhir\]/gi, defaultEndDate)
    .replace(/\[tanggal\]/gi, defaultDate)
    .replace(/\[nomor\]/gi, defaultIdentifier)
    .replace(/\s+/g, ' ')
    .trim();
};

const getAssistantModeMeta = (intent?: string | null) => {
  if (intent === 'natural_select') {
    return {
      label: 'Natural SQL',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700'
    };
  }

  if (intent === 'intro') {
    return {
      label: 'Sistem',
      className: 'border-slate-200 bg-slate-50 text-slate-700'
    };
  }

  return {
    label: 'Intent',
    className: 'border-blue-200 bg-blue-50 text-blue-700'
  };
};

const matchesChatFilter = (turn: ChatTurn, filterMode: ChatFilterMode) => {
  if (filterMode === 'all') {
    return true;
  }

  if (turn.role !== 'assistant') {
    return filterMode === 'all';
  }

  if (filterMode === 'natural') {
    return turn.payload?.intent === 'natural_select';
  }

  return Boolean(turn.payload?.intent && turn.payload.intent !== 'natural_select');
};

const getRowValue = (row: Record<string, unknown>, keys: readonly string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value).trim();
    }
  }

  return null;
};

const normalizeNoRawatForRoute = (value: string) => value.replace(/\//g, '');

const getMedicalRecordLink = (row: Record<string, unknown>) => {
  const noRkmMedis = getRowValue(row, ROW_CONTEXT_KEYS.noRkmMedis);
  const noRawat = getRowValue(row, ROW_CONTEXT_KEYS.noRawat);

  if (!noRkmMedis || !noRawat) {
    return null;
  }

  const baseUrl =
    API_CONFIG.BASE_URL_WITHOUT_API ||
    (typeof window !== 'undefined' ? window.location.origin : '');

  if (!baseUrl) {
    return null;
  }

  return `${baseUrl}/rekam-medik/${encodeURIComponent(noRkmMedis)}/${encodeURIComponent(
    normalizeNoRawatForRoute(noRawat)
  )}`;
};

const hasContextValue = (context?: Partial<AssistantContext> | null) =>
  Boolean(
    context?.patientName ||
    context?.targetDate ||
    context?.startDate ||
    context?.endDate ||
    context?.noRawat ||
    context?.noRkmMedis ||
    context?.identifier ||
    context?.careType ||
    context?.inpatientTab ||
    context?.inpatientStatus ||
    context?.resumeStatus ||
    context?.lastIntent
  );

const mergeContexts = (...contexts: Array<Partial<AssistantContext> | null | undefined>): AssistantContext =>
  contexts.reduce<AssistantContext>(
    (merged, current) => ({
      patientName: current?.patientName ?? merged.patientName,
      targetDate: current?.targetDate ?? merged.targetDate,
      startDate: current?.startDate ?? merged.startDate,
      endDate: current?.endDate ?? merged.endDate,
      noRawat: current?.noRawat ?? merged.noRawat,
      noRkmMedis: current?.noRkmMedis ?? merged.noRkmMedis,
      identifier: current?.identifier ?? merged.identifier,
      identifierType: current?.identifierType ?? merged.identifierType,
      careType: current?.careType ?? merged.careType,
      inpatientTab: current?.inpatientTab ?? merged.inpatientTab,
      inpatientStatus: current?.inpatientStatus ?? merged.inpatientStatus,
      resumeStatus: current?.resumeStatus ?? merged.resumeStatus,
      lastIntent: current?.lastIntent ?? merged.lastIntent
    }),
    { ...EMPTY_CONTEXT }
  );

const buildContextFromRow = (
  row: Record<string, unknown>,
  fallbackContext?: Partial<AssistantContext> | null,
  fallbackIntent?: string | null
): AssistantContext | null => {
  const patientName = getRowValue(row, ROW_CONTEXT_KEYS.patientName) || fallbackContext?.patientName || null;
  const noRawat = getRowValue(row, ROW_CONTEXT_KEYS.noRawat) || fallbackContext?.noRawat || null;
  const noRkmMedis = getRowValue(row, ROW_CONTEXT_KEYS.noRkmMedis) || fallbackContext?.noRkmMedis || null;
  const targetDate = getRowValue(row, ROW_CONTEXT_KEYS.targetDate) || fallbackContext?.targetDate || null;
  const identifier = getRowValue(row, ROW_CONTEXT_KEYS.identifier) || noRkmMedis || noRawat || fallbackContext?.identifier || null;
  const identifierType = noRkmMedis
    ? 'no_rkm_medis'
    : noRawat
      ? 'no_rawat'
      : fallbackContext?.identifierType || null;

  if (!patientName && !noRawat && !noRkmMedis && !identifier) {
    return null;
  }

  return {
    patientName,
    targetDate,
    noRawat,
    noRkmMedis,
    identifier,
    identifierType,
    startDate: fallbackContext?.startDate || null,
    endDate: fallbackContext?.endDate || null,
    careType: fallbackContext?.careType || null,
    inpatientTab: fallbackContext?.inpatientTab || null,
    inpatientStatus: fallbackContext?.inpatientStatus || null,
    resumeStatus: fallbackContext?.resumeStatus || null,
    lastIntent: fallbackIntent || fallbackContext?.lastIntent || null
  };
};

const isSameContextRow = (row: Record<string, unknown>, activeContext: AssistantContext) =>
  Boolean(
    activeContext.noRawat &&
      getRowValue(row, ROW_CONTEXT_KEYS.noRawat) &&
      getRowValue(row, ROW_CONTEXT_KEYS.noRawat) === activeContext.noRawat
  ) ||
  Boolean(
    activeContext.noRkmMedis &&
      getRowValue(row, ROW_CONTEXT_KEYS.noRkmMedis) &&
      getRowValue(row, ROW_CONTEXT_KEYS.noRkmMedis) === activeContext.noRkmMedis
  );

const canSelectRowAsContext = (
  intent?: string | null,
  careType?: AssistantPayload['careType']
) => intent === 'today_patient_list' && (careType === 'all' || careType === 'ranap' || careType === null || careType === undefined);

const createInitialAssistantTurn = (): ChatTurn => ({
  id: 'assistant-intro',
  role: 'assistant',
  message: 'Saya siap membantu dengan chat natural. Pertanyaan Anda akan dipahami secara kontekstual dan hanya dijalankan sebagai query database baca-saja yang aman.',
  payload: {
    intent: 'intro',
    answer: 'Saya memakai mode hybrid: intent klinis yang sudah dikenal tetap diprioritaskan, lalu pertanyaan yang lebih bebas bisa diterjemahkan ke query MySQL `SELECT` yang aman.',
    rows: [],
    columns: [],
    sqlPreview: null,
    suggestions: examplePrompts
  }
});

const AIAssistant = () => {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedContext, setSelectedContext] = useState<AssistantContext | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([createInitialAssistantTurn()]);
  const [chatFilterMode, setChatFilterMode] = useState<ChatFilterMode>('all');
  const [expandedSqlPreviewIds, setExpandedSqlPreviewIds] = useState<string[]>([]);

  const lastAssistantPayload = useMemo(
    () => [...chatHistory].reverse().find((turn) => turn.role === 'assistant' && turn.payload)?.payload || null,
    [chatHistory]
  );
  const activeContext = useMemo(
    () => mergeContexts(lastAssistantPayload?.context, selectedContext),
    [lastAssistantPayload?.context, selectedContext]
  );
  const quickSuggestionPrompts = useMemo(() => {
    const backendSuggestions = lastAssistantPayload?.suggestions || [];
    const mergedSuggestions = [...backendSuggestions, ...examplePrompts];
    return rankSuggestions(
      Array.from(new Set(mergedSuggestions)),
      activeContext,
      message,
      lastAssistantPayload?.intent || activeContext.lastIntent || null
    );
  }, [activeContext, lastAssistantPayload?.intent, lastAssistantPayload?.suggestions, message]);
  const visibleSuggestionPrompts = useMemo(
    () => filterPromptsByInput(quickSuggestionPrompts, message),
    [quickSuggestionPrompts, message]
  );
  const naturalSuggestionPrompts = useMemo(
    () => Array.from(new Set(visibleSuggestionPrompts.map((prompt) => materializeSuggestion(prompt, activeContext)))),
    [activeContext, visibleSuggestionPrompts]
  );
  const filteredChatHistory = useMemo(
    () => chatHistory.filter((turn) => matchesChatFilter(turn, chatFilterMode)),
    [chatFilterMode, chatHistory]
  );
  const handleSuggestionClick = (prompt: string) => {
    setMessage(prompt);
  };

  const toggleSqlPreview = (turnId: string) => {
    setExpandedSqlPreviewIds((previous) =>
      previous.includes(turnId)
        ? previous.filter((item) => item !== turnId)
        : [...previous, turnId]
    );
  };

  const handleResetContext = () => {
    setChatHistory([createInitialAssistantTurn()]);
    setMessage('');
    setSelectedContext(null);
    setExpandedSqlPreviewIds([]);
    toast({
      title: 'Konteks Direset',
      description: 'Percakapan AI dimulai ulang tanpa konteks pasien atau tanggal sebelumnya.'
    });
  };

  const handleSelectRowContext = (row: Record<string, unknown>, payload?: AssistantPayload) => {
    const nextContext = buildContextFromRow(row, activeContext, payload?.intent || lastAssistantPayload?.intent || null);
    if (!nextContext) {
      return;
    }

    setSelectedContext(nextContext);
    toast({
      title: 'Konteks Pasien Aktif',
      description: `${nextContext.patientName || 'Pasien terpilih'} siap dipakai untuk pertanyaan lanjutan.`
    });
  };

  const submitQuestion = async (prompt?: string) => {
    const finalMessage = String(prompt || message).trim();
    if (!finalMessage || !user?.username) {
      return;
    }
    const debugTraceId = `ai-${Date.now()}`;

    const userTurn: ChatTurn = {
      id: `user-${Date.now()}`,
      role: 'user',
      message: finalMessage
    };
    const contextTurn = selectedContext && hasContextValue(selectedContext)
      ? {
          role: 'assistant' as const,
          message: 'Konteks aktif dipilih dari baris data pasien.',
          payload: {
            intent: selectedContext.lastIntent || 'manual_context',
            answer: '',
            rows: [],
            columns: [],
            sqlPreview: null,
            context: selectedContext
          }
        }
      : null;
    const historyForRequest = [...chatHistory, userTurn, ...(contextTurn ? [contextTurn] : [])]
      .slice(-10)
      .map((turn) => ({
        role: turn.role,
        message: turn.message,
        payload: turn.payload
      }));

    setChatHistory((previous) => [...previous, userTurn]);
    setLoading(true);
    setMessage('');

    try {
      // #region debug-point A:ai-request-start
      import.meta.env.DEV && fetch("http://127.0.0.1:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"prod-ai-json-error",runId:"pre-fix",hypothesisId:"A",location:"src/pages/AIAssistant.tsx:submitQuestion",msg:"[DEBUG] AI request start",data:{traceId:debugTraceId,url:API_URLS.DOCTOR_AI_ASSISTANT,username:user.username,hasSelectedContext:Boolean(selectedContext),historyCount:historyForRequest.length},ts:Date.now()})}).catch(()=>{});
      // #endregion
      const response = await fetch(API_URLS.DOCTOR_AI_ASSISTANT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          message: finalMessage,
          username: user.username,
          doctorName: user.name,
          conversationHistory: historyForRequest
        })
      });

      // #region debug-point B:ai-response-meta
      import.meta.env.DEV && response.clone().text().then((body)=>fetch("http://127.0.0.1:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"prod-ai-json-error",runId:"pre-fix",hypothesisId:"B",location:"src/pages/AIAssistant.tsx:submitQuestion",msg:"[DEBUG] AI response meta",data:{traceId:debugTraceId,url:response.url,status:response.status,ok:response.ok,redirected:response.redirected,contentType:response.headers.get('content-type'),bodyStart:body.slice(0,180)},ts:Date.now()})}).catch(()=>{})).catch((cloneError)=>fetch("http://127.0.0.1:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"prod-ai-json-error",runId:"pre-fix",hypothesisId:"B",location:"src/pages/AIAssistant.tsx:submitQuestion",msg:"[DEBUG] AI response clone failed",data:{traceId:debugTraceId,error:cloneError instanceof Error ? cloneError.message : String(cloneError)},ts:Date.now()})}).catch(()=>{}));
      // #endregion

      const payload = await response.json();
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || payload.message || 'Gagal memproses pertanyaan AI');
      }

      const assistantTurn: ChatTurn = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        message: payload.data.answer,
        payload: payload.data
      };

      setSelectedContext(null);
      setChatHistory((previous) => [...previous, assistantTurn]);
    } catch (error) {
      // #region debug-point C:ai-request-error
      import.meta.env.DEV && fetch("http://127.0.0.1:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"prod-ai-json-error",runId:"pre-fix",hypothesisId:"C",location:"src/pages/AIAssistant.tsx:submitQuestion",msg:"[DEBUG] AI request error",data:{traceId:debugTraceId,error:error instanceof Error ? error.message : String(error)},ts:Date.now()})}).catch(()=>{});
      // #endregion
      console.error('AI assistant request failed:', error);
      toast({
        title: 'AI Assistant Error',
        description: error instanceof Error ? error.message : 'Terjadi kesalahan saat memproses pertanyaan',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitQuestion();
  };

  return (
    <div className="p-2 md:p-6 space-y-6 md:space-y-8 w-full mx-auto animate-fade-in shadow-md bg-white rounded-md">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">AI Asisten Dokter</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Asisten ini menerima pertanyaan natural seperti percakapan biasa. Sistem memprioritaskan intent klinis yang sudah dikenal, lalu memakai fallback query `SELECT` yang aman untuk pertanyaan yang lebih bebas.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={handleResetContext} disabled={loading}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset Konteks
          </Button>
        </div>

        <div className="grid gap-6">
          <Card className="min-w-0">
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle>Chat</CardTitle>
                <div className="flex flex-col gap-2 md:items-end">
                  <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
                    <Badge variant="outline" className="max-w-full whitespace-normal">
                      Pasien: {activeContext.patientName || '-'}
                    </Badge>
                    <Badge variant="outline" className="max-w-full whitespace-normal">
                      No. Rawat: {activeContext.noRawat || '-'}
                    </Badge>
                    <Badge variant="outline" className="max-w-full whitespace-normal">
                      No. RM: {activeContext.noRkmMedis || '-'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={chatFilterMode === 'all' ? 'default' : 'outline'}
                      size="sm"
                      className="h-8"
                      onClick={() => setChatFilterMode('all')}
                    >
                      Semua
                    </Button>
                    <Button
                      type="button"
                      variant={chatFilterMode === 'intent' ? 'default' : 'outline'}
                      size="sm"
                      className="h-8"
                      onClick={() => setChatFilterMode('intent')}
                    >
                      Intent
                    </Button>
                    <Button
                      type="button"
                      variant={chatFilterMode === 'natural' ? 'default' : 'outline'}
                      size="sm"
                      className="h-8"
                      onClick={() => setChatFilterMode('natural')}
                    >
                      Natural SQL
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-[560px] space-y-4 overflow-y-auto rounded-md border bg-muted/20 p-4">
                {filteredChatHistory.map((turn) => (
                  <div
                    key={turn.id}
                    className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[90%] rounded-lg px-4 py-3 shadow-sm ${
                        turn.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-white border'
                      }`}
                    >
                      {turn.role === 'assistant' ? (() => {
                        const modeMeta = getAssistantModeMeta(turn.payload?.intent);
                        const isSqlPreviewExpanded = expandedSqlPreviewIds.includes(turn.id);

                        return (
                          <>
                      <div className="mb-2 flex items-center gap-2 text-xs font-medium opacity-80">
                        {turn.role === 'user' ? <User2 className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                        <span>{turn.role === 'user' ? 'Dokter' : 'AI Asisten'}</span>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${modeMeta.className}`}
                            >
                              {modeMeta.label}
                            </span>
                            {turn.payload?.sqlPreview ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[10px]"
                                onClick={() => toggleSqlPreview(turn.id)}
                              >
                                {isSqlPreviewExpanded ? 'Sembunyikan SQL' : 'Lihat SQL'}
                              </Button>
                            ) : null}
                          </div>
                          <div className="whitespace-pre-wrap text-sm">{turn.message}</div>
                          {turn.payload?.sqlPreview && isSqlPreviewExpanded ? (
                            <div className="mt-2 rounded-md bg-muted/60 px-2.5 py-2 text-[11px] text-muted-foreground">
                              <span className="font-semibold">SQL Preview:</span> {turn.payload.sqlPreview}
                            </div>
                          ) : null}
                        </>
                        );
                      })() : (
                        <>
                          <div className="mb-2 flex items-center gap-2 text-xs font-medium opacity-80">
                            <User2 className="h-4 w-4" />
                            <span>Dokter</span>
                          </div>
                          <div className="whitespace-pre-wrap text-sm">{turn.message}</div>
                        </>
                      )}

                      {turn.role === 'assistant' && turn.payload?.rows?.length ? (
                        <div className="mt-4 space-y-3">
                          {canSelectRowAsContext(turn.payload?.intent, turn.payload?.careType) ? (
                            <div className="text-xs text-muted-foreground">
                              Klik baris pasien untuk menjadikannya konteks aktif.
                            </div>
                          ) : null}
                          <div className="overflow-x-auto rounded-md border">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-muted/50">
                                  {turn.payload.columns.map((column) => (
                                    <th key={column} className="p-3 text-left font-medium">
                                      {column}
                                    </th>
                                  ))}
                                  <th className="p-3 text-left font-medium">Aksi</th>
                                </tr>
                              </thead>
                              <tbody>
                                {turn.payload.rows.map((row, index) => {
                                  const rowContext = buildContextFromRow(
                                    row,
                                    turn.payload?.context,
                                    turn.payload?.intent || null
                                  );
                                  const isSelectable =
                                    canSelectRowAsContext(turn.payload?.intent, turn.payload?.careType) && Boolean(rowContext);
                                  const isActiveRow = isSelectable && isSameContextRow(row, activeContext);
                                  const medicalRecordLink = getMedicalRecordLink(row);

                                  return (
                                    <tr
                                      key={`${index}-${JSON.stringify(row)}`}
                                      className={`border-t ${
                                        isSelectable ? 'cursor-pointer hover:bg-muted/50' : ''
                                      } ${isActiveRow ? 'bg-primary/10' : ''}`}
                                      onClick={() =>
                                        isSelectable ? handleSelectRowContext(row, turn.payload) : undefined
                                      }
                                    >
                                      {turn.payload?.columns.map((column) => (
                                        <td key={`${index}-${column}`} className="p-3 align-top">
                                          {formatCellValue(row[column])}
                                        </td>
                                      ))}
                                      <td className="p-3 align-top">
                                        {medicalRecordLink ? (
                                          <Button
                                            asChild
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8"
                                          >
                                            <a
                                              href={medicalRecordLink}
                                              target="_blank"
                                              rel="noreferrer"
                                              onClick={(event) => event.stopPropagation()}
                                            >
                                              Buka Rekam Medis
                                            </a>
                                          </Button>
                                        ) : (
                                          <span className="text-xs text-muted-foreground">-</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          {canSelectRowAsContext(turn.payload?.intent, turn.payload?.careType) &&
                          turn.payload.rows.some((item) =>
                            Boolean(buildContextFromRow(item, turn.payload?.context, turn.payload?.intent || null))
                          ) ? (
                            <div className="text-[11px] text-muted-foreground">
                              Baris yang berisi identitas pasien bisa diklik untuk memperbarui konteks aktif.
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="rounded-lg border bg-white px-4 py-3 shadow-sm">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Memproses pertanyaan...</span>
                      </div>
                    </div>
                  </div>
                )}
                {!loading && filteredChatHistory.length === 0 ? (
                  <div className="rounded-md border border-dashed bg-white/80 px-4 py-6 text-center text-sm text-muted-foreground">
                    Belum ada chat yang cocok untuk filter ini.
                  </div>
                ) : null}
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Tulis pertanyaan natural Anda, misalnya: tampilkan diagnosis pasien Siti Aminah yang berobat minggu ini"
                  rows={4}
                  disabled={loading}
                />
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">
                    Contoh pertanyaan natural
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {naturalSuggestionPrompts.map((prompt) => (
                      <Button
                        key={prompt}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-auto whitespace-normal text-left"
                        onClick={() => handleSuggestionClick(prompt)}
                        disabled={loading}
                      >
                        {prompt}
                      </Button>
                    ))}
                  </div>
                  {message.trim() && naturalSuggestionPrompts.length === 0 ? (
                    <div className="text-xs text-muted-foreground">
                      Tidak ada saran yang cocok dengan teks input saat ini.
                    </div>
                  ) : null}
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={loading || !message.trim()}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Kirim
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
  );
};

export default AIAssistant;
