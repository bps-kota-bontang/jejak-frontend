import type { Survey } from "@/types/survey";

const MESSAGE_SOURCE = "jejak-frontend";
const RESPONSE_SOURCE = "jejak-extension";

const RESPONSE_TYPE = "JEJAK_FASIH_EXPORT_RESPONSE";
const PING_TYPE = "JEJAK_FASIH_EXPORT_PING";
const CONNECT_SURVEY_TYPE = "JEJAK_FASIH_CONNECT_SURVEY_REQUEST";
const GET_SURVEY_CREDENTIAL_TYPE = "JEJAK_FASIH_GET_SURVEY_CREDENTIAL_REQUEST";

type ExtensionResponsePayload = {
  success?: boolean;
  message?: string;
  request_id?: string;
  survey_id?: string;
  survey_period_id?: string;
  survey_label?: string;
  xsrf_token?: string;
  cookie?: string;
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

async function sendBridgeMessageDetailed(
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

  return response;
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

export type ImportedSurveyCredentials = {
  message: string;
  survey_label: string;
  xsrf_token: string;
  cookie: string;
};

export async function importSurveyCredentialsFromBrowser(input: {
  survey_id: string;
  survey_period_id: string;
  survey_label?: string;
}) {
  await sendBridgeMessage(PING_TYPE, {}, 2500);

  const surveyID = input.survey_id.trim();
  const surveyPeriodID = input.survey_period_id.trim();
  if (!surveyID || !surveyPeriodID) {
    throw new Error("Kode survey dan kode periode survey wajib diisi.");
  }

  const response = await sendBridgeMessageDetailed(
    CONNECT_SURVEY_TYPE,
    {
      survey_label: (input.survey_label || "").trim(),
      survey_id: surveyID,
      survey_period_id: surveyPeriodID,
      page_url: `https://fasih-sm.bps.go.id/app/surveys/${encodeURIComponent(surveyID)}/${encodeURIComponent(surveyPeriodID)}`,
    },
    6000,
  );

  let xsrfToken = (response.xsrf_token || "").trim();
  let cookie = (response.cookie || "").trim();
  let surveyLabel = (response.survey_label || "").trim();

  if (!xsrfToken || !cookie) {
    const stored = await sendBridgeMessageDetailed(
      GET_SURVEY_CREDENTIAL_TYPE,
      {
        survey_id: surveyID,
        survey_period_id: surveyPeriodID,
      },
      5000,
    );

    xsrfToken = (stored.xsrf_token || "").trim();
    cookie = (stored.cookie || "").trim();
    surveyLabel = surveyLabel || (stored.survey_label || "").trim();
  }

  if (!xsrfToken || !cookie) {
    throw new Error(
      "Import berhasil dipicu tetapi cookie/XSRF belum tersimpan. Buka tab survey Fasih lalu klik Hubungkan ke Jejak sekali lagi.",
    );
  }

  return {
    message: response.message || "Cookie dan XSRF berhasil diimport dari browser.",
    survey_label: surveyLabel,
    xsrf_token: xsrfToken,
    cookie,
  } as ImportedSurveyCredentials;
}
