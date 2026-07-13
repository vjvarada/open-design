import type { Express } from 'express';
import type { RouteDeps } from '../server-context.js';
import { seedProviderIfMissing } from '../media/config.js';
import {
  buildLegacyMaxTokensParam,
  buildMaxCompletionTokensParam,
  buildOpenAIChatTokenParam,
  isUnsupportedMaxTokensError,
} from '../integrations/openai-chat-token-params.js';
import {
  BYOK_SENSEAUDIO_TOOLS,
  BYOK_AIHUBMIX_TOOLS,
  BYOK_PROJECT_FILE_TOOLS,
  executeGenerateImage,
  executeGenerateSpeech,
  executeGenerateVideo,
  executeAIHubMixGenerateImage,
  executeAIHubMixGenerateSpeech,
  executeAIHubMixGenerateVideo,
  executeProjectFileTool,
  isSenseAudioImageModel,
  isAIHubMixImageModel,
  isAIHubMixVideoModel,
  isAIHubMixSpeechModel,
  type BYOKToolContext,
  type ImageToolResult,
  type ProjectFileToolResult,
} from '../byok-tools.js';
import {
  AIHUBMIX_DEFAULT_BASE_URL,
  aihubmixHeaders,
  aihubmixAppCodeHeader,
  aihubmixOriginFromBase,
  classifyAIHubMixModel,
} from '../integrations/aihubmix.js';
import { isSafeId as isSafeProjectId } from '../projects.js';
import { projectKindToTracking } from '@open-design/contracts/analytics';
import { proxyDispatcherRequestInit, validateBaseUrlResolved } from '../connectionTest.js';
import { googleStreamGenerateContentUrl } from '../integrations/google-models.js';
import { createRoleMarkerGuard } from '../role-marker-guard.js';
import { authorizeReasoningEgress, sendReasoningEgressDenial } from '../reasoning-egress.js';

// Allowlist for the `/feedback` route. Mirrors the
// ChatMessageFeedbackReasonCode union in packages/contracts/src/api/chat.ts.
// Kept inline (not imported as a runtime value, since the contract type is
// type-only) so a stale client can't poison Langfuse with unknown categories.
const FEEDBACK_REASON_ALLOWLIST: ReadonlySet<string> = new Set([
  'matched_request',
  'strong_visual',
  'useful_structure',
  'easy_to_continue',
  'followed_design_system',
  'missed_request',
  'weak_visual',
  'incomplete_output',
  'hard_to_use',
  'missed_design_system',
  'other',
]);

export interface RegisterChatRoutesDeps extends RouteDeps<'db' | 'design' | 'http' | 'chat' | 'agents' | 'critique' | 'validation' | 'lifecycle' | 'paths' | 'telemetry'> {}

