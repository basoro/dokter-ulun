import dotenv from 'dotenv';

dotenv.config();

class MedicalScribeService {
  constructor() {
    this.openAIApiKey = process.env.OPENAI_API_KEY;
    
    if (!this.openAIApiKey) {
      console.warn('OPENAI_API_KEY not found in environment variables');
    }
  }

  async generateMedicalSuggestion(text, no_rkm_medis, patient_name) {
    if (!this.openAIApiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    if (!text || !no_rkm_medis || !patient_name) {
      throw new Error('Missing required parameters: text, no_rkm_medis, and patient_name are required');
    }

    console.log('Processing medical scribe request for:', { no_rkm_medis, patient_name, text });

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { 
              role: 'system', 
              content: `Anda adalah asisten AI medis yang membantu dokumentasi medis. 
              Anda sedang membantu pasien ${patient_name} (Rekam Medis: ${no_rkm_medis}).
              Berikan saran medis profesional untuk dokumentasi SOAPIE berdasarkan input yang diberikan.
              
              Dalam respons Anda, sertakan:
              1. Analisis kondisi pasien berdasarkan data yang tersedia
              2. Saran terapi obat yang sesuai dengan kondisi pasien (nama obat, dosis, frekuensi, durasi)
              3. Saran pemeriksaan laboratorium yang diperlukan (jika ada indikasi)
              4. Saran pemeriksaan radiologi yang diperlukan (jika ada indikasi)
              5. Rekomendasi tindak lanjut atau monitoring
              
              Berikan respons yang ringkas dan sesuai dengan standar medis. Gunakan bahasa Indonesia dalam semua respons.` 
            },
            { role: 'user', content: text }
          ],
          max_tokens: 1500,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const result = data.choices[0].message.content;

      console.log('AI response generated successfully');

      return { result };
    } catch (error) {
      console.error('Error in medical scribe service:', error);
      throw error;
    }
  }

  async generateClinicalPathway(patientData) {
    if (!this.openAIApiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    if (!patientData || !patientData.no_rkm_medis || !patientData.patient_name) {
      throw new Error('Missing required patient data: no_rkm_medis and patient_name are required');
    }

    console.log('Processing clinical pathway generation for:', { 
      no_rkm_medis: patientData.no_rkm_medis, 
      patient_name: patientData.patient_name 
    });
    // console.log('Full patient data received:', JSON.stringify(patientData, null, 2));
    // console.log('ICD10 Secondary in service:', JSON.stringify(patientData.icd10_secondary, null, 2));
    // console.log('ICD9 Secondary in service:', JSON.stringify(patientData.icd9_secondary, null, 2));

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { 
              role: 'system', 
              content: `Anda adalah dokter spesialis yang ahli dalam membuat Clinical Pathway. 
              Anda sedang membuat Clinical Pathway untuk pasien ${patientData.patient_name} (Rekam Medis: ${patientData.no_rkm_medis}).
              
              Berdasarkan data pasien yang diberikan, buatlah Clinical Pathway yang komprehensif dalam format JSON dengan struktur berikut:
              {
                "diagnosis": {
                  "primary": "diagnosis utama",
                  "secondary": ["diagnosis sekunder 1", "diagnosis sekunder 2"]
                },
                "icd10Primary": {
                  "code": "kode ICD-10",
                  "description": "deskripsi diagnosis"
                },
                "icd10Secondary": [
                  {
                    "code": "kode ICD-10",
                    "description": "deskripsi diagnosis"
                  }
                ],
                "icd9Primary": {
                  "code": "kode ICD-9",
                  "description": "deskripsi prosedur"
                },
                "icd9Secondary": [
                  {
                    "code": "kode ICD-9",
                    "description": "deskripsi prosedur"
                  }
                ],
                "treatmentPlan": {
                  "goals": ["tujuan perawatan 1", "tujuan perawatan 2"],
                  "expectedOutcome": "hasil yang diharapkan",
                  "estimatedLength": "estimasi lama perawatan"
                },
                "pathwayData": [
                  {
                    "category": "ASESMEN",
                    "items": [
                      {
                        "name": "Asesmen awal medis",
                        "days": [true, false, false, false, false, false, false],
                        "notes": "catatan",
                        "variance": ""
                      },
                      {
                        "name": "Asesmen awal keperawatan",
                        "days": [true, false, false, false, false, false, false],
                        "notes": "catatan",
                        "variance": ""
                      },
                      {
                        "name": "Asesmen nyeri",
                        "days": [true, true, true, true, true, true, true],
                        "notes": "catatan",
                        "variance": ""
                      },
                      {
                        "name": "Asesmen risiko jatuh",
                        "days": [true, false, false, false, false, false, false],
                        "notes": "catatan",
                        "variance": ""
                      },
                      {
                        "name": "Asesmen gizi",
                        "days": [true, false, false, false, false, false, false],
                        "notes": "catatan",
                        "variance": ""
                      },
                      {
                        "name": "EKG/Pemeriksaan penunjang",
                        "days": [true, false, false, false, false, false, false],
                        "notes": "catatan",
                        "variance": ""
                      },
                      {
                        "name": "Laboratorium",
                        "days": [true, false, true, false, false, false, false],
                        "notes": "catatan",
                        "variance": ""
                      }
                    ]
                  },
                  {
                    "category": "KONSULTASI",
                    "items": [
                      {
                        "name": "Konsultasi spesialis terkait",
                        "days": [true, false, false, false, false, false, false],
                        "notes": "catatan",
                        "variance": ""
                      },
                      {
                        "name": "Konsultasi gizi",
                        "days": [false, true, false, false, false, false, false],
                        "notes": "catatan",
                        "variance": ""
                      },
                      {
                        "name": "Konsultasi farmasi",
                        "days": [true, false, false, false, false, false, false],
                        "notes": "catatan",
                        "variance": ""
                      },
                      {
                        "name": "Konsultasi rehabilitasi medik",
                        "days": [false, false, true, false, false, false, false],
                        "notes": "catatan",
                        "variance": ""
                      }
                    ]
                  },
                  {
                    "category": "TINDAKAN MEDIS",
                    "items": [
                      {
                        "name": "Persiapan tindakan medis",
                        "days": [true, false, false, false, false, false, false],
                        "notes": "catatan",
                        "variance": ""
                      },
                      {
                        "name": "Tindakan diagnostik",
                        "days": [false, true, false, false, false, false, false],
                        "notes": "catatan",
                        "variance": ""
                      },
                      {
                        "name": "Tindakan terapeutik",
                        "days": [false, true, true, false, false, false, false],
                        "notes": "catatan",
                        "variance": ""
                      },
                      {
                        "name": "Monitoring post tindakan",
                        "days": [false, false, true, true, true, false, false],
                        "notes": "catatan",
                        "variance": ""
                      }
                    ]
                  },
                  {
                    "category": "TINDAKAN KEPERAWATAN",
                    "items": [
                      {
                        "name": "Pemasangan infus",
                        "days": [true, false, false, false, false, false, false],
                        "notes": "catatan",
                        "variance": ""
                      },
                      {
                        "name": "Monitoring vital sign",
                        "days": [true, true, true, true, true, true, true],
                        "notes": "catatan",
                        "variance": ""
                      },
                      {
                        "name": "Perawatan luka",
                        "days": [false, true, true, true, false, false, false],
                        "notes": "catatan",
                        "variance": ""
                      },
                      {
                        "name": "Mobilisasi",
                        "days": [false, true, true, true, true, true, true],
                        "notes": "catatan",
                        "variance": ""
                      },
                      {
                        "name": "Edukasi pasien & keluarga",
                        "days": [true, false, false, false, false, false, true],
                        "notes": "catatan",
                        "variance": ""
                      }
                    ]
                  },
                  {
                    "category": "TINDAKAN FARMASI",
                    "items": [
                      {
                        "name": "Rekonsiliasi obat",
                        "days": [true, false, false, false, false, false, false],
                        "notes": "catatan",
                        "variance": ""
                      },
                      {
                        "name": "Pemberian obat",
                        "days": [true, true, true, true, true, true, true],
                        "notes": "catatan",
                        "variance": ""
                      },
                      {
                        "name": "Monitoring efek samping",
                        "days": [false, true, true, true, true, true, true],
                        "notes": "catatan",
                        "variance": ""
                      },
                      {
                        "name": "Edukasi penggunaan obat",
                        "days": [true, false, false, false, false, false, true],
                        "notes": "catatan",
                        "variance": ""
                      }
                    ]
                  },
                  {
                    "category": "AKTIVITAS HARIAN",
                    "items": [
                      {
                        "name": "Diet/Nutrisi",
                        "days": [true, true, true, true, true, true, true],
                        "notes": "catatan",
                        "variance": ""
                      },
                      {
                        "name": "Aktivitas/Mobilisasi",
                        "days": [false, true, true, true, true, true, true],
                        "notes": "catatan",
                        "variance": ""
                      },
                      {
                        "name": "Istirahat/Tidur",
                        "days": [true, true, true, true, true, true, true],
                        "notes": "catatan",
                        "variance": ""
                      },
                      {
                        "name": "Personal hygiene",
                        "days": [true, true, true, true, true, true, true],
                        "notes": "catatan",
                        "variance": ""
                      },
                      {
                        "name": "Eliminasi",
                        "days": [true, true, true, true, true, true, true],
                        "notes": "catatan",
                        "variance": ""
                      }
                    ]
                  },
                  {
                    "category": "DISCHARGE PLANNING",
                    "items": [
                      {
                        "name": "Asesmen discharge planning",
                        "days": [true, false, false, false, false, false, false],
                        "notes": "catatan",
                        "variance": ""
                      },
                      {
                        "name": "Edukasi pulang",
                        "days": [false, false, false, false, false, false, true],
                        "notes": "catatan",
                        "variance": ""
                      },
                      {
                        "name": "Resep pulang",
                        "days": [false, false, false, false, false, false, true],
                        "notes": "catatan",
                        "variance": ""
                      },
                      {
                        "name": "Jadwal kontrol",
                        "days": [false, false, false, false, false, false, true],
                        "notes": "catatan",
                        "variance": ""
                      },
                      {
                        "name": "Rujukan lanjutan",
                        "days": [false, false, false, false, false, false, true],
                        "notes": "catatan",
                        "variance": ""
                      }
                    ]
                  }
                ],
                "estimatedCosts": {
                  "roomCare": 0,
                  "medical": 0,
                  "nursing": 0,
                  "medication": 0,
                  "laboratory": 0,
                  "radiology": 0,
                  "consultation": 0,
                  "other": 0
                }
              }
              
              Pastikan semua kode ICD-10 dan ICD-9 yang digunakan adalah kode yang valid dan sesuai dengan kondisi pasien.
              Berikan respons dalam format JSON yang valid tanpa penjelasan tambahan.` 
            },
            { 
              role: 'user', 
              content: `Data pasien:\n${JSON.stringify(patientData, null, 2)}` 
            }
          ],
          max_tokens: 5000,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const result = data.choices[0].message.content;

      console.log('Clinical Pathway generated successfully');

      // Parse JSON response
      try {
        // Clean up markdown code blocks if present
        let cleanedResult = result.trim();
        if (cleanedResult.startsWith('```json')) {
          cleanedResult = cleanedResult.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedResult.startsWith('```')) {
          cleanedResult = cleanedResult.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        const clinicalPathway = JSON.parse(cleanedResult);
        return { clinicalPathway };
      } catch (parseError) {
        console.error('Error parsing AI response as JSON:', parseError);
        return { clinicalPathway: null, rawResponse: result };
      }
    } catch (error) {
      console.error('Error in clinical pathway generation:', error);
      throw error;
    }
  }
}

export default new MedicalScribeService();