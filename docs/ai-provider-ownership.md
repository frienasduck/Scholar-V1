# Scholar AI provider ownership

Scholar routes AI by feature responsibility, not by a generic fallback chain.

| Configuration | Owner |
| --- | --- |
| `GROQ_API_KEY` | All non-LAM Scholar text generation and AISIG prompt enhancement. LAM already used this variable and remains unchanged. |
| `GROQ_MODEL` | Model for migrated Scholar text generation. LAM's existing use remains unchanged. |
| `GROQ_FALLBACK_MODEL` | Existing LAM-only Groq fallback configuration; the migrated Scholar text route does not use it. |
| `GROQ_STT_MODEL` | Existing LAM speech transcription configuration; unchanged. |
| `AISIG_NVIDIA_API_KEY` | AISIG image generation only. |
| `AISIG_NVIDIA_ENDPOINT` | Existing AISIG image-generation endpoint only. |
| `GEMINI_API_KEY` | Gemini image module and optional LAM Live Tutor text provider. |
| `GEMINI_IMAGE_MODEL` | Existing Gemini image model only, where enabled. |
| `GEMINI_TEXT_MODEL` | Optional LAM Live Tutor Gemini model; defaults to `gemini-2.5-flash`. |
| `NVIDIA_TEXT_API_KEY` | Optional LAM Live Tutor NVIDIA text provider. Never reused for AISIG images. |
| `NVIDIA_TEXT_BASE_URL` | Optional NVIDIA OpenAI-compatible chat endpoint for Live Tutor. |
| `NVIDIA_TEXT_MODEL` | Optional NVIDIA Live Tutor text model. |

## Provider policy

- Normal LAM: unchanged on its existing Groq implementation.
- LAM Live Tutor: user-selectable Auto/Groq/Gemini/NVIDIA text routing. Auto chooses only a server-configured provider; an unavailable explicit provider fails visibly and is never simulated.
- AISIG image generation: unchanged.
- AISIG prompt enhancement: Groq through `/api/ai`.
- Every other Scholar text-generation feature: Groq through `/api/ai`.

These legacy NVIDIA variables remain retired and are not read by the application:

- `NVIDIA_API_KEY`
- `NVIDIA_MODEL`
- `NVIDIA_TEXT_TOP_P`
- `NVIDIA_TEXT_REASONING_BUDGET`

Remove retired variables from Vercel only after confirming the deployed build. Do
not remove `AISIG_NVIDIA_API_KEY` or `AISIG_NVIDIA_ENDPOINT`.

## Protected implementation boundaries

- `src/app/api/lam/**` (normal LAM and the additive Live Tutor surface)
- `src/components/lam-widget.tsx`
- `src/components/lam/**`
- `src/lib/lam/**`
- `src/lib/ai/groq.ts` (LAM's existing provider client)
- `src/app/api/ai-image/route.ts`
- `src/lib/ai/nvidia-image.ts`
- `src/lib/ai/gemini-image.ts`

The migrated Scholar client is deliberately separate:
`src/lib/ai/scholar-groq.ts`.
