import type { Survey } from "@/types/survey";

const MESSAGE_SOURCE = "jejak-frontend";
const RESPONSE_SOURCE = "jejak-extension";

const RESPONSE_TYPE = "JEJAK_FASIH_EXPORT_RESPONSE";
const PING_TYPE = "JEJAK_FASIH_EXPORT_PING";
const CONNECT_SURVEY_TYPE = "JEJAK_FASIH_CONNECT_SURVEY_REQUEST";

type ExtensionResponsePayload = {
  success?: boolean;
  message?: string;
  request_id?: string;
};

function nextRequestId() {
  return `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function waitForExtensionResponse(requestId: string, timeoutMs = 5000) {
  return new Promise<ExtensionResponsePayload>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("Extension tidak merespons. Pastikan extension Jejak aktif."));
    }, timeoutMs);

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) {
        return;
      }

      const data = event.data;
      if (!data || data.source !== RESPONSE_SOURCE || data.type !== RESPONSE_TYPE) {
        return;
      }

      const payload = (data.payload || {}) as ExtensionResponsePayload;
      if (payload.request_id !== requestId) {
        return;
      }

      window.clearTimeout(timeoutId);
      window.removeEventListener("message", onMessage);
      resolve(payload);
    };

    window.addEventListener("message", onMessage);
  });
}

async function sendBridgeMessage(
  type: string,
  payload: Record<string, string>,
  timeoutMs = 5000,
) {
  const requestId = nextRequestId();
  const responsePromise = waitForExtensionResponse(requestId, timeoutMs);

  window.postMessage(
    {
      source: MESSAGE_SOURCE,
      type,
      payload: {
        ...payload,
        request_id: requestId,
      },
    },
    "*",
  );

  const response = await responsePromise;
  if (!response.success) {
    throw new Error(response.message || "Proses ke extension gagal.");
  }

  return response.message || "Berhasil.";
}

export async function connectSurveyToExtension(survey: Survey) {
  await sendBridgeMessage(PING_TYPE, {}, 2500);

  return sendBridgeMessage(
    CONNECT_SURVEY_TYPE,
    {
      survey_label: survey.name || "",
      survey_id: survey.survey_id,
      survey_period_id: survey.survey_period_id,
      region_level_1: survey.region_level_1 || "",
      region_level_2: survey.region_level_2 || "",
      xsrf_token: survey.xsrf_token,
      cookie: survey.cookie,
    },
    6000,
  );
}
