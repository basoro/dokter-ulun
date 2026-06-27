import dotenv from 'dotenv';

dotenv.config();

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

const extractJsonFromText = (value) => {
  const text = String(value || '').trim();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }

    const candidate = text.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      return null;
    }
  }
};

class VoiceToSoapService {
  constructor() {
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY;
    this.openRouterModel = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
    this.openRouterSiteUrl = process.env.OPENROUTER_SITE_URL;
    this.openRouterAppName = process.env.OPENROUTER_APP_NAME || 'Dokter React';

    this.openAIApiKey = process.env.OPENAI_API_KEY;
    this.openAIModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  async generateSoap({ transcript, context }) {
    const normalizedTranscript = String(transcript || '').trim();
    if (!normalizedTranscript) {
      throw new Error('Transkrip suara wajib diisi');
    }

    const patientName = String(context?.patient_name || '').trim();
    const noRkmMedis = String(context?.no_rkm_medis || '').trim();
    const noRawat = String(context?.no_rawat || '').trim();
    const statusRawat = String(context?.status_rawat || '').trim();

    const hasOpenRouter = Boolean(this.openRouterApiKey);
    const hasOpenAI = Boolean(this.openAIApiKey);
    if (!hasOpenRouter && !hasOpenAI) {
      throw new Error('API key AI belum dikonfigurasi (OPENROUTER_API_KEY / OPENAI_API_KEY)');
    }

    const endpoint = hasOpenRouter ? OPENROUTER_ENDPOINT : OPENAI_ENDPOINT;
    const apiKey = hasOpenRouter ? this.openRouterApiKey : this.openAIApiKey;
    const model = hasOpenRouter ? this.openRouterModel : this.openAIModel;

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    if (hasOpenRouter) {
      if (this.openRouterSiteUrl) {
        headers['HTTP-Referer'] = this.openRouterSiteUrl;
      }
      if (this.openRouterAppName) {
        headers['X-Title'] = this.openRouterAppName;
      }
    }

    const systemPrompt = [
      'Anda adalah asisten medis untuk dokumentasi dokter.',
      'Tugas: ubah narasi dokter menjadi SOAPIE yang rapi.',
      'Output WAJIB JSON murni (tanpa markdown), dengan schema:',
      '{ "s": string, "o": string, "a": string, "p": string, "i": string, "e": string }',
      'Gunakan bahasa Indonesia.',
      'Jika suatu bagian tidak ada, isi dengan string kosong.',
      'Bila menemukan angka vital sign (TD, nadi, RR, suhu, SpO2), masukkan ke bagian O.',
      'Bila menemukan diagnosis, masukkan ke bagian A.',
      'Bila menemukan rencana/terapi/monitoring, masukkan ke bagian P.',
      'Instruksi/tindakan yang dilakukan masukkan ke bagian I.',
      'Evaluasi/respon/hasil masukkan ke bagian E.',
      patientName || noRkmMedis || noRawat || statusRawat
        ? `Konteks pasien: nama=${patientName || '-'}, no_rkm_medis=${noRkmMedis || '-'}, no_rawat=${noRawat || '-'}, status_rawat=${statusRawat || '-'}`
        : '',
    ].filter(Boolean).join('\n');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: normalizedTranscript },
        ],
        temperature: 0.2,
        max_tokens: 900,
      }),
    });

    const json = await response.json().catch(() => null);
    if (!response.ok) {
      const message = json?.error?.message || json?.error || `HTTP error! status: ${response.status}`;
      throw new Error(message);
    }

    const content = json?.choices?.[0]?.message?.content;
    const parsed = extractJsonFromText(content);

    const data = parsed && typeof parsed === 'object' ? parsed : null;
    const s = String(data?.s || '').trim();
    const o = String(data?.o || '').trim();
    const a = String(data?.a || '').trim();
    const p = String(data?.p || '').trim();
    const i = String(data?.i || '').trim();
    const e = String(data?.e || '').trim();

    return { s, o, a, p, i, e };
  }
}

export default new VoiceToSoapService();