export function registerChatRoutes(app: Express, ctx: RegisterChatRoutesDeps) {
  const { db, design } = ctx;
  const { sendApiError, createSseResponse } = ctx.http;
  const { testProviderConnection, testAgentConnection, getAgentDef, isKnownModel, sanitizeCustomModel, listProviderModels } = ctx.agents;
  const {
    handleCritiqueArtifact,
    handleCritiqueInterrupt,
    critiqueArtifactsRoot,
    critiqueResponseCapBytes,
    critiqueRunRegistry,
  } = ctx.critique;
  const rejectProxyPluginContext = (body: Record<string, unknown>, res: any) => {
    if (
      (typeof body.pluginId === 'string' && body.pluginId.trim().length > 0) ||
      (
        typeof body.appliedPluginSnapshotId === 'string' &&
        body.appliedPluginSnapshotId.trim().length > 0
      )
    ) {
      sendApiError(
        res,
        409,
        'PLUGIN_REQUIRES_DAEMON',
        'Plugin runs must go through POST /api/runs so the daemon can resolve and pin the applied plugin snapshot.',
      );
      return true;
    }
    return false;
  };

  // Run lifecycle routes live in `routes/runs.ts`; this file owns feedback,
  // connection tests, critique handoff, and provider proxy routes.

  // Receives the user's thumbs-up/down (+ reason codes) for an assistant
  // turn and forwards it to Langfuse as a `score-create`. Web persists the
  // feedback itself via PUT /messages/:id; this endpoint exists only as a
  // telemetry side channel — the daemon is the single network egress for
  // Langfuse and gates on `telemetry.metrics + telemetry.content` consent.
  //
  // The consent + sink decision is fast (awaits a small file read, no
  // network); we await it so the response status honestly reflects whether
  // the score was enqueued, skipped for consent, or skipped because no
  // Langfuse sink is configured. The actual Langfuse network call happens
  // as a detached promise inside the bridge.
  app.post('/api/runs/:id/feedback', async (req, res) => {
    const runId = req.params.id;
    const body = (req.body ?? {}) as Partial<{
      projectId: string;
      conversationId: string;
      assistantMessageId: string;
      rating: 'positive' | 'negative';
      reasonCodes: string[];
      hasCustomReason: boolean;
      customReason: string;
    }>;
    if (!runId) {
      return sendApiError(res, 400, 'INVALID_RUN_ID', 'runId missing');
    }
    if (body.rating !== 'positive' && body.rating !== 'negative') {
      return sendApiError(res, 400, 'INVALID_RATING', 'rating must be positive or negative');
    }
    // Drop anything outside the contract-side reason allowlist and
    // deduplicate; otherwise a malformed or replayed client payload could
    // create unknown Langfuse categories or duplicate score ids in the
    // same batch.
    const reasonCodes = Array.isArray(body.reasonCodes)
      ? Array.from(
          new Set(
            body.reasonCodes.filter(
              (c): c is string =>
                typeof c === 'string' && FEEDBACK_REASON_ALLOWLIST.has(c),
            ),
          ),
        )
      : [];
    const customReason = typeof body.customReason === 'string' ? body.customReason : '';
    const reportFeedback = ctx.telemetry?.reportFeedback;
    if (!reportFeedback) {
      res.status(202).json({ status: 'skipped_no_sink' });
      return;
    }
    // Build score metadata bag that lands in the Langfuse score body.
    // Mirrors the PostHog event so analysts can cross-reference.
    const scoreMetadata: Record<string, unknown> = {
      projectId: body.projectId,
      conversationId: body.conversationId,
      assistantMessageId: body.assistantMessageId,
      hasCustomReason: body.hasCustomReason === true,
      customReason,
    };
    const outcome = await reportFeedback({
      runId,
      rating: body.rating,
      reasonCodes,
      hasCustomReason: body.hasCustomReason === true,
      customReason,
      scoreMetadata,
    });
    res.status(202).json(outcome);
  });

  // ---- Connection tests (single-shot JSON; no SSE) ------------------------
  // Settings dialog uses these to verify a config works without sending a
  // real chat. Always return HTTP 200 with `ok: false` on upstream-caused
  // failures so the web layer can render a categorized inline status without
  // unwrapping nested error envelopes; real 4xx/5xx here mean a malformed
  // request or daemon bug.
  app.post('/api/provider/models', async (req, res) => {
    const controller = new AbortController();
    const abortIfRequestAborted = () => {
      if ((req.aborted || !req.complete) && !res.writableEnded) {
        controller.abort();
      }
    };
    const abortIfResponseClosed = () => {
      if (!res.writableEnded) controller.abort();
    };
    req.on('close', abortIfRequestAborted);
    res.on('close', abortIfResponseClosed);
    const body = req.body || {};
    const protocol = body.protocol;
    if (
      typeof protocol !== 'string' ||
      !['anthropic', 'openai', 'azure', 'google', 'ollama', 'senseaudio', 'aihubmix', 'bedrock'].includes(protocol)
    ) {
      return sendApiError(
        res,
        400,
        'BAD_REQUEST',
        'protocol must be one of anthropic|openai|azure|google|ollama|senseaudio|aihubmix|bedrock',
      );
    }
    // AIHubMix's catalogue (GET /api/v1/models?type=llm) is public, so its
    // model list loads without a key. Every other protocol needs the key to
    // hit its /v1/models endpoint.
    const apiKeyRequired = protocol !== 'aihubmix' && protocol !== 'bedrock';
    if (
      typeof body.baseUrl !== 'string' ||
      typeof body.apiKey !== 'string' ||
      !body.baseUrl.trim() ||
      (apiKeyRequired && !body.apiKey.trim())
    ) {
      return sendApiError(
        res,
        400,
        'BAD_REQUEST',
        apiKeyRequired ? 'baseUrl and apiKey are required' : 'baseUrl is required',
      );
    }
    const reasoningDenial = authorizeReasoningEgress({
      policy: body.reasoningExecution,
      routeKind: 'provider_models',
      provider: protocol,
      resolvedBaseUrl: body.baseUrl,
    });
    if (reasoningDenial) return sendReasoningEgressDenial(res, reasoningDenial);
    try {
      const proxyDispatcher = proxyDispatcherRequestInit();
      try {
        const result = await listProviderModels({
          protocol,
          baseUrl: body.baseUrl,
          apiKey: body.apiKey,
          apiVersion:
            typeof body.apiVersion === 'string' ? body.apiVersion : undefined,
          signal: controller.signal,
          requestInit: proxyDispatcher.requestInit,
        });
        return res.json(result);
      } finally {
        await proxyDispatcher.close();
      }
    } catch (err: any) {
      console.warn(
        `[provider:models] uncaught: ${err instanceof Error ? err.message : String(err)}`,
      );
      return sendApiError(res, 500, 'INTERNAL', 'Provider model discovery failed');
    } finally {
      req.off('close', abortIfRequestAborted);
      res.off('close', abortIfResponseClosed);
    }
  });

  app.post('/api/test/connection', async (req, res) => {
    const controller = new AbortController();
    const abortIfRequestAborted = () => {
      if ((req.aborted || !req.complete) && !res.writableEnded) {
        controller.abort();
      }
    };
    const abortIfResponseClosed = () => {
      if (!res.writableEnded) controller.abort();
    };
    req.on('close', abortIfRequestAborted);
    res.on('close', abortIfResponseClosed);
    const body = req.body || {};
    try {
      if (body.mode === 'provider') {
        const protocol = body.protocol;
        if (
          typeof protocol !== 'string' ||
          !['anthropic', 'openai', 'azure', 'google', 'ollama', 'senseaudio', 'aihubmix', 'bedrock'].includes(protocol)
        ) {
          return sendApiError(
            res,
            400,
            'BAD_REQUEST',
            'protocol must be one of anthropic|openai|azure|google|ollama|senseaudio|aihubmix|bedrock',
          );
        }
        const apiKeyRequired = protocol !== 'bedrock';
        if (
          typeof body.baseUrl !== 'string' ||
          typeof body.apiKey !== 'string' ||
          typeof body.model !== 'string' ||
          !body.baseUrl.trim() ||
          (apiKeyRequired && !body.apiKey.trim()) ||
          !body.model.trim()
        ) {
          return sendApiError(
            res,
            400,
            'BAD_REQUEST',
            apiKeyRequired
              ? 'baseUrl, apiKey, and model are required'
              : 'baseUrl and model are required',
          );
        }
        const reasoningDenial = authorizeReasoningEgress({
          policy: body.reasoningExecution,
          routeKind: 'connection_test',
          provider: protocol,
          resolvedBaseUrl: body.baseUrl,
          model: body.model,
        });
        if (reasoningDenial) return sendReasoningEgressDenial(res, reasoningDenial);
        try {
          const result = await testProviderConnection({
            protocol,
            baseUrl: body.baseUrl,
            apiKey: body.apiKey,
            model: body.model,
            apiVersion:
              typeof body.apiVersion === 'string' ? body.apiVersion : undefined,
            signal: controller.signal,
          });
          return res.json(result);
        } catch (err: any) {
          console.warn(
            `[test:provider] uncaught: ${err instanceof Error ? err.message : String(err)}`,
          );
          return sendApiError(res, 500, 'INTERNAL', 'Connection test failed');
        }
      }

      if (body.mode === 'agent') {
        if (typeof body.agentId !== 'string' || !body.agentId.trim()) {
          return sendApiError(res, 400, 'BAD_REQUEST', 'agentId is required');
        }
        try {
          const def = getAgentDef(body.agentId);
          const testStart = Date.now();
          const safeModel =
            def && typeof body.model === 'string'
              ? isKnownModel(def, body.model)
                ? body.model
                : sanitizeCustomModel(body.model)
              : undefined;
          if (def && typeof body.model === 'string' && body.model.trim() && !safeModel) {
            return res.json({
              ok: false,
              kind: 'invalid_model_id',
              latencyMs: Date.now() - testStart,
              model: body.model.trim(),
              agentName: def.name,
              detail: 'Invalid custom model id. Use a model id that starts with a letter or number and contains no spaces.',
            });
          }
          const safeReasoning =
            def &&
            typeof body.reasoning === 'string' &&
            Array.isArray(def.reasoningOptions)
              ? (def.reasoningOptions.find((r: any) => r.id === body.reasoning)?.id ?? undefined)
              : undefined;
          const result = await testAgentConnection({
            agentId: body.agentId,
            model: safeModel ?? undefined,
            reasoning: safeReasoning,
            agentCliEnv:
              body.agentCliEnv && typeof body.agentCliEnv === 'object'
                ? body.agentCliEnv
                : undefined,
            signal: controller.signal,
          });
          return res.json(result);
        } catch (err: any) {
          console.warn(
            `[test:agent] uncaught: ${err instanceof Error ? err.message : String(err)}`,
          );
          return sendApiError(res, 500, 'INTERNAL', 'Agent test failed');
        }
      }

      return sendApiError(
        res,
        400,
        'BAD_REQUEST',
        'mode must be one of provider|agent',
      );
    } finally {
      req.off('close', abortIfRequestAborted);
      res.off('close', abortIfResponseClosed);
    }
  });

  // ---- Critique Theater endpoints (Phase 6) --------------------------------

  // POST /api/projects/:projectId/critique/:runId/interrupt
  // Cascades an AbortController to the in-flight orchestrator for the given run.
  app.post(
    '/api/projects/:projectId/critique/:runId/interrupt',
    handleCritiqueInterrupt(db, critiqueRunRegistry),
  );

  // GET /api/projects/:projectId/critique/:runId/artifact
  // Streams the SHIP <ARTIFACT> body the orchestrator persisted, with
  // mime derived from the file extension on disk. Cross-project leak
  // guard mirrors the interrupt route. The web layer fetches this as
  // the logical artifact handle so it never sees daemon paths.
  //
  // Response cap is threaded from cfg.parserMaxBlockBytes so a row that
  // the orchestrator + writer accepted is always retrievable.
  app.get(
    '/api/projects/:projectId/critique/:runId/artifact',
    handleCritiqueArtifact(db, {
      artifactsRoot: critiqueArtifactsRoot,
      responseCapBytes: critiqueResponseCapBytes,
    }),
  );

  // ---- API Proxy (SSE) for API-compatible endpoints ------------------------
  // Browser → daemon → external API. Avoids CORS issues with third-party
  // providers. This keeps BYOK setup zero-config for local users at the cost of
  // one local streaming hop through the daemon.

  const redactAuthTokens = (text: string) =>
    text.replace(/Bearer [A-Za-z0-9_\-.+/=]+/g, 'Bearer [REDACTED]');

  // DNS-aware wrapper. The sync `validateBaseUrl` only inspects the literal
  // hostname string, so a public DNS name pointing at an internal address
  // (`internal.example.com → 10.0.0.5`) still passes. We delegate to
  // `validateBaseUrlResolved` here so every proxy/stream handler runs the
  // same resolved-IP check before issuing the upstream request.
  const validateExternalApiBaseUrl = (baseUrl: string) => {
    return validateBaseUrlResolved(baseUrl);
  };

  const proxyErrorCode = (status: number) => {
    if (status === 401) return 'UNAUTHORIZED';
    if (status === 403) return 'FORBIDDEN';
    if (status === 404) return 'NOT_FOUND';
    if (status === 429) return 'RATE_LIMITED';
    return 'UPSTREAM_UNAVAILABLE';
  };

  const sendProxyError = (sse: any, message: string, init: any = {}) => {
    sse.send('error', {
      message,
      error: {
        code: init.code || 'UPSTREAM_UNAVAILABLE',
        message,
        ...(init.details === undefined ? {} : { details: init.details }),
        ...(init.retryable === undefined ? {} : { retryable: init.retryable }),
      },
    });
  };

  const appendVersionedApiPath = (baseUrl: string, path: string) => {
    const url = new URL(baseUrl);
    // `URL.pathname` setter normalizes an empty string back to "/", so
    // we work in a local string to detect the no-path and no-version
    // cases.
    const trimmed = url.pathname.replace(/\/+$/, '');
    // Auto-inject `/v1` whenever the supplied path doesn't already
    // contain a `/vN` segment. This handles all four preset shapes:
    //   bare host                            → /v1/<route>            (api.openai.com, api.anthropic.com)
    //   ends in /vN                          → no inject              (api.openai.com/v1, /v1)
    //   /vN sub-path                         → no inject              (api.deepinfra.com/v1/openai, openrouter.ai/api/v1)
    //   non-versioned compat sub-path        → /v1/<route>            (api.deepseek.com/anthropic, api.minimaxi.com/anthropic)
    // Previously the check was end-of-path only, which broke the
    // /v1/openai sub-path case. A naive "non-empty path → respect"
    // would break the /anthropic sub-path case. Matching `/vN` as a
    // segment anywhere in the path threads both correctly.
    url.pathname = /\/v\d+(\/|$)/.test(trimmed)
      ? `${trimmed}${path}`
      : `${trimmed}/v1${path}`;
    return url.toString();
  };

  const collectSseFrame = (frame: string) => {
    const lines = frame.replace(/\r/g, '').split('\n');
    const dataLines = [];
    let event = 'message';
    for (const line of lines) {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim();
        continue;
      }
      if (!line.startsWith('data:')) continue;
      let value = line.slice(5);
      if (value.startsWith(' ')) value = value.slice(1);
      dataLines.push(value);
    }
    const payload = dataLines.join('\n');
    if (!payload) return { event, payload: '', data: null };
    if (payload === '[DONE]') return { event, payload, data: null };
    try {
      return { event, payload, data: JSON.parse(payload) };
    } catch {
      return { event, payload, data: null };
    }
  };

  const streamUpstreamSse = async (response: any, onFrame: any) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const match = buffer.match(/\r?\n\r?\n/);
        if (!match || match.index === undefined) break;
        const frame = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        if (await onFrame(collectSseFrame(frame))) {
          // Fire-and-forget cancel: awaiting hangs on some response-stream
          // implementations (notably Response built from Uint8Array body,
          // exposed by tests/proxy-routes.test.ts ollama case where the
          // mock body's tee'd cancel() never resolves). The cancel signal
          // is a hint; we're already returning from the function, so we
          // don't gain anything by blocking on it.
          void reader.cancel().catch(() => {});
          return;
        }
      }
    }

    const tail = buffer.trim();
    if (tail) await onFrame(collectSseFrame(tail));
  };

  const streamUpstreamNdjson = async (response: any, onFrame: any) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
        if (!line) continue;
        try {
          const data = JSON.parse(line);
          if (await onFrame({ data })) {
            // See note in streamUpstreamSse — fire-and-forget cancel.
            void reader.cancel().catch(() => {});
            return;
          }
        } catch {
          // Ignore malformed provider keepalive lines.
        }
      }
    }

    const tail = buffer.trim();
    if (tail) {
      try {
        const data = JSON.parse(tail);
        await onFrame({ data });
      } catch {
        // Ignore malformed provider tail data.
      }
    }
  };

  const extractOpenAIText = (data: any) => {
    const choices = data?.choices;
    if (!Array.isArray(choices) || choices.length === 0) return '';
    const first = choices[0];
    if (typeof first?.delta?.content === 'string') return first.delta.content;
    if (typeof first?.text === 'string') return first.text;
    return '';
  };

  const extractStreamErrorMessage = (data: any) => {
    const err = data?.error;
    if (!err) return '';
    if (typeof err === 'string') return err;
    if (typeof err?.message === 'string') return err.message;
    try {
      return JSON.stringify(err);
    } catch {
      return 'unspecified provider error';
    }
  };

  const extractGeminiText = (data: any) => {
    const candidates = data?.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) return '';
    const parts = candidates[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';
    return parts.map((part) => part?.text).filter((text) => typeof text === 'string').join('');
  };

  const benignGeminiFinishReasons = new Set(['', 'STOP', 'MAX_TOKENS', 'FINISH_REASON_UNSPECIFIED']);
  const extractGeminiBlockMessage = (data: any) => {
    const feedback = data?.promptFeedback;
    if (typeof feedback?.blockReason === 'string' && feedback.blockReason) {
      const tail = typeof feedback.blockReasonMessage === 'string' && feedback.blockReasonMessage
        ? ` — ${feedback.blockReasonMessage}`
        : '';
      return `Gemini blocked the prompt (${feedback.blockReason})${tail}.`;
    }
    const candidates = data?.candidates;
    if (!Array.isArray(candidates)) return '';
    for (const candidate of candidates) {
      const reason = candidate?.finishReason;
      if (typeof reason !== 'string' || benignGeminiFinishReasons.has(reason)) continue;
      const tail = typeof candidate?.finishMessage === 'string' && candidate.finishMessage
        ? ` — ${candidate.finishMessage}`
        : '';
      return `Gemini stopped the response (${reason})${tail}.`;
    }
    return '';
  };

  // Per-request role-marker guard for BYOK proxy streams (#3247).
  function createDeltaGuard(sse: any) {
    const guard = createRoleMarkerGuard('proxy');
    return {
      sendDelta(text: string) {
        if (guard.contaminated || !text) return;
        const safe = guard.feedText(text);
        if (safe.length > 0) {
          sse.send('delta', { delta: safe });
        }
        if (guard.contaminated) {
          const warn = guard.warningEvent();
          const markerText = warn?.marker ?? '## user';
          sse.send('delta', {
            delta: `\n\n---\n⚠️ **Security warning:** The model attempted to emit a fabricated role marker (\`${markerText}\`). Response was truncated to prevent unauthorized instruction injection. See issue #3247.\n`,
          });
        }
      },
      get contaminated() { 
        return guard.contaminated; 
      },
    };
  }

  // ---- Reusable base-chat streamers (text only — no tool loop) -------------
  // Both the native /api/proxy/{anthropic,google}/stream routes AND the
  // AIHubMix model-routed proxy call these. Only the resolved url + headers
  // differ (AIHubMix adds the APP-Code header and a different origin), so the
  // wire/SSE handling lives here once. The OpenAI tool loop stays in
  // registerByokToolChatProxy.

  // Anthropic prompt caching. The composed OD system prompt is large (~10k-30k
  // tokens with an active design system) and byte-identical across every turn of
  // a session, yet without a breakpoint it is re-billed as fresh input each turn.
  // A single `cache_control` breakpoint on the system block caches the whole
  // static prefix — Anthropic caches in `tools -> system -> messages` order, so
  // marking `system` also caches the tool definitions in front of it. Blocks
  // shorter than the model minimum (1024 tokens; 2048 on Haiku) are silently not
  // cached, so this is safe to apply unconditionally. Caching is GA, so no
  // `anthropic-beta` header is required.
  const ANTHROPIC_CACHE_CONTROL = { type: 'ephemeral' as const };

  // Incremental conversation caching. A `cache_control` breakpoint on the LAST
  // message caches the whole prefix up to and including it; on the NEXT turn
  // (when this message has become part of the stable history) that prefix is
  // read from cache instead of re-billed. Combined with the system/tools
  // breakpoints, this caches the growing conversation body — including any
  // attached project file, which the web client now inlines once at a stable
  // position rather than re-sending on the newest message each turn. Anthropic
  // allows up to 4 breakpoints; we use at most 3 (tools + system + last msg).
  // The array/string content split keeps the BYOK tool loop (whose messages
  // carry tool_use / tool_result blocks) intact.
  const withTrailingMessageCacheBreakpoint = (messages: any[]): any[] => {
    if (messages.length === 0) return messages;
    const out = messages.slice();
    const last = out[out.length - 1];
    if (!last || typeof last !== 'object') return messages;
    const content = last.content;
    if (typeof content === 'string') {
      out[out.length - 1] = {
        ...last,
        content: [{ type: 'text', text: content, cache_control: ANTHROPIC_CACHE_CONTROL }],
      };
    } else if (Array.isArray(content) && content.length > 0) {
      const blocks = content.slice();
      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock && typeof lastBlock === 'object') {
        blocks[blocks.length - 1] = { ...lastBlock, cache_control: ANTHROPIC_CACHE_CONTROL };
        out[out.length - 1] = { ...last, content: blocks };
      }
    }
    return out;
  };

  const buildAnthropicChatPayload = (
    model: string,
    systemPrompt: unknown,
    messages: unknown,
    maxTokens: unknown,
  ) => {
    const payload: any = {
      model,
      max_tokens:
        typeof maxTokens === 'number' && maxTokens > 0 ? maxTokens : 8192,
      messages: withTrailingMessageCacheBreakpoint(Array.isArray(messages) ? messages : []),
      stream: true,
    };
    if (typeof systemPrompt === 'string' && systemPrompt) {
      payload.system = [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: ANTHROPIC_CACHE_CONTROL,
        },
      ];
    }
    return payload;
  };

  const runAnthropicChatStream = async (
    res: any,
    opts: { url: string; headers: Record<string, string>; payload: any; logTag: string },
  ) => {
    const sse = createSseResponse(res);
    let proxyDispatcher: ReturnType<typeof proxyDispatcherRequestInit> | null = null;
    try {
      proxyDispatcher = proxyDispatcherRequestInit();
      sse.send('start', { model: opts.payload?.model });
      const response = await fetch(opts.url, {
        ...proxyDispatcher.requestInit,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...opts.headers },
        body: JSON.stringify(opts.payload),
        redirect: 'error',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[${opts.logTag}] upstream error: ${response.status} ${redactAuthTokens(errorText)}`,
        );
        sendProxyError(sse, `Upstream error: ${response.status}`, {
          code: proxyErrorCode(response.status),
          details: errorText,
          retryable: response.status === 429 || response.status >= 500,
        });
        return sse.end();
      }

      let ended = false;
      const guard = createDeltaGuard(sse);
      await streamUpstreamSse(response, ({ event, data }: any) => {
        if (!data) return false;
        if (event === 'error' || data.type === 'error') {
          const message = data.error?.message || data.message || 'Anthropic upstream error';
          sendProxyError(sse, message, { details: data });
          ended = true;
          return true;
        }
        if (event === 'content_block_delta' && typeof data.delta?.text === 'string') {
          guard.sendDelta(data.delta.text);
          if (guard.contaminated) {
            sse.send('end', {});
            ended = true;
            return true;
          }
        }
        if (event === 'message_stop') {
          sse.send('end', {});
          ended = true;
          return true;
        }
        return false;
      });
      if (!ended) sse.send('end', {});
      sse.end();
    } catch (err: any) {
      console.error(`[${opts.logTag}] internal error: ${err.message}`);
      sendProxyError(sse, err.message, { code: 'INTERNAL_ERROR' });
      sse.end();
    } finally {
      await proxyDispatcher?.close();
    }
  };

  const buildGeminiChatPayload = (
    systemPrompt: unknown,
    messages: unknown,
    maxTokens: unknown,
  ) => {
    const contents = (Array.isArray(messages) ? messages : []).map((message: any) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }));
    const payload: any = {
      contents,
      generationConfig: {
        maxOutputTokens:
          typeof maxTokens === 'number' && maxTokens > 0 ? maxTokens : 8192,
      },
    };
    if (typeof systemPrompt === 'string' && systemPrompt) {
      payload.systemInstruction = { parts: [{ text: systemPrompt }] };
    }
    return payload;
  };

  const runGeminiChatStream = async (
    res: any,
    opts: { url: string; headers: Record<string, string>; payload: any; model: string; logTag: string },
  ) => {
    const sse = createSseResponse(res);
    let proxyDispatcher: ReturnType<typeof proxyDispatcherRequestInit> | null = null;
    try {
      proxyDispatcher = proxyDispatcherRequestInit();
      sse.send('start', { model: opts.model });
      const response = await fetch(opts.url, {
        ...proxyDispatcher.requestInit,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...opts.headers },
        body: JSON.stringify(opts.payload),
        redirect: 'error',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[${opts.logTag}] upstream error: ${response.status} ${redactAuthTokens(errorText)}`,
        );
        sendProxyError(sse, `Upstream error: ${response.status}`, {
          code: proxyErrorCode(response.status),
          details: errorText,
          retryable: response.status === 429 || response.status >= 500,
        });
        return sse.end();
      }

      let ended = false;
      const guard = createDeltaGuard(sse);
      await streamUpstreamSse(response, ({ data }: any) => {
        if (!data) return false;
        const streamError = extractStreamErrorMessage(data);
        if (streamError) {
          sendProxyError(sse, `Gemini error: ${streamError}`, { details: data });
          ended = true;
          return true;
        }
        const delta = extractGeminiText(data);
        if (delta) {
          guard.sendDelta(delta);
          if (guard.contaminated) {
            sse.send('end', {});
            ended = true;
            return true;
          }
        }
        const blockMessage = extractGeminiBlockMessage(data);
        if (blockMessage) {
          sendProxyError(sse, blockMessage, { details: data });
          ended = true;
          return true;
        }
        return false;
      });
      if (!ended) sse.send('end', {});
      sse.end();
    } catch (err: any) {
      console.error(`[${opts.logTag}] internal error: ${err.message}`);
      sendProxyError(sse, err.message, { code: 'INTERNAL_ERROR' });
      sse.end();
    } finally {
      await proxyDispatcher?.close();
    }
  };

  // ---- Shared media tool-loop helpers (BYOK aihubmix only) ----------------
  // The daemon authors ONE OpenAI-shaped tool array (BYOK_AIHUBMIX_TOOLS) and
  // ONE tool-result content vocabulary. These helpers adapt both to the
  // Anthropic Messages and Gemini generateContent native wires so an aihubmix
  // claude/gemini chat model gets the same in-chat generate_image/video/speech
  // tools the OpenAI family already has. They are pure (no request state), so
  // they live at registerChatRoutes scope and are reused across requests.

  // Tool-result content fed back to the model after a media tool runs. Same
  // hints across all three wire protocols (OpenAI `tool` role, Anthropic
  // `tool_result` block, Gemini `functionResponse`): tell the model the URL
  // and exactly how to embed it (markdown image for PNG, link for MP4/MP3).
  const buildToolResultContent = (result: {
    ok: boolean;
    url?: string;
    error?: string;
    kind?: 'image' | 'video' | 'speech' | 'file';
    content?: string;
    files?: string[];
  }): string => {
    if (result.ok) {
      if (result.kind === 'video')
        return `Video generated successfully. URL: ${result.url}. Reply to the user with a clickable markdown link, e.g. [▶ Play video](${result.url}). Do NOT use markdown image syntax — the chat renderer does not embed <video> tags.`;
      if (result.kind === 'speech')
        return `Speech generated successfully. URL: ${result.url}. Reply to the user with a clickable markdown link to the MP3, e.g. [▶ Play voiceover](${result.url}).`;
      if (result.kind === 'file') {
        if (result.content !== undefined) {
          return `File read successfully. Content:\n\n${result.content}`;
        }
        if (Array.isArray(result.files)) {
          return `Files listed successfully:\n${result.files.map((f) => `- ${f}`).join('\n')}`;
        }
        return `File operation succeeded. URL: ${result.url || '(written)'}`;
      }
      return `Image generated successfully. URL: ${result.url}. Reply to the user with: ![generated image](${result.url})`;
    }
    if (result.kind === 'video')
      return `Video generation failed: ${result.error}. Apologize briefly and suggest a retry with a more specific prompt or a shorter duration.`;
    if (result.kind === 'speech')
      return `Speech generation failed: ${result.error}. Apologize briefly and suggest a retry with a shorter script or a valid voice id.`;
    if (result.kind === 'file')
      return `File operation failed: ${result.error}. Read the file first to get current content, then retry with the correct parameters.`;
    return `Image generation failed: ${result.error}. Apologize briefly and suggest a retry with a more specific prompt.`;
  };

  // OpenAI tool definition → Anthropic Messages `tools` shape. Anthropic calls
  // the JSON-schema slot `input_schema` (OpenAI calls it `parameters`).
  // A `cache_control` breakpoint on the final tool caches the whole (static)
  // tool-definition block so it is not re-billed each turn, independent of the
  // system-prompt breakpoint. See ANTHROPIC_CACHE_CONTROL above.
  const openaiToolsToAnthropic = (tools: any[]): any[] => {
    const mapped: any[] = (Array.isArray(tools) ? tools : []).map((t: any) => ({
      name: t?.function?.name,
      description: t?.function?.description,
      input_schema: t?.function?.parameters ?? { type: 'object', properties: {} },
    }));
    if (mapped.length > 0) {
      mapped[mapped.length - 1] = {
        ...mapped[mapped.length - 1],
        cache_control: ANTHROPIC_CACHE_CONTROL,
      };
    }
    return mapped;
  };

  // Gemini's functionDeclaration `parameters` is an OpenAPI-subset Schema that
  // rejects JSON-schema extras (additionalProperties, $schema, default, …). We
  // strip everything outside the allowed key set recursively so the passthrough
  // to Google does not 400 on an unknown field.
  const GEMINI_SCHEMA_KEYS = new Set([
    'type',
    'format',
    'description',
    'nullable',
    'enum',
    'items',
    'properties',
    'required',
  ]);
  const sanitizeGeminiSchema = (schema: any): any => {
    if (!schema || typeof schema !== 'object') return { type: 'object', properties: {} };
    const out: any = {};
    for (const [k, v] of Object.entries(schema)) {
      if (!GEMINI_SCHEMA_KEYS.has(k)) continue;
      if (k === 'properties' && v && typeof v === 'object') {
        out.properties = {};
        for (const [pk, pv] of Object.entries(v as any)) {
          out.properties[pk] = sanitizeGeminiSchema(pv);
        }
      } else if (k === 'items') {
        out.items = sanitizeGeminiSchema(v);
      } else {
        out[k] = v;
      }
    }
    if (!out.type) out.type = 'object';
    return out;
  };

  // OpenAI tool definitions → Gemini `tools:[{functionDeclarations:[…]}]`.
  const openaiToolsToGemini = (tools: any[]): any[] => [
    {
      functionDeclarations: (Array.isArray(tools) ? tools : []).map((t: any) => ({
        name: t?.function?.name,
        description: t?.function?.description,
        parameters: sanitizeGeminiSchema(t?.function?.parameters),
      })),
    },
  ];

  app.post('/api/proxy/anthropic/stream', async (req, res) => {
    /** @type {Partial<ProxyStreamRequest>} */
    const proxyBody = req.body || {};
    if (rejectProxyPluginContext(proxyBody, res)) return;
    const { baseUrl, apiKey, model, systemPrompt, messages, maxTokens, projectId } =
      proxyBody;
    if (!baseUrl || !apiKey || !model) {
      return sendApiError(
        res,
        400,
        'BAD_REQUEST',
        'baseUrl, apiKey, and model are required',
      );
    }

    const validated = await validateExternalApiBaseUrl(baseUrl);
    if (validated.error) {
      return sendApiError(
        res,
        validated.forbidden ? 403 : 400,
        validated.forbidden ? 'FORBIDDEN' : 'BAD_REQUEST',
        validated.error,
      );
    }
    const reasoningDenial = authorizeReasoningEgress({
      policy: proxyBody.reasoningExecution,
      routeKind: 'proxy',
      provider: 'anthropic',
      resolvedBaseUrl: baseUrl,
      model,
    });
    if (reasoningDenial) return sendReasoningEgressDenial(res, reasoningDenial);

    const url = appendVersionedApiPath(baseUrl, '/messages');
    const hasProjectTools = typeof projectId === 'string' && projectId.trim().length > 0 && isSafeProjectId(projectId);
    console.log(
      `[proxy:anthropic] ${req.method} ${validated.parsed!.hostname} model=${model} project=${hasProjectTools ? projectId : 'none'} tools=${hasProjectTools ? 'file' : 'off'}`,
    );

    // When a projectId is present, enable the tool loop with project file tools
    // so the BYOK agent can read/write/edit/list project files.
    if (hasProjectTools) {
      const anthropicUrl = url;
      const anthropicHeaders = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
      const projectTools = BYOK_PROJECT_FILE_TOOLS;
      const anthropicTools = openaiToolsToAnthropic(projectTools);

      // Build tool context for project file operations
      const fileToolCtx: BYOKToolContext = {
        projectRoot: ctx.paths.PROJECT_ROOT,
        projectsRoot: ctx.paths.PROJECTS_DIR,
        projectId: projectId!,
        upstreamApiKey: apiKey,
        upstreamBaseUrl: baseUrl,
        requestInit: {},
      };

      let proxyDispatcher: ReturnType<typeof proxyDispatcherRequestInit> | null = null;
      const sse = createSseResponse(res);
      try {
        proxyDispatcher = proxyDispatcherRequestInit();
        fileToolCtx.requestInit = proxyDispatcher.requestInit;
        sse.send('start', { model });

        const anthMessages: any[] = Array.isArray(messages) ? [...messages] : [];
        if (typeof systemPrompt === 'string' && systemPrompt) {
          // System prompt goes in the top-level `system` field, not in messages
        }

        for (let loop = 0; loop < MAX_BYOK_TOOL_LOOPS; loop++) {
          const payload: any = {
            ...buildAnthropicChatPayload(model, systemPrompt, anthMessages, maxTokens),
            tools: anthropicTools,
            tool_choice: { type: 'auto' },
          };
          const response = await fetch(anthropicUrl, {
            ...fileToolCtx.requestInit,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...anthropicHeaders },
            body: JSON.stringify(payload),
            redirect: 'error',
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(
              `[proxy:anthropic] upstream error: ${response.status} ${redactAuthTokens(errorText)}`,
            );
            sendProxyError(sse, `Upstream error: ${response.status}`, {
              code: proxyErrorCode(response.status),
              details: errorText,
              retryable: response.status === 429 || response.status >= 500,
            });
            return sse.end();
          }

          const blocks: Record<number, { type: string; id?: string; name?: string; json: string }> = {};
          let stopReason = '';
          let providerError = '';
          const guard = createDeltaGuard(sse);
          await streamUpstreamSse(response, ({ event, data }: any) => {
            if (!data) return false;
            if (event === 'error' || data.type === 'error') {
              providerError = data.error?.message || data.message || 'Anthropic upstream error';
              return true;
            }
            if (event === 'content_block_start') {
              const idx = typeof data.index === 'number' ? data.index : 0;
              const cb = data.content_block || {};
              blocks[idx] = { type: cb.type || 'text', id: cb.id, name: cb.name, json: '' };
            } else if (event === 'content_block_delta') {
              const idx = typeof data.index === 'number' ? data.index : 0;
              const d = data.delta || {};
              if (d.type === 'text_delta' && typeof d.text === 'string') {
                guard.sendDelta(d.text);
                if (guard.contaminated) {
                  sse.send('end', {});
                  return true;
                }
              } else if (d.type === 'input_json_delta' && typeof d.partial_json === 'string') {
                if (!blocks[idx]) blocks[idx] = { type: 'tool_use', json: '' };
                blocks[idx]!.json += d.partial_json;
              }
            }
            if (event === 'message_delta') {
              const d = data.delta || {};
              if (typeof d.stop_reason === 'string' && d.stop_reason) {
                stopReason = d.stop_reason;
              }
            }
            return false;
          });

          if (providerError) {
            sendProxyError(sse, `Provider error: ${providerError}`, { details: providerError });
            return sse.end();
          }

          // Collect tool_use blocks
          const toolUseBlocks = Object.values(blocks).filter(
            (b) => b.type === 'tool_use' && b.name && b.json,
          );

          if (stopReason === 'end_turn' || (stopReason !== 'tool_use' && toolUseBlocks.length === 0)) {
            sse.send('end', {});
            return sse.end();
          }

          if (stopReason === 'tool_use' && toolUseBlocks.length > 0) {
            // Build assistant message with tool_use content blocks
            const assistantContent: any[] = [];
            const toolResults: any[] = [];
            for (const [idx, block] of Object.entries(blocks)) {
              if (block.type === 'text' && block.json) {
                // text blocks had their content streamed already
              } else if (block.type === 'tool_use' && block.name && block.json) {
                assistantContent.push({
                  type: 'tool_use',
                  id: block.id || `toolu_${idx}`,
                  name: block.name,
                  input: JSON.parse(block.json || '{}'),
                });
                // Execute the tool
                const toolCall = {
                  id: block.id || `toolu_${idx}`,
                  function: { name: block.name, arguments: block.json },
                };
                const result = await executeProjectFileTool(toolCall, fileToolCtx);
                const resultContent = buildToolResultContent({ ...result, kind: 'file' });
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id || `toolu_${idx}`,
                  content: resultContent,
                });
              }
            }
            // Append assistant + tool results to messages
            anthMessages.push({ role: 'assistant', content: assistantContent });
            anthMessages.push({ role: 'user', content: toolResults });
            continue; // loop for next turn
          }

          sse.send('end', {});
          return sse.end();
        }
        console.warn(
          `[proxy:anthropic] tool loop bounded at MAX_BYOK_TOOL_LOOPS=${MAX_BYOK_TOOL_LOOPS}`,
        );
        sse.send('end', {});
        return sse.end();
      } catch (err: any) {
        console.error(`[proxy:anthropic] internal error: ${err.message}`);
        sendProxyError(sse, err.message, { code: 'INTERNAL_ERROR' });
        sse.end();
      } finally {
        await proxyDispatcher?.close();
      }
      return;
    }

    // No projectId — use the existing text-only stream
    return runAnthropicChatStream(res, {
      url,
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      payload: buildAnthropicChatPayload(model, systemPrompt, messages, maxTokens),
      logTag: 'proxy:anthropic',
    });
  });

  app.post('/api/proxy/openai/stream', async (req, res) => {
    /** @type {Partial<ProxyStreamRequest>} */
    const proxyBody = req.body || {};
    if (rejectProxyPluginContext(proxyBody, res)) return;
    const { baseUrl, apiKey, model, systemPrompt, messages, maxTokens } =
      proxyBody;
    if (!baseUrl || !apiKey || !model) {
      return sendApiError(
        res,
        400,
        'BAD_REQUEST',
        'baseUrl, apiKey, and model are required',
      );
    }

    const validated = await validateExternalApiBaseUrl(baseUrl);
    if (validated.error) {
      return sendApiError(
        res,
        validated.forbidden ? 403 : 400,
        validated.forbidden ? 'FORBIDDEN' : 'BAD_REQUEST',
        validated.error,
      );
    }
    const reasoningDenial = authorizeReasoningEgress({
      policy: proxyBody.reasoningExecution,
      routeKind: 'proxy',
      provider: 'openai',
      resolvedBaseUrl: baseUrl,
      model,
    });
    if (reasoningDenial) return sendReasoningEgressDenial(res, reasoningDenial);

    const url = appendVersionedApiPath(baseUrl, '/chat/completions');
    console.log(
      `[proxy:openai] ${req.method} ${validated.parsed!.hostname} model=${model}`,
    );

    const payloadMessages = Array.isArray(messages) ? [...messages] : [];
    if (typeof systemPrompt === 'string' && systemPrompt) {
      payloadMessages.unshift({ role: 'system', content: systemPrompt });
    }

    const payload: any = {
      model,
      messages: payloadMessages,
      ...buildOpenAIChatTokenParam(
        model,
        typeof maxTokens === 'number' && maxTokens > 0 ? maxTokens : 8192,
      ),
      stream: true,
    };

    const sse = createSseResponse(res);
    let proxyDispatcher: ReturnType<typeof proxyDispatcherRequestInit> | null = null;
    try {
      proxyDispatcher = proxyDispatcherRequestInit();
      sse.send('start', { model });
      const response = await fetch(url, {
        ...proxyDispatcher.requestInit,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          ...(validated.parsed!.hostname === 'openrouter.ai' ? {
            'HTTP-Referer': 'https://opendesign.dev',
            'X-Title': 'Open Design',
          } : {}),
        },
        body: JSON.stringify(payload),
        redirect: 'error',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[proxy:openai] upstream error: ${response.status} ${redactAuthTokens(errorText)}`,
        );
        sendProxyError(sse, `Upstream error: ${response.status}`, {
          code: proxyErrorCode(response.status),
          details: errorText,
          retryable: response.status === 429 || response.status >= 500,
        });
        return sse.end();
      }

      let ended = false;
      const guard = createDeltaGuard(sse);
      await streamUpstreamSse(response, ({ payload, data }: any) => {
        if (payload === '[DONE]') {
          sse.send('end', {});
          ended = true;
          return true;
        }
        if (!data) return false;
        const streamError = extractStreamErrorMessage(data);
        if (streamError) {
          sendProxyError(sse, `Provider error: ${streamError}`, { details: data });
          ended = true;
          return true;
        }
        const delta = extractOpenAIText(data);
        if (delta) { 
          guard.sendDelta(delta); 
          if (guard.contaminated) { 
            sse.send('end', {}); 
            ended = true; 
            return true; 
          } 
        }
        return false;
      });
      if (!ended) sse.send('end', {});
      sse.end();
    } catch (err: any) {
      console.error(`[proxy:openai] internal error: ${err.message}`);
      sendProxyError(sse, err.message, { code: 'INTERNAL_ERROR' });
      sse.end();
    } finally {
      await proxyDispatcher?.close();
    }
  });

  app.post('/api/proxy/azure/stream', async (req, res) => {
    /** @type {Partial<ProxyStreamRequest>} */
    const proxyBody = req.body || {};
    if (rejectProxyPluginContext(proxyBody, res)) return;
    const { baseUrl, apiKey, model, systemPrompt, messages, maxTokens, apiVersion } =
      proxyBody;
    if (!baseUrl || !apiKey || !model) {
      return sendApiError(
        res,
        400,
        'BAD_REQUEST',
        'baseUrl, apiKey, and model are required',
      );
    }

    const validated = await validateExternalApiBaseUrl(baseUrl);
    if (validated.error) {
      return sendApiError(
        res,
        validated.forbidden ? 403 : 400,
        validated.forbidden ? 'FORBIDDEN' : 'BAD_REQUEST',
        validated.error,
      );
    }
    const reasoningDenial = authorizeReasoningEgress({
      policy: proxyBody.reasoningExecution,
      routeKind: 'proxy',
      provider: 'azure',
      resolvedBaseUrl: baseUrl,
      model,
    });
    if (reasoningDenial) return sendReasoningEgressDenial(res, reasoningDenial);

    const url = new URL(baseUrl);
    const basePath = url.pathname.replace(/\/+$/, '');
    const usesVersionedOpenAIPath = /\/openai\/v\d+(?:$|\/)/.test(basePath);
    const version =
      typeof apiVersion === 'string' && apiVersion.trim()
        ? apiVersion.trim()
        : usesVersionedOpenAIPath
          ? ''
          : '2024-10-21';
    url.pathname = usesVersionedOpenAIPath
      ? `${basePath}/chat/completions`
      : `${basePath}/openai/deployments/${encodeURIComponent(model)}/chat/completions`;
    if (usesVersionedOpenAIPath && !version) {
      url.searchParams.delete('api-version');
    }
    if (version) {
      url.searchParams.set('api-version', version);
    }
    console.log(
      `[proxy:azure] ${req.method} ${validated.parsed!.hostname} deployment=${model} api-version=${version || 'omitted'}`,
    );

    const payloadMessages = Array.isArray(messages) ? [...messages] : [];
    if (typeof systemPrompt === 'string' && systemPrompt) {
      payloadMessages.unshift({ role: 'system', content: systemPrompt });
    }

    const effectiveMaxTokens =
      typeof maxTokens === 'number' && maxTokens > 0 ? maxTokens : 8192;
    const payload = {
      ...(usesVersionedOpenAIPath ? { model } : {}),
      messages: payloadMessages,
      ...buildLegacyMaxTokensParam(effectiveMaxTokens),
      stream: true,
    };
    const retryPayload = {
      ...(usesVersionedOpenAIPath ? { model } : {}),
      messages: payloadMessages,
      ...buildMaxCompletionTokensParam(effectiveMaxTokens),
      stream: true,
    };

    const sse = createSseResponse(res);
    let proxyDispatcher: ReturnType<typeof proxyDispatcherRequestInit> | null = null;
    try {
      proxyDispatcher = proxyDispatcherRequestInit();
      sse.send('start', { model });
      const requestInit = {
        ...proxyDispatcher.requestInit,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        redirect: 'error' as const,
      };
      let response = await fetch(url, {
        ...requestInit,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorText = await response.text();
        if (
          response.status === 400 &&
          isUnsupportedMaxTokensError(errorText)
        ) {
          console.warn(
            `[proxy:azure] retrying request with max_completion_tokens deployment=${model}`,
          );
          response = await fetch(url, {
            ...requestInit,
            body: JSON.stringify(retryPayload),
          });
          if (response.ok) {
            errorText = '';
          } else {
            errorText = await response.text();
          }
        }
        if (!response.ok) {
          console.error(
            `[proxy:azure] upstream error: ${response.status} ${redactAuthTokens(errorText)}`,
          );
          sendProxyError(sse, `Upstream error: ${response.status}`, {
            code: proxyErrorCode(response.status),
            details: errorText,
            retryable: response.status === 429 || response.status >= 500,
          });
          return sse.end();
        }
      }

      let ended = false;
      const guard = createDeltaGuard(sse);
      await streamUpstreamSse(response, ({ payload: ssePayload, data }: any) => {
        if (ssePayload === '[DONE]') {
          sse.send('end', {});
          ended = true;
          return true;
        }
        if (!data) return false;
        const streamError = extractStreamErrorMessage(data);
        if (streamError) {
          sendProxyError(sse, `Azure error: ${streamError}`, { details: data });
          ended = true;
          return true;
        }
        const delta = extractOpenAIText(data);
        if (delta) { guard.sendDelta(delta); 
          if (guard.contaminated) { 
            sse.send('end', {}); 
            ended = true; 
            return true; 
          } 
        }
        return false;
      });
      if (!ended) sse.send('end', {});
      sse.end();
    } catch (err: any) {
      console.error(`[proxy:azure] internal error: ${err.message}`);
      sendProxyError(sse, err.message, { code: 'INTERNAL_ERROR' });
      sse.end();
    } finally {
      await proxyDispatcher?.close();
    }
  });

  app.post('/api/proxy/google/stream', async (req, res) => {
    /** @type {Partial<ProxyStreamRequest>} */
    const proxyBody = req.body || {};
    if (rejectProxyPluginContext(proxyBody, res)) return;
    const { baseUrl, apiKey, model, systemPrompt, messages, maxTokens } = proxyBody;
    if (!apiKey || !model) {
      return sendApiError(
        res,
        400,
        'BAD_REQUEST',
        'apiKey and model are required',
      );
    }

    const effectiveBaseUrl = baseUrl || 'https://generativelanguage.googleapis.com';
    const validated = await validateExternalApiBaseUrl(effectiveBaseUrl);
    if (validated.error) {
      return sendApiError(
        res,
        validated.forbidden ? 403 : 400,
        validated.forbidden ? 'FORBIDDEN' : 'BAD_REQUEST',
        validated.error,
      );
    }
    const reasoningDenial = authorizeReasoningEgress({
      policy: proxyBody.reasoningExecution,
      routeKind: 'proxy',
      provider: 'google',
      resolvedBaseUrl: effectiveBaseUrl,
      model,
    });
    if (reasoningDenial) return sendReasoningEgressDenial(res, reasoningDenial);

    const url = googleStreamGenerateContentUrl(effectiveBaseUrl, model);
    console.log(
      `[proxy:google] ${req.method} ${validated.parsed!.hostname} model=${model}`,
    );

    return runGeminiChatStream(res, {
      url,
      headers: { 'x-goog-api-key': apiKey },
      payload: buildGeminiChatPayload(systemPrompt, messages, maxTokens),
      model,
      logTag: 'proxy:google',
    });
  });

  app.post('/api/proxy/ollama/stream', async (req, res) => {
    const proxyBody = req.body || {};
    if (rejectProxyPluginContext(proxyBody, res)) return;
    const { baseUrl, apiKey, model, systemPrompt, messages, maxTokens } = proxyBody;
    if (!apiKey || !model) {
      return sendApiError(res, 400, 'BAD_REQUEST', 'apiKey and model are required');
    }

    const effectiveBaseUrl = baseUrl || 'https://ollama.com';
    const validated = await validateExternalApiBaseUrl(effectiveBaseUrl);
    if (validated.error) {
      return sendApiError(
        res,
        validated.forbidden ? 403 : 400,
        validated.forbidden ? 'FORBIDDEN' : 'BAD_REQUEST',
        validated.error,
      );
    }
    const reasoningDenial = authorizeReasoningEgress({
      policy: proxyBody.reasoningExecution,
      routeKind: 'proxy',
      provider: 'ollama',
      resolvedBaseUrl: effectiveBaseUrl,
      model,
    });
    if (reasoningDenial) return sendReasoningEgressDenial(res, reasoningDenial);

    const clean = effectiveBaseUrl.replace(/\/+$/, '').replace(/\/api\/?$/, '');
    const url = `${clean}/api/chat`;
    console.log(`[proxy:ollama] ${req.method} ${validated.parsed!.hostname} model=${model}`);

    const payloadMessages = Array.isArray(messages) ? [...messages] : [];
    if (typeof systemPrompt === 'string' && systemPrompt) {
      payloadMessages.unshift({ role: 'system', content: systemPrompt });
    }

    const payload: any = { model, messages: payloadMessages, stream: true };
    if (typeof maxTokens === 'number' && maxTokens > 0) {
      payload.options = { num_predict: maxTokens };
    }

    const sse = createSseResponse(res);
    let proxyDispatcher: ReturnType<typeof proxyDispatcherRequestInit> | null = null;
    try {
      proxyDispatcher = proxyDispatcherRequestInit();
      sse.send('start', { model });
      const response = await fetch(url, {
        ...proxyDispatcher.requestInit,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(payload),
        redirect: 'error',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[proxy:ollama] upstream error: ${response.status} ${redactAuthTokens(errorText)}`);
        sendProxyError(sse, `Upstream error: ${response.status}`, {
          code: proxyErrorCode(response.status),
          details: errorText,
          retryable: response.status === 429 || response.status >= 500,
        });
        return sse.end();
      }

      let ended = false;
      const guard = createDeltaGuard(sse);
      await streamUpstreamNdjson(response, ({ data }: any) => {
        if (!data) return false;
        if (data.done) {
          sse.send('end', {});
          ended = true;
          return true;
        }
        const content = data.message?.content;
        if (typeof content === 'string' && content) { 
          guard.sendDelta(content); 
          if (guard.contaminated) { 
            sse.send('end', {}); 
            ended = true; 
            return true; 
          } 
        }
        return false;
      });
      if (!ended) sse.send('end', {});
      sse.end();
    } catch (err: any) {
      console.error(`[proxy:ollama] internal error: ${err.message}`);
      sendProxyError(sse, err.message, { code: 'INTERNAL_ERROR' });
      sse.end();
    } finally {
      await proxyDispatcher?.close();
    }
  });

  // SenseAudio chat completions. Wire-compatible with OpenAI (POST
  // /v1/chat/completions, Bearer auth, SSE `data: {...}` + `data: [DONE]`)
  // plus a daemon-side tool loop: the handler injects an OpenAI
  // `tools` array on every upstream request and, when the model
  // responds with a `tool_calls` finish_reason, executes the call
  // locally, appends the assistant + tool messages to the conversation,
  // and re-issues the completion. This is how BYOK chat — which has
  // no agent-runtime scaffolding — gets image-generation parity with
  // the CLI agent path. Loop is bounded by MAX_BYOK_TOOL_LOOPS so a
  // misbehaving model can't pin the daemon in an infinite tool dance.
  const MAX_BYOK_TOOL_LOOPS = 3;

  type AccumulatedToolCall = { id: string; name: string; arguments: string };
  type TurnResult =
    | { kind: 'text_end' }
    | { kind: 'error' }
    | {
        kind: 'tool_calls';
        assistantMessage: any;
        toolCalls: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
      };

  // Shared shape for the two BYOK tool-loop chat proxies (SenseAudio,
  // AIHubMix). Both speak the OpenAI chat-completions wire and inject a
  // daemon-side `tools` array; they differ only in default base URL, outbound
  // headers (AIHubMix carries the APP-Code attribution header), the tool
  // definitions/allowlist, and which executor backs each tool. Funnelling
  // both through one factory keeps the tool-loop streaming logic single-source.
  type ByokToolRunner = (args: any, toolCtx: BYOKToolContext) => Promise<ImageToolResult>;
  interface ByokToolChatProxyOptions {
    providerId: string;
    logTag: string;
    defaultBaseUrl: string;
    tools: any[];
    buildHeaders: (apiKey: string) => Record<string, string>;
    isImageModel: (value: unknown) => boolean;
    /** Validates the per-request `byokVideoModel` default before it is fed to
     *  the `generate_video` tool. Omitted when the provider has no video tool. */
    isVideoModel?: (value: unknown) => boolean;
    /** Validates the per-request `byokSpeechModel` default for the speech tool. */
    isSpeechModel?: (value: unknown) => boolean;
    runImage: ByokToolRunner;
    runSpeech: ByokToolRunner;
    /** Omitted when the provider has no video endpoint (AIHubMix). */
    runVideo?: ByokToolRunner;
    /**
     * AIHubMix only: route by model name to the native protocol wire
     * (claude → Anthropic /v1/messages, gemini or imagen → Gemini
     * streamGenerateContent), all on the AIHubMix origin + APP-Code. Those
     * routes run base chat WITHOUT the tool loop (no in-chat generate_image
     * yet — the OpenAI family keeps it). When unset/false the provider always
     * uses the OpenAI tool-loop path (SenseAudio).
     */
    routeByModel?: boolean;
  }

  const registerByokToolChatProxy = (
    routePath: string,
    opts: ByokToolChatProxyOptions,
  ) => {
   app.post(routePath, async (req, res) => {
    const proxyBody = req.body || {};
    if (rejectProxyPluginContext(proxyBody, res)) return;
    const {
      baseUrl,
      apiKey,
      model,
      systemPrompt,
      messages,
      maxTokens,
      projectId,
      byokImageModel,
      byokVideoModel,
      byokSpeechModel,
      byokSpeechVoice,
    } = proxyBody;
    if (!apiKey || !model) {
      return sendApiError(
        res,
        400,
        'BAD_REQUEST',
        'apiKey and model are required',
      );
    }
    // projectId is required because the BYOK generate_image tool writes
    // into the active project's folder; without one we'd have to fall
    // back to a daemon-global cache that orphans the file. The web
    // client always passes project.id from ProjectView, so a missing
    // value means the request did not come through the chat surface.
    if (typeof projectId !== 'string' || !isSafeProjectId(projectId)) {
      return sendApiError(
        res,
        400,
        'BAD_REQUEST',
        'projectId is required and must be a safe identifier',
      );
    }

    const effectiveBaseUrl = baseUrl || opts.defaultBaseUrl;
    const validated = await validateExternalApiBaseUrl(effectiveBaseUrl);
    if (validated.error) {
      return sendApiError(
        res,
        validated.forbidden ? 403 : 400,
        validated.forbidden ? 'FORBIDDEN' : 'BAD_REQUEST',
        validated.error,
      );
    }
    const reasoningDenial = authorizeReasoningEgress({
      policy: proxyBody.reasoningExecution,
      routeKind: 'proxy',
      provider: opts.providerId,
      resolvedBaseUrl: effectiveBaseUrl,
      model,
    });
    if (reasoningDenial) return sendReasoningEgressDenial(res, reasoningDenial);

    // AIHubMix routes by model name to the native protocol wire (claude →
    // Anthropic /v1/messages, gemini/imagen → Gemini generateContent). That
    // divert happens further down — AFTER executeOneTool and the per-protocol
    // tool-loop runners are defined — so the claude/gemini branches can run the
    // same media tool loop the OpenAI family does. See the `routeByModel` block
    // just above `createSseResponse` below.

    const workingMessages: any[] = Array.isArray(messages) ? [...messages] : [];
    if (typeof systemPrompt === 'string' && systemPrompt) {
      workingMessages.unshift({ role: 'system', content: systemPrompt });
    }

    // Tool execution context — built once per request. The image tool
    // writes into `<projectsRoot>/<projectId>/byok-<id>.png` and returns
    // a relative URL via `/api/projects/:id/files/:filename`. The web's
    // Next.js rewrites `/api/:path*` to the daemon, so the chat UI
    // loads images same-origin through the standard project file
    // route — no CSP / CORS exceptions needed.
    // User-configured BYOK default image model. Drop silently if the
    // client sent an id outside the provider's registry — the tool
    // will fall back to the registry default and the LLM can still
    // override per-call via the tool's `model` arg.
    const validDefaultImageModel = opts.isImageModel(byokImageModel)
      ? byokImageModel
      : undefined;
    // Same treatment for the BYOK default video model (only providers with a
    // `generate_video` tool supply `isVideoModel`).
    const validDefaultVideoModel = opts.isVideoModel?.(byokVideoModel)
      ? byokVideoModel
      : undefined;
    // Speech model is validated like image/video; the voice is a free string
    // (a voice id), so it is passed through as-is when present.
    const validDefaultSpeechModel = opts.isSpeechModel?.(byokSpeechModel)
      ? byokSpeechModel
      : undefined;
    const validDefaultSpeechVoice =
      typeof byokSpeechVoice === 'string' && byokSpeechVoice.trim()
        ? byokSpeechVoice.trim()
        : undefined;

    let proxyDispatcher: ReturnType<typeof proxyDispatcherRequestInit> | null = null;

    const toolCtx: BYOKToolContext = {
      projectRoot: ctx.paths.PROJECT_ROOT,
      projectsRoot: ctx.paths.PROJECTS_DIR,
      projectId,
      upstreamApiKey: apiKey,
      upstreamBaseUrl: effectiveBaseUrl,
      requestInit: {},
      // Spread-conditional because tsconfig's exactOptionalPropertyTypes
      // forbids `field: undefined` on an optional slot. The byok-tools
      // executor re-validates `ctx.defaultImageModel` against the provider's
      // allowlist anyway, so a missing key and an undefined value behave the same.
      ...(validDefaultImageModel
        ? { defaultImageModel: validDefaultImageModel }
        : {}),
      ...(validDefaultVideoModel
        ? { defaultVideoModel: validDefaultVideoModel }
        : {}),
      ...(validDefaultSpeechModel
        ? { defaultSpeechModel: validDefaultSpeechModel }
        : {}),
      ...(validDefaultSpeechVoice
        ? { defaultSpeechVoice: validDefaultSpeechVoice }
        : {}),
    };

    // Run one round-trip: POST to upstream, stream text deltas to the
    // client as they arrive, accumulate any tool_call deltas. Returns
    // a typed result describing what to do next (loop on tool calls,
    // close the stream, or bail on error). Closures capture all the
    // SSE helpers from registerChatRoutes.
    const runTurn = async (
      sse: any,
      messagesForTurn: any[],
    ): Promise<TurnResult> => {
      const payload: any = {
        model,
        messages: messagesForTurn,
        max_tokens:
          typeof maxTokens === 'number' && maxTokens > 0 ? maxTokens : 8192,
        stream: true,
        tools: opts.tools,
        tool_choice: 'auto',
      };
      const response = await fetch(url, {
        ...toolCtx.requestInit,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...opts.buildHeaders(apiKey),
        },
        body: JSON.stringify(payload),
        redirect: 'error',
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[${opts.logTag}] upstream error: ${response.status} ${redactAuthTokens(errorText)}`,
        );
        sendProxyError(sse, `Upstream error: ${response.status}`, {
          code: proxyErrorCode(response.status),
          details: errorText,
          retryable: response.status === 429 || response.status >= 500,
        });
        return { kind: 'error' };
      }

      const accum: Record<number, AccumulatedToolCall> = {};
      let finishReason = '';
      let providerError = '';

      const guard = createDeltaGuard(sse);
      await streamUpstreamSse(response, ({ payload, data }: any) => {
        if (payload === '[DONE]') return true;
        if (!data) return false;

        const streamErr = extractStreamErrorMessage(data);
        if (streamErr) {
          providerError = streamErr;
          return true;
        }

        const choices = (data as any).choices;
        if (!Array.isArray(choices) || choices.length === 0) return false;
        const choice = choices[0] || {};
        const delta = choice.delta || {};

        // Text content streams to the client unchanged. Tool turns and
        // text turns can both share this path — the OpenAI protocol
        // never emits text+tool_calls in the same chunk, but it can
        // emit text before / after a tool_call in the same turn, and
        // we want the user to see whatever the model decided to say.
        if (typeof delta.content === 'string' && delta.content) {
          guard.sendDelta(delta.content);
          if (guard.contaminated) { 
            sse.send('end', {}); 
            return true; 
          }
        }

        // Tool call deltas stream as fragments — `id` arrives once at
        // the start, `function.name` once at the start, and
        // `function.arguments` accumulates a chunked JSON string we
        // have to concatenate. Parallel calls use the `index` field to
        // distinguish slots. Default to 0 when omitted (older models).
        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const idx = typeof tc?.index === 'number' ? tc.index : 0;
            if (!accum[idx]) {
              accum[idx] = { id: '', name: '', arguments: '' };
            }
            const slot = accum[idx];
            if (typeof tc.id === 'string' && tc.id) slot.id = tc.id;
            if (typeof tc.function?.name === 'string' && tc.function.name) {
              slot.name = tc.function.name;
            }
            if (typeof tc.function?.arguments === 'string') {
              slot.arguments += tc.function.arguments;
            }
          }
        }

        if (typeof choice.finish_reason === 'string' && choice.finish_reason) {
          finishReason = choice.finish_reason;
        }
        return false;
      });

      if (providerError) {
        sendProxyError(sse, `Provider error: ${providerError}`, {
          details: providerError,
        });
        return { kind: 'error' };
      }

      if (finishReason === 'tool_calls' && Object.keys(accum).length > 0) {
        const indices = Object.keys(accum)
          .map(Number)
          .sort((a, b) => a - b);
        const toolCalls = indices.map((i) => ({
          id: accum[i]!.id || `call_${i}`,
          type: 'function' as const,
          function: {
            name: accum[i]!.name,
            arguments: accum[i]!.arguments,
          },
        }));
        return {
          kind: 'tool_calls',
          assistantMessage: {
            role: 'assistant',
            content: null,
            tool_calls: toolCalls,
          },
          toolCalls,
        };
      }

      return { kind: 'text_end' };
    };

    const executeOneTool = async (call: {
      id: string;
      function: { name: string; arguments: string };
    }): Promise<{ ok: boolean; url?: string; error?: string; kind?: 'image' | 'video' | 'speech' | 'file'; content?: string; files?: string[] }> => {
      const fnName = call?.function?.name ?? '';

      // --- Project file tools (read_file, write_file, edit_file, list_files) ---
      const FILE_TOOL_NAMES = new Set(['read_file', 'write_file', 'edit_file', 'list_files']);
      if (FILE_TOOL_NAMES.has(fnName)) {
        const result = await executeProjectFileTool(call, toolCtx);
        return { ...result, kind: 'file' };
      }

      // --- Media tools (generate_image, generate_video, generate_speech) ---
      if (fnName !== 'generate_image' && fnName !== 'generate_video' && fnName !== 'generate_speech') {
        return {
          ok: false,
          error: `unknown tool: ${fnName || 'unnamed'}`,
        };
      }
      const toolKind = fnName === 'generate_image' ? 'image' : fnName === 'generate_video' ? 'video' : 'speech';
      let args: any = {};
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch {
        return { ok: false, error: 'tool arguments were not valid JSON', kind: toolKind };
      }
      if (fnName === 'generate_image') {
        const result = await opts.runImage(args, toolCtx);
        return { ...result, kind: 'image' };
      }
      if (fnName === 'generate_speech') {
        const result = await opts.runSpeech(args, toolCtx);
        return { ...result, kind: 'speech' };
      }
      // generate_video — longer (up to 5 min), async-with-polling. Only some
      // providers expose it (SenseAudio yes, AIHubMix no); without a runner
      // we surface a clear unsupported error the model can relay.
      if (!opts.runVideo) {
        return { ok: false, error: 'video generation is not supported for this provider', kind: 'video' };
      }
      const result = await opts.runVideo(args, toolCtx);
      return { ...result, kind: 'video' };
    };

    // ---- Anthropic native tool loop (aihubmix claude models) --------------
    // Mirrors the OpenAI runTurn/loop below but on the Anthropic Messages
    // wire. One round-trip: stream text deltas, accumulate any `tool_use`
    // content blocks (id/name from content_block_start, args JSON from
    // input_json_delta), and report the stop_reason. The shared executeOneTool
    // backs each tool; results return as `tool_result` blocks next round.
    const runAnthropicToolTurn = async (
      sse: any,
      anthropicUrl: string,
      headers: Record<string, string>,
      anthMessages: any[],
    ): Promise<
      | { kind: 'text_end' }
      | { kind: 'error' }
      | {
          kind: 'tool_calls';
          toolCalls: Array<{ id: string; function: { name: string; arguments: string } }>;
          assistantBlocks: any[];
        }
    > => {
      const payload: any = {
        ...buildAnthropicChatPayload(model, systemPrompt, anthMessages, maxTokens),
        tools: openaiToolsToAnthropic(opts.tools),
        tool_choice: { type: 'auto' },
      };
      const response = await fetch(anthropicUrl, {
        ...toolCtx.requestInit,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(payload),
        redirect: 'error',
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[${opts.logTag}] upstream error: ${response.status} ${redactAuthTokens(errorText)}`,
        );
        sendProxyError(sse, `Upstream error: ${response.status}`, {
          code: proxyErrorCode(response.status),
          details: errorText,
          retryable: response.status === 429 || response.status >= 500,
        });
        return { kind: 'error' };
      }
      // Content blocks accumulate by `index`. text_delta streams to the
      // client; input_json_delta concatenates the tool args JSON string.
      const blocks: Record<number, { type: string; id?: string; name?: string; json: string }> = {};
      let stopReason = '';
      let providerError = '';
      const guard = createDeltaGuard(sse);
      await streamUpstreamSse(response, ({ event, data }: any) => {
        if (!data) return false;
        if (event === 'error' || data.type === 'error') {
          providerError = data.error?.message || data.message || 'Anthropic upstream error';
          return true;
        }
        if (event === 'content_block_start') {
          const idx = typeof data.index === 'number' ? data.index : 0;
          const cb = data.content_block || {};
          blocks[idx] = { type: cb.type || 'text', id: cb.id, name: cb.name, json: '' };
        } else if (event === 'content_block_delta') {
          const idx = typeof data.index === 'number' ? data.index : 0;
          const d = data.delta || {};
          if (d.type === 'text_delta' && typeof d.text === 'string') {
            guard.sendDelta(d.text);
            if (guard.contaminated) {
              sse.send('end', {});
              return true;
            }
          } else if (d.type === 'input_json_delta' && typeof d.partial_json === 'string') {
            if (!blocks[idx]) blocks[idx] = { type: 'tool_use', json: '' };
            blocks[idx]!.json += d.partial_json;
          }
        } else if (event === 'message_delta') {
          if (typeof data.delta?.stop_reason === 'string') stopReason = data.delta.stop_reason;
        } else if (event === 'message_stop') {
          return true;
        }
        return false;
      });
      if (providerError) {
        sendProxyError(sse, `Provider error: ${providerError}`, { details: providerError });
        return { kind: 'error' };
      }
      const toolBlocks = Object.keys(blocks)
        .map(Number)
        .sort((a, b) => a - b)
        .map((i) => blocks[i]!)
        .filter((b) => b.type === 'tool_use');
      if (stopReason === 'tool_use' && toolBlocks.length > 0) {
        const toolCalls = toolBlocks.map((b, i) => ({
          id: b.id || `call_${i}`,
          function: { name: b.name || '', arguments: b.json || '{}' },
        }));
        const assistantBlocks = toolBlocks.map((b, i) => {
          let input: any = {};
          try {
            input = JSON.parse(b.json || '{}');
          } catch {
            /* keep {} — the executor re-validates args */
          }
          return { type: 'tool_use', id: b.id || `call_${i}`, name: b.name || '', input };
        });
        return { kind: 'tool_calls', toolCalls, assistantBlocks };
      }
      return { kind: 'text_end' };
    };

    const runAnthropicToolChat = async (
      res: any,
      anthropicUrl: string,
      headers: Record<string, string>,
    ) => {
      const sse = createSseResponse(res);
      let proxyDispatcher: ReturnType<typeof proxyDispatcherRequestInit> | null = null;
      try {
        proxyDispatcher = proxyDispatcherRequestInit();
        toolCtx.requestInit = proxyDispatcher.requestInit;
        sse.send('start', { model });
        const convMessages: any[] = Array.isArray(messages) ? [...messages] : [];
        for (let loop = 0; loop < MAX_BYOK_TOOL_LOOPS; loop++) {
          const turn = await runAnthropicToolTurn(sse, anthropicUrl, headers, convMessages);
          if (turn.kind === 'error') return sse.end();
          if (turn.kind === 'text_end') {
            sse.send('end', {});
            return sse.end();
          }
          // Append the assistant's tool_use turn, then a user turn carrying one
          // tool_result block per call, then loop so the model can use them.
          convMessages.push({ role: 'assistant', content: turn.assistantBlocks });
          const toolResults: any[] = [];
          for (const call of turn.toolCalls) {
            const result = await executeOneTool(call);
            const toolName = call?.function?.name ?? 'unknown';
            if (result.ok) {
              console.log(`[${opts.logTag}] ${toolName} OK: ${call.id} → ${result.url}`);
            } else {
              console.warn(`[${opts.logTag}] ${toolName} FAILED: ${call.id} — ${result.error}`);
            }
            toolResults.push({
              type: 'tool_result',
              tool_use_id: call.id,
              content: buildToolResultContent(result),
            });
          }
          convMessages.push({ role: 'user', content: toolResults });
        }
        console.warn(
          `[${opts.logTag}] anthropic tool loop bounded at MAX_BYOK_TOOL_LOOPS=${MAX_BYOK_TOOL_LOOPS}`,
        );
        sse.send('end', {});
        return sse.end();
      } catch (err: any) {
        console.error(`[${opts.logTag}] internal error: ${err.message}`);
        sendProxyError(sse, err.message, { code: 'INTERNAL_ERROR' });
        sse.end();
      } finally {
        await proxyDispatcher?.close();
      }
    };

    // ---- Gemini native tool loop (aihubmix gemini/imagen models) ----------
    const runGeminiToolTurn = async (
      sse: any,
      geminiUrl: string,
      headers: Record<string, string>,
      contents: any[],
    ): Promise<
      | { kind: 'text_end' }
      | { kind: 'error' }
      | {
          kind: 'tool_calls';
          toolCalls: Array<{ id: string; function: { name: string; arguments: string } }>;
          functionCallParts: any[];
        }
    > => {
      const payload: any = {
        contents,
        generationConfig: {
          maxOutputTokens: typeof maxTokens === 'number' && maxTokens > 0 ? maxTokens : 8192,
        },
        tools: openaiToolsToGemini(opts.tools),
      };
      if (typeof systemPrompt === 'string' && systemPrompt) {
        payload.systemInstruction = { parts: [{ text: systemPrompt }] };
      }
      const response = await fetch(geminiUrl, {
        ...toolCtx.requestInit,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(payload),
        redirect: 'error',
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `[${opts.logTag}] upstream error: ${response.status} ${redactAuthTokens(errorText)}`,
        );
        sendProxyError(sse, `Upstream error: ${response.status}`, {
          code: proxyErrorCode(response.status),
          details: errorText,
          retryable: response.status === 429 || response.status >= 500,
        });
        return { kind: 'error' };
      }
      // Gemini streams candidate parts; a functionCall part usually arrives
      // whole in one chunk (not char-streamed like text). Collect them.
      const functionCalls: Array<{ name: string; args: any }> = [];
      // Keep the RAW functionCall parts verbatim. Gemini 3.x thinking models
      // attach a `thoughtSignature` to each functionCall part; the next request
      // 400s ("Function call is missing a thought_signature") unless we echo
      // that exact part back in the model turn. So we replay the original part
      // object (signature included) rather than reconstructing {functionCall}.
      const functionCallParts: any[] = [];
      let providerError = '';
      const guard = createDeltaGuard(sse);
      await streamUpstreamSse(response, ({ data }: any) => {
        if (!data) return false;
        const streamError = extractStreamErrorMessage(data);
        if (streamError) {
          providerError = streamError;
          return true;
        }
        const parts = (data as any)?.candidates?.[0]?.content?.parts;
        if (Array.isArray(parts)) {
          for (const part of parts) {
            if (typeof part?.text === 'string' && part.text) {
              guard.sendDelta(part.text);
              if (guard.contaminated) {
                sse.send('end', {});
                return true;
              }
            }
            if (part?.functionCall && typeof part.functionCall.name === 'string') {
              functionCalls.push({
                name: part.functionCall.name,
                args: part.functionCall.args || {},
              });
              functionCallParts.push(part);
            }
          }
        }
        const blockMessage = extractGeminiBlockMessage(data);
        if (blockMessage) {
          providerError = blockMessage;
          return true;
        }
        return false;
      });
      if (providerError) {
        sendProxyError(sse, `Gemini error: ${providerError}`, { details: providerError });
        return { kind: 'error' };
      }
      if (functionCalls.length > 0) {
        const toolCalls = functionCalls.map((fc, i) => ({
          id: `call_${i}`,
          function: { name: fc.name, arguments: JSON.stringify(fc.args ?? {}) },
        }));
        return { kind: 'tool_calls', toolCalls, functionCallParts };
      }
      return { kind: 'text_end' };
    };

    const runGeminiToolChat = async (
      res: any,
      geminiUrl: string,
      headers: Record<string, string>,
    ) => {
      const sse = createSseResponse(res);
      let proxyDispatcher: ReturnType<typeof proxyDispatcherRequestInit> | null = null;
      try {
        proxyDispatcher = proxyDispatcherRequestInit();
        toolCtx.requestInit = proxyDispatcher.requestInit;
        sse.send('start', { model });
        const contents: any[] = (Array.isArray(messages) ? messages : []).map((m: any) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: typeof m.content === 'string' ? m.content : '' }],
        }));
        for (let loop = 0; loop < MAX_BYOK_TOOL_LOOPS; loop++) {
          const turn = await runGeminiToolTurn(sse, geminiUrl, headers, contents);
          if (turn.kind === 'error') return sse.end();
          if (turn.kind === 'text_end') {
            sse.send('end', {});
            return sse.end();
          }
          // Append the model's functionCall turn, then a user turn carrying one
          // functionResponse part per call, then loop.
          contents.push({ role: 'model', parts: turn.functionCallParts });
          const responseParts: any[] = [];
          for (const call of turn.toolCalls) {
            const result = await executeOneTool(call);
            const toolName = call?.function?.name ?? 'unknown';
            if (result.ok) {
              console.log(`[${opts.logTag}] ${toolName} OK: ${call.id} → ${result.url}`);
            } else {
              console.warn(`[${opts.logTag}] ${toolName} FAILED: ${call.id} — ${result.error}`);
            }
            responseParts.push({
              functionResponse: {
                name: toolName,
                response: { result: buildToolResultContent(result) },
              },
            });
          }
          contents.push({ role: 'user', parts: responseParts });
        }
        console.warn(
          `[${opts.logTag}] gemini tool loop bounded at MAX_BYOK_TOOL_LOOPS=${MAX_BYOK_TOOL_LOOPS}`,
        );
        sse.send('end', {});
        return sse.end();
      } catch (err: any) {
        console.error(`[${opts.logTag}] internal error: ${err.message}`);
        sendProxyError(sse, err.message, { code: 'INTERNAL_ERROR' });
        sse.end();
      } finally {
        await proxyDispatcher?.close();
      }
    };

    // AIHubMix model-name divert (deferred from the top of the handler so the
    // tool-loop runners above are in scope). claude → Anthropic /v1/messages,
    // gemini/imagen → Gemini generateContent, both on the AIHubMix origin with
    // APP-Code. When the provider supplies media tools, run the tool loop on
    // the native wire; otherwise stream base chat. OpenAI family falls through.
    if (opts.routeByModel) {
      const family = classifyAIHubMixModel(model);
      const origin = aihubmixOriginFromBase(effectiveBaseUrl);
      const hasTools = Array.isArray(opts.tools) && opts.tools.length > 0;
      if (family === 'anthropic') {
        const anthropicUrl = appendVersionedApiPath(origin, '/messages');
        const anthropicHeaders = {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          ...aihubmixAppCodeHeader(),
        };
        console.log(
          `[${opts.logTag}] ${req.method} anthropic ${anthropicUrl} model=${model} project=${projectId} tools=${hasTools ? 'on' : 'off'}`,
        );
        if (hasTools) return runAnthropicToolChat(res, anthropicUrl, anthropicHeaders);
        return runAnthropicChatStream(res, {
          url: anthropicUrl,
          headers: anthropicHeaders,
          payload: buildAnthropicChatPayload(model, systemPrompt, messages, maxTokens),
          logTag: opts.logTag,
        });
      }
      if (family === 'gemini') {
        const geminiUrl = googleStreamGenerateContentUrl(`${origin}/gemini`, model);
        const geminiHeaders = { 'x-goog-api-key': apiKey, ...aihubmixAppCodeHeader() };
        console.log(
          `[${opts.logTag}] ${req.method} gemini ${geminiUrl} model=${model} project=${projectId} tools=${hasTools ? 'on' : 'off'}`,
        );
        if (hasTools) return runGeminiToolChat(res, geminiUrl, geminiHeaders);
        return runGeminiChatStream(res, {
          url: geminiUrl,
          headers: geminiHeaders,
          payload: buildGeminiChatPayload(systemPrompt, messages, maxTokens),
          model,
          logTag: opts.logTag,
        });
      }
      // family === 'openai' → fall through to the OpenAI tool loop below.
    }

    const url = appendVersionedApiPath(effectiveBaseUrl, '/chat/completions');
    // Log protocol + full endpoint (like the anthropic/gemini branches above) so
    // multi-model switching is auditable: which model hit which wire endpoint.
    console.log(
      `[${opts.logTag}] ${req.method} openai ${url} model=${model} project=${projectId}`,
    );

    const sse = createSseResponse(res);
    // These gateways issue one API key that works for both
    // /v1/chat/completions and the image / TTS surfaces. Mirror the
    // BYOK key into media-config so the CLI agent path (`od media
    // generate`) picks it up automatically — fire-and-forget; the
    // chat stream must not block on the disk write. seedProviderIfMissing
    // is idempotent and preserves env-var-resolved keys.
    seedProviderIfMissing(ctx.paths.PROJECT_ROOT, opts.providerId, {
      apiKey,
      baseUrl: effectiveBaseUrl,
    })
      .then((seeded) => {
        if (seeded) {
          console.log(
            `[${opts.logTag}] seeded media-config.${opts.providerId} from BYOK key`,
          );
        }
      })
      .catch((err: unknown) => {
        console.warn(
          `[${opts.logTag}] seed media-config failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });

    try {
      proxyDispatcher = proxyDispatcherRequestInit();
      toolCtx.requestInit = proxyDispatcher.requestInit;
      sse.send('start', { model });
      for (let loop = 0; loop < MAX_BYOK_TOOL_LOOPS; loop++) {
        const turn = await runTurn(sse, workingMessages);
        if (turn.kind === 'error') return sse.end();
        if (turn.kind === 'text_end') {
          sse.send('end', {});
          return sse.end();
        }
        // turn.kind === 'tool_calls'
        workingMessages.push(turn.assistantMessage);
        for (const call of turn.toolCalls) {
          const result = await executeOneTool(call);
          // The tool result is delivered to the model as a `tool` role
          // message — a structured payload the model can interpret. We
          // also surface a daemon-side log line so a user reporting "no
          // image showed up" can grep for the call id. The kind field
          // distinguishes image vs video so the daemon picks the right
          // embedding hint for the model (markdown image syntax for
          // PNG, markdown link for MP4 since the chat renderer doesn't
          // currently render <video> tags).
          const toolName = call?.function?.name ?? 'unknown';
          if (result.ok) {
            console.log(
              `[${opts.logTag}] ${toolName} OK: ${call.id} → ${result.url}`,
            );
          } else {
            console.warn(
              `[${opts.logTag}] ${toolName} FAILED: ${call.id} — ${result.error}`,
            );
          }
          workingMessages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: buildToolResultContent(result),
          });
        }
      }
      // Tool loop exhausted — the model still wants to call tools but we
      // refuse a 4th round. Close the stream gracefully; the last text
      // delta the model emitted (if any) is already on the wire.
      console.warn(
        `[${opts.logTag}] tool loop bounded at MAX_BYOK_TOOL_LOOPS=${MAX_BYOK_TOOL_LOOPS}`,
      );
      sse.send('end', {});
      return sse.end();
    } catch (err: any) {
      console.error(`[${opts.logTag}] internal error: ${err.message}`);
      sendProxyError(sse, err.message, { code: 'INTERNAL_ERROR' });
      sse.end();
    } finally {
      await proxyDispatcher?.close();
    }
   });
  };

  // SenseAudio: proprietary image (/v1/image/sync) + TTS (/v1/t2a_v2) + video
  // (/v1/video/create) executors, Bearer auth.
  registerByokToolChatProxy('/api/proxy/senseaudio/stream', {
    providerId: 'senseaudio',
    logTag: 'proxy:senseaudio',
    defaultBaseUrl: 'https://api.senseaudio.cn',
    tools: [...BYOK_SENSEAUDIO_TOOLS, ...BYOK_PROJECT_FILE_TOOLS],
    buildHeaders: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
    isImageModel: isSenseAudioImageModel,
    runImage: executeGenerateImage,
    runSpeech: executeGenerateSpeech,
    runVideo: executeGenerateVideo,
  });

  // AIHubMix: routes by model name to the native protocol wire —
  //   claude*        → Anthropic /v1/messages (base chat, no tools yet)
  //   gemini*/imagen*→ Gemini :streamGenerateContent (base chat, no tools yet)
  //   everything else→ OpenAI /v1/chat/completions WITH the tool loop below
  // All on the AIHubMix origin + APP-Code. The OpenAI family keeps in-chat
  // generate_image (/v1/images/generations) + TTS (/v1/audio/speech) + video
  // (async /v1/videos submit→poll→download).
  registerByokToolChatProxy('/api/proxy/aihubmix/stream', {
    providerId: 'aihubmix',
    logTag: 'proxy:aihubmix',
    defaultBaseUrl: AIHUBMIX_DEFAULT_BASE_URL,
    tools: [...BYOK_AIHUBMIX_TOOLS, ...BYOK_PROJECT_FILE_TOOLS],
    buildHeaders: (apiKey) => aihubmixHeaders(apiKey),
    isImageModel: isAIHubMixImageModel,
    isVideoModel: isAIHubMixVideoModel,
    isSpeechModel: isAIHubMixSpeechModel,
    runImage: executeAIHubMixGenerateImage,
    runSpeech: executeAIHubMixGenerateSpeech,
    runVideo: executeAIHubMixGenerateVideo,
    routeByModel: true,
  });

  app.post('/api/proxy/:provider/stream', (req, res) => {
    const proxyBody = req.body || {};
    const provider = typeof req.params.provider === 'string' ? req.params.provider : 'unknown';
    const reasoningDenial = authorizeReasoningEgress({
      policy: proxyBody.reasoningExecution,
      routeKind: 'proxy',
      provider,
      resolvedBaseUrl: typeof proxyBody.baseUrl === 'string' ? proxyBody.baseUrl : undefined,
      model: typeof proxyBody.model === 'string' ? proxyBody.model : undefined,
    });
    if (reasoningDenial) return sendReasoningEgressDenial(res, reasoningDenial);
    return sendApiError(res, 404, 'NOT_FOUND', 'unknown proxy provider');
  });

}
