import { FormEvent, useMemo, useState } from 'react';
import { Bot, Loader2, RotateCcw, Send, Sparkles, User2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { API_URLS } from '@/config/api';
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
    inpatientStatus?: 'all' | 'masih-dirawat' | 'sudah-pulang' | 'pindah-kamar' | null;
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

const PLACEHOLDER_REGEX = /\[([^\]]+)\]/g;
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
  inpatientStatus: null,
  lastIntent: null
};

const promptGroups = [
  {
    title: 'Pasien Hari Ini',
    description: 'Lihat daftar dan ringkasan pasien dokter login untuk hari ini.',
    prompts: [
      'Tampilkan data pasien saya hari ini',
      'Tampilkan data pasien saya kemarin',
      'Berapa pasien saya untuk hari ini?'
    ]
  },
  {
    title: 'Daftar Pasien Lanjutan',
    description: 'Gunakan variasi waktu, status rawat inap, atau rentang tanggal.',
    prompts: [
      'Tampilkan data pasien saya rawat inap belum pulang',
      'Tampilkan data pasien saya dari tanggal [tanggal awal] sampai [tanggal akhir]',
      'Tampilkan data pasien saya rawat inap dari tanggal [tanggal awal] sampai [tanggal akhir]'
    ]
  },
  {
    title: 'Pencarian Pasien',
    description: 'Cari pasien berdasarkan nama atau nomor identitas.',
    prompts: [
      'Carikan saya data rekam medis pasien bernama [nama pasien]',
      'Cari pasien dengan no rekam medis [nomor]',
      'Tampilkan kunjungan terakhir pasien [nama pasien]'
    ]
  },
  {
    title: 'Pemeriksaan',
    description: 'Ambil hasil pemeriksaan penunjang dan data klinis pasien.',
    prompts: [
      'Berikan saya hasil lab untuk pasien [nama pasien] tanggal [tanggal]',
      'Berikan saya hasil radiologi pasien [nama pasien] tanggal [tanggal]',
      'Tampilkan diagnosis pasien [nama pasien]',
      'Tampilkan resep pasien [nama pasien]'
    ]
  },
  {
    title: 'Riwayat Klinis',
    description: 'Lihat riwayat perawatan lanjutan pasien.',
    prompts: [
      'Tampilkan riwayat rawat inap pasien [nama pasien]',
      'Tampilkan laporan operasi pasien [nama pasien]'
    ]
  }
];

const examplePrompts = promptGroups.flatMap((group) => group.prompts);

const formatCellValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
};

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

const extractPromptVariables = (template: string) => {
  const variables = Array.from(template.matchAll(PLACEHOLDER_REGEX)).map((match) => match[1].trim());
  return Array.from(new Set(variables));
};

const getVariableLabel = (variable: string) => {
  const normalized = variable.toLowerCase();
  if (normalized.includes('nama')) return 'Nama Pasien';
  if (normalized.includes('tanggal')) return 'Tanggal';
  if (normalized.includes('rawat')) return 'No. Rawat';
  if (normalized.includes('rm')) return 'No. Rekam Medis';
  if (normalized.includes('nik')) return 'NIK';
  if (normalized.includes('nomor')) return 'Nomor';
  return variable;
};

const getVariableInputType = (variable: string) => {
  const normalized = variable.toLowerCase();
  if (normalized.includes('tanggal')) return 'date';
  return 'text';
};

const buildDefaultVariableValue = (variable: string, context?: AssistantPayload['context']) => {
  const normalized = variable.toLowerCase();
  if (normalized.includes('nama')) return context?.patientName || '';
  if (normalized.includes('awal') && normalized.includes('tanggal')) return context?.startDate || context?.targetDate || getTodayWibString();
  if (normalized.includes('akhir') && normalized.includes('tanggal')) return context?.endDate || context?.targetDate || getTodayWibString();
  if (normalized.includes('tanggal')) return context?.targetDate || getTodayWibString();
  if (normalized.includes('rawat')) return context?.noRawat || '';
  if (normalized.includes('rm')) return context?.noRkmMedis || context?.identifier || '';
  if (normalized.includes('nomor')) return context?.identifier || context?.noRkmMedis || '';
  return '';
};

const fillPromptTemplate = (template: string, values: Record<string, string>) =>
  template.replace(PLACEHOLDER_REGEX, (_, key) => values[String(key).trim()] || `[${key}]`);

const filterPromptsByInput = (prompts: string[], input: string) => {
  const normalizedInput = input.trim().toLowerCase();
  if (!normalizedInput) {
    return prompts.slice(0, 6);
  }

  return prompts
    .filter((prompt) => prompt.toLowerCase().includes(normalizedInput))
    .slice(0, 6);
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
    context?.inpatientStatus ||
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
      inpatientStatus: current?.inpatientStatus ?? merged.inpatientStatus,
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
    inpatientStatus: fallbackContext?.inpatientStatus || null,
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
  message: 'Saya siap membantu pencarian data berbasis database untuk dokter login.',
  payload: {
    intent: 'intro',
    answer: 'Saya hanya menjalankan query MySQL `SELECT` yang aman dan dibatasi pada kebutuhan pencarian data dokter.',
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
  const [promptDialogOpen, setPromptDialogOpen] = useState(false);
  const [activePromptTemplate, setActivePromptTemplate] = useState('');
  const [activePromptVariables, setActivePromptVariables] = useState<string[]>([]);
  const [promptVariableValues, setPromptVariableValues] = useState<Record<string, string>>({});
  const [selectedContext, setSelectedContext] = useState<AssistantContext | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([createInitialAssistantTurn()]);

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
    return Array.from(new Set(mergedSuggestions));
  }, [lastAssistantPayload?.suggestions]);
  const visibleSuggestionPrompts = useMemo(
    () => filterPromptsByInput(quickSuggestionPrompts, message),
    [quickSuggestionPrompts, message]
  );
  const handlePromptTemplateClick = (template: string) => {
    const variables = extractPromptVariables(template);
    if (variables.length === 0) {
      submitQuestion(template);
      return;
    }

    const defaults = Object.fromEntries(
      variables.map((variable) => [
        variable,
        buildDefaultVariableValue(variable, activeContext)
      ])
    );

    setActivePromptTemplate(template);
    setActivePromptVariables(variables);
    setPromptVariableValues(defaults);
    setPromptDialogOpen(true);
  };

  const handleResetContext = () => {
    setChatHistory([createInitialAssistantTurn()]);
    setMessage('');
    setPromptDialogOpen(false);
    setActivePromptTemplate('');
    setActivePromptVariables([]);
    setPromptVariableValues({});
    setSelectedContext(null);
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

  const handlePromptDialogSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const emptyVariable = activePromptVariables.find(
      (variable) => !String(promptVariableValues[variable] || '').trim()
    );

    if (emptyVariable) {
      toast({
        title: 'Variabel Belum Lengkap',
        description: `${getVariableLabel(emptyVariable)} harus diisi terlebih dahulu.`,
        variant: 'destructive'
      });
      return;
    }

    const finalPrompt = fillPromptTemplate(activePromptTemplate, promptVariableValues)
      .replace(/\s+/g, ' ')
      .trim();

    setPromptDialogOpen(false);
    setActivePromptTemplate('');
    setActivePromptVariables([]);
    setPromptVariableValues({});
    await submitQuestion(finalPrompt);
  };

  const handlePromptDialogOpenChange = (open: boolean) => {
    setPromptDialogOpen(open);

    if (!open) {
      setActivePromptTemplate('');
      setActivePromptVariables([]);
      setPromptVariableValues({});
    }
  };

  return (
    <>
      <Dialog open={promptDialogOpen} onOpenChange={handlePromptDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Isi Variabel Pertanyaan</DialogTitle>
            <DialogDescription>
              Lengkapi nilai variabel agar pertanyaan cepat bisa langsung dijalankan.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePromptDialogSubmit} className="space-y-4">
            <div className="space-y-4">
              {activePromptVariables.map((variable) => (
                <div key={variable} className="space-y-2">
                  <Label htmlFor={`prompt-variable-${variable}`}>{getVariableLabel(variable)}</Label>
                  {getVariableInputType(variable) === 'date' && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPromptVariableValues((previous) => ({
                            ...previous,
                            [variable]: getTodayWibString()
                          }))
                        }
                      >
                        Hari Ini
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPromptVariableValues((previous) => ({
                            ...previous,
                            [variable]: getRelativeDateWibString(-1)
                          }))
                        }
                      >
                        Kemarin
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setPromptVariableValues((previous) => ({
                            ...previous,
                            [variable]: getRelativeDateWibString(-7)
                          }))
                        }
                      >
                        7 Hari Lalu
                      </Button>
                    </div>
                  )}
                  <Input
                    id={`prompt-variable-${variable}`}
                    type={getVariableInputType(variable)}
                    value={promptVariableValues[variable] || ''}
                    onChange={(event) =>
                      setPromptVariableValues((previous) => ({
                        ...previous,
                        [variable]: event.target.value
                      }))
                    }
                    placeholder={`Masukkan ${getVariableLabel(variable).toLowerCase()}`}
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPromptDialogOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit">Gunakan Pertanyaan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="p-2 md:p-6 space-y-6 md:space-y-8 w-full mx-auto animate-fade-in">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">AI Asisten Dokter</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Asisten ini hanya menjalankan query MySQL baca-saja (`SELECT`) untuk membantu dokter login mencari data pasien, kunjungan terakhir, diagnosis, resep, hasil lab, hasil radiologi, rawat inap, laporan operasi, dan jumlah pasien.
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
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-[560px] space-y-4 overflow-y-auto rounded-md border bg-muted/20 p-4">
              {chatHistory.map((turn) => (
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
                    <div className="mb-2 flex items-center gap-2 text-xs font-medium opacity-80">
                      {turn.role === 'user' ? <User2 className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                      <span>{turn.role === 'user' ? 'Dokter' : 'AI Asisten'}</span>
                    </div>
                    <div className="whitespace-pre-wrap text-sm">{turn.message}</div>

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
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Tulis pertanyaan Anda, misalnya: tampilkan diagnosis pasien [nama pasien]"
                rows={4}
                disabled={loading}
              />
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  Saran pertanyaan untuk input chat
                </div>
                <div className="flex flex-wrap gap-2">
                  {visibleSuggestionPrompts.map((prompt) => (
                    <Button
                      key={prompt}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-auto whitespace-normal text-left"
                      onClick={() => handlePromptTemplateClick(prompt)}
                      disabled={loading}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
                {message.trim() && visibleSuggestionPrompts.length === 0 ? (
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
    </>
  );
};

export default AIAssistant;
